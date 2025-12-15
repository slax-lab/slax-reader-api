import { inject, injectable } from '../decorators/di'
import {
  BookmarkNotFoundError,
  CommentTooLongError,
  ErrorMarkCommentTypeError,
  ErrorParam,
  MarkLineTooLongError,
  ServerError,
  ShareActionNotAllowedError,
  ShareCodeNotFoundError,
  ShareCollectionNotAllowedError,
  ShareCollectionNotFoundError,
  ShareDisabledError
} from '../const/err'
import { markDetailPO, MarkRepo, markType } from '../infra/repository/dbMark'
import { ContextManager } from '../utils/context'
import { BookmarkRepo } from '../infra/repository/dbBookmark'
import { UserRepo } from '../infra/repository/dbUser'

export interface markResponse {
  id: number
  root_id: number
}

export interface markPathItem {
  type: 'text' | 'image'
  xpath: string
  start_offet: number
  end_offset: number
}

export interface markRequest {
  source: markPathItem[]
  select_content: markSelectContent[]
  parent_id: number
  comment?: string
  bm_id?: number
  share_code?: string
  collection_code?: string
  cb_id?: number
  type: markType
  approx_source?: markApproxSource
}

export interface markApproxSource {
  exact: string
  prefix: string
  suffix: string
  position_start: number
  position_end: number
}

export interface markSelectContent {
  type: 'text' | 'image'
  text: string
  src: string
}

export interface markInfo {
  id: number
  user_id: number
  type: markType
  parent_id: number
  root_id: number
  source: string
  comment: string
  created_at: Date
}

export interface markUserInfo {
  id: number
  username: string
  avatar: string
}

export interface markCommentItem {
  id: number
  type: string
  content: markSelectContent[]
  created_at: Date
  title: string
  color?: string
  parent_comment?: string
  parent_comment_deleted?: boolean
  comment: string
  source_type: 'share' | 'bookmark'
  source_id: string
  approx_source?: markApproxSource
}

@injectable()
export class MarkService {
  constructor(
    @inject(BookmarkRepo) private bookmarkRepo: BookmarkRepo,
    @inject(MarkRepo) private markRepo: MarkRepo,
    @inject(UserRepo) private userRepo: UserRepo
  ) {}

  assertBookmarkShareCode = async (ctx: ContextManager, shareCode: string) => {
    const res = await this.bookmarkRepo.getBookmarkShareByShareCode(shareCode)
    if (!res) throw ShareCodeNotFoundError()
    // 分享关闭
    if (!res.is_enable) throw ShareDisabledError()
    // 开启评论跟划线权限
    if (res.allow_comment && res.allow_line) return res
    // 没开启评论跟划线权限，且不是本人
    if (!res.allow_comment && !res.allow_line && ctx.getUserId() !== res.user_id) throw ShareActionNotAllowedError()

    return res
  }

  assertMarkBookmark = async (ctx: ContextManager, bmId: number, parentId: number) => {
    if (parentId < 1) throw ErrorParam()

    const mark = await this.markRepo.get(parentId)
    if (!mark) throw ErrorParam()
    if (mark.user_bookmark_id !== bmId) throw ShareActionNotAllowedError()
    if (mark.is_deleted) throw ShareActionNotAllowedError()
    return mark
  }

  assertMarkData = async (data: markRequest) => {
    if (data.type === markType.REPLY || typeof data.source === 'number') return

    // 检查单次划线不超过1000个字符+3张图片
    let sourceLength = 0
    let sourceImageCount = 0
    data.source.forEach(item => {
      if (item.type === 'image') sourceImageCount++
      else sourceLength += item.end_offset - item.start_offet
    })
    if (sourceLength > 1000 || sourceImageCount > 3) throw MarkLineTooLongError()
    // 检查评论不能为空或者超过1500个字符
    if (data.comment && data.comment.length > 1500) throw CommentTooLongError()
  }

  assertCreateMarkSource = async (ctx: ContextManager, data: markRequest) => {
    // 来源检测
    let bmId = 0
    let userId = 0

    const bookmarkHandle = async () => {
      bmId = ctx.hashIds.decodeId(data.bm_id || 0)
      if (bmId < 1) throw BookmarkNotFoundError()
      userId = ctx.getUserId()
    }

    const shareHandle = async () => {
      const res = await this.assertBookmarkShareCode(ctx, data.share_code || '')
      userId = res.user_id
      bmId = res.bookmark_id
    }

    const collectionHandle = async () => {
      const cbId = ctx.hashIds.decodeId(data.cb_id || 0)
      if (cbId < 1) throw BookmarkNotFoundError()
      const res = await this.bookmarkRepo.getUserBookmarkById(cbId)
      if (!res) throw BookmarkNotFoundError()

      userId = res.user_id
      bmId = res.bookmark_id
    }

    if (data.bm_id) {
      await bookmarkHandle()
    } else if (data.share_code) {
      await shareHandle()
    } else if (data.collection_code && data.cb_id) {
      await collectionHandle()
    } else {
      throw ErrorMarkCommentTypeError()
    }

    const userBookmark = await this.bookmarkRepo.getUserBookmark(bmId, userId)
    if (!userBookmark) throw ErrorParam()
    return userBookmark
  }

  public async createMark(ctx: ContextManager, data: markRequest) {
    // 数据检测
    await this.assertMarkData(data)

    // 回复对象检测
    const userBookmark = await this.assertCreateMarkSource(ctx, data)

    // 防止通过回复来绕过评论限制
    let rootId = 0
    let parentId = 0
    let replyComment: markDetailPO | undefined = undefined
    if (data.type === markType.REPLY) {
      parentId = ctx.hashIds.decodeId(data.parent_id)
      if (parentId < 1) throw ErrorParam()
      const res = await this.assertMarkBookmark(ctx, userBookmark.id, parentId)
      replyComment = res
      rootId = res.root_id
      data.source = []
    }

    let sourceType = ''
    let sourceId: string | number = ''
    if (data.share_code) {
      sourceType = 'share'
      sourceId = data.share_code
    } else if (data.cb_id) {
      sourceType = 'collection'
      const cbId = ctx.hashIds.decodeId(data.cb_id || 0)
      if (cbId < 1) throw ErrorParam()
      sourceId = `${data.collection_code!}/${cbId}`
    } else {
      sourceType = 'bookmark'
      sourceId = ctx.hashIds.decodeId(data.bm_id || 0)
    }

    // 创建实体
    const res = await this.markRepo.create({
      user_bookmark_id: userBookmark.id,
      user_bookmark_uuid: userBookmark.uuid,
      user_id: ctx.getUserId(),
      type: data.type,
      source: data.source,
      source_type: sourceType,
      source_id: sourceId.toString(),
      content: data.select_content,
      comment: data.comment || '',
      created_at: new Date(),
      parent_id: parentId,
      root_id: rootId,
      approx_source: data.approx_source
    })
    if (!res) throw ServerError()

    // 如果是父级评论，多update一次追加root_id，后续delete的时候不需要重新查询
    const callback = async () => {
      if ([markType.COMMENT, markType.ORIGIN_COMMENT].includes(data.type)) await this.markRepo.updateCommentRootId(res.id, res.id)
    }
    ctx.execution.waitUntil(callback())

    return {
      response: {
        id: ctx.hashIds.encodeId(res.id),
        root_id: ctx.hashIds.encodeId(res.root_id > 0 ? res.root_id : res.id)
      },
      mark: res,
      userBookmark,
      replyComment
    }
  }

  public async deleteMark(ctx: ContextManager, markId: number): Promise<string> {
    const userId = ctx.getUserId()

    const mark = await this.markRepo.get(markId)
    if (!mark || mark.is_deleted) throw ErrorParam()
    if (mark.user_id !== userId) {
      // 非本人则去校验文章所有权
      const ubm = await this.bookmarkRepo.getUserBookmarkById(mark.user_bookmark_id)
      if (!ubm) throw ShareActionNotAllowedError()
      if (ubm.user_id !== userId) throw ShareActionNotAllowedError()
    }

    // 如果root_id的评论底下有任意子评论，则软删除当前评论
    if ([markType.COMMENT, markType.ORIGIN_COMMENT, markType.REPLY].includes(mark.type)) {
      const res = await this.markRepo.existsCommentMarkChild(mark.user_bookmark_id, mark.root_id)
      // 如果有子评论，把评论标记为删除
      if (res && res > 1) {
        await this.markRepo.updateCommentMarkDeleted(markId)
        return 'ok'
      }
    }
    // 硬删除评论
    try {
      if ([markType.COMMENT, markType.ORIGIN_COMMENT, markType.REPLY].includes(mark.type)) {
        await this.markRepo.deleteByRootId(mark.user_bookmark_id, mark.root_id)
      } else if ([markType.LINE, markType.ORIGIN_LINE].includes(mark.type)) {
        await this.markRepo.del(markId)
      }
    } catch (e) {
      console.error(`delete mark failed: ${e}`)
      throw ServerError()
    }

    return 'ok'
  }

  public async getBookmarkMarkList(ctx: ContextManager, userBmId: number, isShowMarks: boolean) {
    const defaultResult = { mark_list: [], user_list: [] }
    if (!isShowMarks) return defaultResult
    const markRepo = this.markRepo
    const userRepo = this.userRepo

    const marks = await markRepo.list(userBmId)
    if (marks.length === 0) return defaultResult

    const users = await userRepo.getUserInfoList(marks.map(m => m.user_id))
    const markList: markInfo[] = marks.map(m => {
      return {
        id: ctx.hashIds.encodeId(m.id),
        user_id: ctx.hashIds.encodeId(m.user_id),
        type: m.type,
        source: m.source,
        comment: m.comment,
        parent_id: ctx.hashIds.encodeId(m.parent_id),
        root_id: ctx.hashIds.encodeId(m.root_id),
        created_at: m.created_at,
        is_deleted: m.is_deleted,
        approx_source: m.approx_source
      }
    })
    const userMap: Record<number, markUserInfo> = {
      [ctx.hashIds.encodeId(0)]: {
        id: ctx.hashIds.encodeId(0),
        username: 'Deleted',
        avatar: ''
      }
    }
    users.forEach(u => {
      userMap[ctx.hashIds.encodeId(u.id)] = {
        id: ctx.hashIds.encodeId(u.id),
        username: u.name,
        avatar: u.picture
      }
    })

    return {
      mark_list: markList,
      user_list: userMap
    }
  }

  public async getMarkList(ctx: ContextManager, page: number, size: number): Promise<markCommentItem[]> {
    const markRepo = this.markRepo
    const markTypeMap: Record<markType, string> = {
      [markType.COMMENT]: 'comment',
      [markType.LINE]: 'mark',
      [markType.REPLY]: 'reply',
      [markType.ORIGIN_LINE]: 'mark',
      [markType.ORIGIN_COMMENT]: 'comment'
    }
    const marks = await markRepo.listUserMark(ctx.getUserId(), page, size)
    if (marks.length === 0) return []

    const bookmarkIdList: number[] = []
    const bookmarkTitleMap: Record<number, string> = {}
    const parentComment: Record<number, string> = {}
    const parentCommentIdList: number[] = []
    const deletedParentCommmentIdList: Set<number> = new Set()

    for (const mark of marks) {
      if (bookmarkIdList.indexOf(mark.bookmark_id) === -1) {
        bookmarkIdList.push(mark.bookmark_id)
      }
      if (mark.type === markType.REPLY) {
        parentCommentIdList.push(mark.parent_id)
      }
    }

    // 批量查询父级评论
    const processParentComment = async () => {
      if (parentCommentIdList.length < 1) return
      ;(await this.bookmarkRepo.batchGetBookmarkComment(parentCommentIdList)).forEach(c => {
        c.is_deleted && deletedParentCommmentIdList.add(c.id)
        !c.is_deleted && (parentComment[c.id] = c.comment)
      })
    }
    // 批量查询bookmark title
    const processBookmarkTitle = async () => {
      if (bookmarkIdList.length < 1) return
      ;(await this.bookmarkRepo.batchGetBookmarkTitle(bookmarkIdList)).forEach(b => {
        bookmarkTitleMap[b.user_bookmark_id] = b.title
      })
    }

    await Promise.allSettled([processParentComment(), processBookmarkTitle()])

    const res: markCommentItem[] = []
    for (const mark of marks) {
      try {
        let sourceId = ctx.hashIds.encodeId(parseInt(mark.source_id)).toString()
        if (mark.source_type === 'share') sourceId = mark.source_id
        if (mark.source_type === 'collection') {
          const [collectionCode, cbId] = mark.source_id.split('/')
          sourceId = `${collectionCode}/${ctx.hashIds.encodeId(parseInt(cbId))}`
        }
        res.push({
          id: ctx.hashIds.encodeId(mark.id),
          type: markTypeMap[mark.type as markType],
          content: JSON.parse(mark.content) as markSelectContent[],
          created_at: mark.created_at,
          title: bookmarkTitleMap[mark.bookmark_id] || '',
          color: '',
          parent_comment: mark.type === markType.REPLY ? parentComment[mark.parent_id] || 'Deleted' : '',
          parent_comment_deleted: mark.type === markType.REPLY ? deletedParentCommmentIdList.has(mark.parent_id) : undefined,
          comment: mark.comment,
          source_type: mark.source_type as 'share' | 'bookmark',
          source_id: sourceId,
          approx_source: JSON.parse(mark.approx_source)
        })
      } catch (e) {
        console.log(`get mark list failed: ${e}, content: ${mark.content}`)
      }
    }

    return res
  }
}

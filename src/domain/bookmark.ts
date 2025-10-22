import { BookmarkContentNotFoundError, BookmarkNotFoundError, CreateBookmarkFailError, ErrorParam, UserNotFoundError } from '../const/err'
import { ContextManager } from '../utils/context'
import { BlockTargetUrlError } from '../const/err'
import { bookmarkFetchRetryStatus, bookmarkParseStatus, BookmarkRepo, queueStatus } from '../infra/repository/dbBookmark'
import { BucketClient } from '../infra/repository/bucketClient'
import { callbackType, QueueClient, queueParseMessage } from '../infra/queue/queueClient'
import { parserType, processTargetUrl, URLPolicie } from '../utils/urlPolicie'
import { BookmarkTag } from './tag'
import { markInfo, markUserInfo } from './mark'
import { supportedLang } from '../const/lang'
import { inject, injectable } from '../decorators/di'
import type { LazyInstance } from '../decorators/lazy'
import { BookmarkSearchRepo } from '../infra/repository/dbBookmarkSearch'
import { VectorizeRepo } from '../infra/repository/dbVectorize'
import { MarkRepo } from '../infra/repository/dbMark'
import { UserRepo } from '../infra/repository/dbUser'
import type { bookmarkParsePO, bookmarkPO } from '../infra/repository/dbBookmark'
import { MultiLangError } from '../utils/multiLangError'
import { authToken } from '../middleware/auth'
import { randomUUID } from 'crypto'
import { selectDORegion } from '../utils/location'
import { NotificationMessage } from '../infra/message/notification'
import { Hashid } from '../utils/hashids'

export interface BookmarkDetailResp {
  bookmark_id?: number
  title: string
  alias_title?: string
  host_url: string
  target_url: string
  content_icon: string
  content_cover: string
  content?: string
  content_word_count?: number
  description?: string
  byline?: string
  status: string
  created_at?: Date
  updated_at?: Date
  archived: string
  starred: string
  trashed_at: Date | null
  user_id: number
  marks: markDetail
  tags: BookmarkTag[]
  type: 'shortcut' | 'article'
  overview?: string
}

export interface markDetail {
  mark_list: markInfo[]
  user_list: Record<number, markUserInfo>
}

export type MarkPathItem =
  | {
      type: 'text'
      path: string
      start: number
      end: number
    }
  | {
      type: 'image'
      path: string
    }

export interface addBookmarkReq {
  target_url: string
  target_title: string
  target_icon: string
  taget_cover: string
  content: string
  description: string
  tag: string[]
}

export interface addUrlBookmarkReq {
  target_url: string
  target_title?: string
  thumbnail?: string
  description?: string
  tags: string[]
  is_archive?: boolean
}

export interface userBookmarkExistsResp {
  exists: boolean
  parse_type: number
  bookmark_id?: number
}

export type UpdateParseQueueRetryOptions =
  | { status: bookmarkFetchRetryStatus.PENDING; retryCount?: number }
  | { status: bookmarkFetchRetryStatus.SUCCESS | bookmarkFetchRetryStatus.FAILED }
  | { status: bookmarkFetchRetryStatus.PARSING; retryCount: number }

@injectable()
export class BookmarkService {
  constructor(
    @inject(BookmarkRepo) private bookmarkRepo: BookmarkRepo,
    @inject(BucketClient) private bucket: LazyInstance<BucketClient>,
    @inject(BookmarkSearchRepo) private bookmarkSearchRepo: BookmarkSearchRepo,
    @inject(VectorizeRepo) private dbVectorize: VectorizeRepo,
    @inject(MarkRepo) private markRepo: MarkRepo,
    @inject(UserRepo) private userRepo: UserRepo,
    @inject(QueueClient) private queue: LazyInstance<QueueClient>,
    @inject(NotificationMessage) private notifyMessage: NotificationMessage
  ) {}

  public async createBookmarkBase(options: {
    ctx: ContextManager
    targetUrl: string
    hostUrl: string
    title: string
    type: number
    icon?: string
    cover?: string
    privateUser?: number
    description?: string
    siteName?: string
    isArchive?: boolean
  }) {
    if (options.type === 1) {
      const urlEntity = new URL(options.targetUrl)
      const paths = urlEntity.pathname.split('/')
      if (paths.length !== 3) throw ErrorParam()

      const [_, __, code] = paths
      const res = await this.getShareCodeUsername(code)

      options.siteName = res.username
      options.title = res.title
    }
    const bookmarkPO = {
      title: options.title,
      host_url: options.hostUrl,
      target_url: options.targetUrl,
      content_icon: options.icon ?? '',
      content_cover: options.cover ?? '',
      private_user: options.privateUser ?? 0,
      description: options.description ?? '',
      site_name: options.siteName ?? ''
    }

    const status = options.type === 0 ? queueStatus.PENDING : queueStatus.SUCCESS
    const bmInfo = await this.bookmarkRepo.createBookmark(bookmarkPO, status)
    if (!bmInfo) return null

    if (bmInfo.status === queueStatus.FAILED) {
      // 如果是失败了的状态那就调整成重新解析状态
      await this.bookmarkRepo.updateBookmarkStatus(bmInfo.id, queueStatus.PENDING_RETRY)
    }

    const [_, relation] = await Promise.all([
      this.bookmarkSearchRepo.upsertUserBookmark(options.ctx.getUserId(), bmInfo.id),
      this.bookmarkRepo.createBookmarkRelation(options.ctx.getUserId(), bmInfo.id, options.type, options.isArchive || false)
    ])

    if (relation.deleted_at) {
      await this.trashRevertBookmark(options.ctx, relation.bookmark_id)
    }

    if (relation) {
      // 在数据库中增加收藏添加记录
      try {
        await this.bookmarkRepo.createBookmarkChangeLog(options.ctx.getUserId(), options.targetUrl, relation.bookmark_id, 'add', relation.created_at)
        options.ctx.execution.waitUntil(
          this.notifyMessage.sendBookmarkChange(options.ctx.env, {
            user_id: options.ctx.getUserId(),
            bookmark_id: options.ctx.hashIds.encodeId(relation.bookmark_id),
            created_at: relation.created_at,
            target_url: options.targetUrl,
            action: 'add'
          })
        )
      } catch (e) {
        console.error('create bookmark change log error:', e)
      }
    }

    return bmInfo
  }

  /**
   * 添加收藏
   */
  public async addBookmark(ctx: ContextManager, req: addBookmarkReq) {
    if (!req) throw ErrorParam()

    let { target_url, target_title, target_icon, taget_cover, content, description } = req
    const urlEntity = new URL(target_url)

    // 处理URL
    const urlPolicie = new URLPolicie(ctx.env, urlEntity)
    if (urlPolicie.isBlocked()) throw BlockTargetUrlError()
    target_url = processTargetUrl(urlEntity)

    const privateUser = !urlPolicie.isServerParse() ? ctx.getUserId() : 0
    const lastBm = await this.bookmarkRepo.getBookmark(target_url, privateUser)

    const bmInfo = await this.createBookmarkBase({
      ctx,
      targetUrl: target_url,
      hostUrl: urlEntity.host,
      privateUser: !urlPolicie.isServerParse() ? ctx.getUserId() : 0,
      type: urlPolicie.isUrlShortcut() ? 1 : 0,
      title: lastBm?.title ?? (urlPolicie.isServerParse() ? target_url : target_title),
      icon: lastBm?.content_icon ?? target_icon,
      cover: lastBm?.content_cover ?? taget_cover,
      description: lastBm?.description ?? description
    })
    if (!bmInfo) throw CreateBookmarkFailError()

    // 快捷方式不需要解析
    if (!urlPolicie.isUrlShortcut()) {
      return {
        id: bmInfo.id.toString(),
        info: {
          targetUrl: target_url,
          resource: content,
          userId: ctx.getUserId(),
          parserType: urlPolicie.getParserType(),
          bookmarkId: bmInfo.id,
          callback: callbackType.NOT_CALLBACK,
          ignoreGenerateTag: false,
          privateUser: bmInfo.private_user,
          targetTitle: target_title ?? '',
          skipParse: false
        }
      }
    }

    return bmInfo.id
  }

  public async addUrlBookmarkItem(ctx: ContextManager, item: addUrlBookmarkReq) {
    // 跳过非法的URL
    const target_url = new URL(item.target_url)
    const urlPolicie = new URLPolicie(ctx.env, target_url)
    let ptype = urlPolicie.getParserType()
    if (urlPolicie.isBlocked()) return null

    // 参数处理
    const targetUrl = processTargetUrl(target_url)

    const lastBm = await this.bookmarkRepo.getBookmark(targetUrl, 0)
    const bmInfo = await this.createBookmarkBase({
      ctx,
      targetUrl,
      hostUrl: target_url.host,
      privateUser: 0,
      type: urlPolicie.isUrlShortcut() ? 1 : 0,
      title: lastBm?.title ?? item.target_title ?? targetUrl,
      icon: '',
      cover: lastBm?.content_cover ?? item.thumbnail ?? '',
      description: item.description ?? '',
      isArchive: item.is_archive ?? false
    })

    if (!bmInfo) {
      console.error(`create bookmark failed: ${item.target_url}`)
      return null
    }

    // 创建标签
    for (const tag of item.tags) {
      const tagRes = await this.bookmarkRepo.createUserTag(ctx.getUserId(), tag)
      console.log(`create tag: ${JSON.stringify(tagRes)}`)
      if (!tagRes) continue
      await this.bookmarkRepo.createBookmarkTag(bmInfo.id, ctx.getUserId(), tagRes.id, tag)
    }

    return {
      targetUrl: targetUrl,
      resource: '',
      parserType: ptype === parserType.CLIENT_PARSE ? parserType.SERVER_PUPPETEER_PARSE : ptype,
      userId: ctx.getUserId(),
      bookmarkId: bmInfo.id,
      callback: callbackType.NOT_CALLBACK,
      ignoreGenerateTag: true,
      privateUser: bmInfo.private_user,
      skipParse: item.is_archive || false
    }
  }

  /**
   * 批量添加URL收藏
   */
  public async batchAddUrlBookmark(ctx: ContextManager, req: addUrlBookmarkReq[]) {
    const batchMessage: queueParseMessage[] = []

    for (const item of req) {
      if (!item.target_url || item.target_url === '') continue

      const res = await this.addUrlBookmarkItem(ctx, item)
      if (!res) continue

      batchMessage.push(res)
    }

    return batchMessage
  }

  public async addUrlBookmark(ctx: ContextManager, req: addUrlBookmarkReq, callback: callbackType, callbackPayload: any = {}) {
    if (!req.target_url) throw ErrorParam()

    const target_url = new URL(req.target_url)
    const urlPolicie = new URLPolicie(ctx.env, target_url)

    // 检查URL策略
    let ptype = urlPolicie.getParserType()
    if (urlPolicie.isBlocked()) throw BlockTargetUrlError()
    if (ptype === parserType.CLIENT_PARSE) ptype = parserType.SERVER_PUPPETEER_PARSE

    // 处理URL
    const targetUrl = processTargetUrl(target_url)
    const lastBm = await this.bookmarkRepo.getBookmark(targetUrl, 0)

    // 创建书签
    const bmInfo = await this.createBookmarkBase({
      ctx,
      targetUrl,
      hostUrl: target_url.host,
      privateUser: urlPolicie.isUrlShortcut() ? ctx.getUserId() : 0,
      type: urlPolicie.isUrlShortcut() ? 1 : 0,
      title: lastBm?.title ?? req.target_title ?? targetUrl,
      icon: '',
      cover: lastBm?.content_cover ?? req.thumbnail ?? '',
      description: lastBm?.description ?? req.description ?? ''
    })

    if (!bmInfo) throw CreateBookmarkFailError()

    // 推送队列消息
    if (!urlPolicie.isUrlShortcut()) {
      return {
        id: bmInfo.id.toString(),
        info: {
          targetUrl,
          resource: '',
          parserType: ptype,
          userId: ctx.getUserId(),
          bookmarkId: bmInfo.id,
          callback,
          callbackPayload,
          ignoreGenerateTag: false,
          privateUser: bmInfo.private_user,
          skipParse: false
        }
      }
    }
    return bmInfo.id
  }

  public async getShareCodeUsername(shareCode: string) {
    const share = await this.bookmarkRepo.getBookmarkShareByShareCode(shareCode)
    if (!share) throw BookmarkNotFoundError()

    const getUser = async () => {
      const user = await this.userRepo.getInfoByUserId(share.user_id)
      if (!user) throw UserNotFoundError()
      return user
    }
    const getBookmark = async () => {
      const bm = await this.bookmarkRepo.getBookmarkById(share.bookmark_id)
      if (!bm) throw BookmarkNotFoundError()
      return bm
    }
    const [user, bm] = await Promise.all([getUser(), getBookmark()])

    return { username: user.name, title: bm.title }
  }

  /**
   * 删除收藏（跟移入垃圾箱不同，这个是从表中彻底删除收藏）
   */
  public async deleteBookmark(ctx: ContextManager, userId: number, bmId: number): Promise<string> {
    const bmRepo = this.bookmarkRepo
    const searchRepo = this.bookmarkSearchRepo

    // 删除slax_user_bookmark ， slax_user_bookmark_tag 标签数据
    const deleteUserBookmark = async () => {
      const bmInfo = await bmRepo.getUserBookmarkWithDetail(bmId, userId)
      if (!bmInfo) {
        console.log('delete user bookmark not found:', bmId, ' user:', userId)
        return null
      }

      console.log('delete user bookmark:', bmId, ' user:', userId, ' deleted_at: ', bmInfo.deleted_at, ' id: ', bmInfo.id)

      const deleteDate = new Date()
      const [resErr, _] = await Promise.all([
        bmRepo.deleteUserBookmark(bmId, userId),
        searchRepo.deleteUserBookmark(userId, bmId),
        this.markRepo.deleteByBookmarkId(bmInfo.id),
        bmRepo.createBookmarkChangeLog(userId, bmInfo.bookmark?.target_url ?? '', bmId, 'delete', deleteDate)
      ])

      ctx.execution.waitUntil(
        this.notifyMessage.sendBookmarkChange(ctx.env, {
          user_id: userId,
          bookmark_id: new Hashid(ctx.env, userId).encodeId(bmId),
          created_at: deleteDate,
          target_url: bmInfo.bookmark?.target_url ?? '',
          action: 'delete'
        })
      )

      if (resErr instanceof MultiLangError) {
        console.error('delete user bookmark error:', resErr)
        return resErr
      }
    }

    // 判断是否需要删除slax_bookmark （根据private_user === 用户自己的id）
    // 	- 如果上一步需要删除，根据content_key、content_md_key去R2删除文件
    //  - 删除summary数据
    const deleteBookmarkContentTry = async () => {
      const bmPO = await bmRepo.deleteBookmarkTry(bmId, userId)
      if (!bmPO) {
        console.error('delete bookmark error:', bmPO)
        return null
      }

      if (!bmPO) return null

      try {
        const promiseList = [
          this.bucket().R2Bucket.delete(bmPO.content_key || ''),
          this.bucket().R2Bucket.delete(bmPO.content_md_key || ''),
          this.bookmarkSearchRepo.deleteBookmarkRaw(bmId)
        ]

        const shard = await this.bookmarkRepo.getVectorShard(bmId)
        if (!!shard) {
          promiseList.push(this.dbVectorize.deleteVector(bmId, shard.bucket_idx))
        }
        await Promise.all(promiseList)
      } catch (error) {
        console.log('delete bookmark content key error:', bmPO)
      }
    }

    // 删除share数据
    const deleteBookmarkShareTry = async () => {
      try {
        await bmRepo.deleteBookmarkShare(bmId, userId)
      } catch (error) {
        console.log('delete bookmark share error:', bmId, error)
      }
    }

    await deleteUserBookmark()

    ctx.execution.waitUntil(Promise.allSettled([deleteBookmarkContentTry(), deleteBookmarkShareTry()]))

    return 'ok'
  }

  /** 将收藏丢进垃圾篓  */
  public async trashBookmark(ctx: ContextManager, bmId: number): Promise<string> {
    const bmRepo = this.bookmarkRepo
    const userId = ctx.getUserId()

    await Promise.allSettled([bmRepo.updateBookmarkDeleteAt(bmId, userId, true), bmRepo.updateBookmarkShareIsEnable(bmId, userId, false)])

    return 'ok'
  }

  /** 将收藏移出垃圾篓 */
  public async trashRevertBookmark(ctx: ContextManager, bmId: number): Promise<string> {
    const bmRepo = this.bookmarkRepo

    await Promise.allSettled([bmRepo.updateBookmarkDeleteAt(bmId, ctx.getUserId(), false), bmRepo.updateBookmarkArchiveStatus(bmId, ctx.getUserId(), 0)])

    return 'ok'
  }

  /** 收藏是否存在  */
  public async bookmarkExists(ctx: ContextManager, targetUrl: string) {
    const uUrl = new URL(targetUrl)
    const police = new URLPolicie(ctx.env, uUrl)
    let privateUser = 0
    if (police.isClientParse()) privateUser = ctx.getUserId()
    if (police.isUrlShortcut()) uUrl.searchParams.forEach((value, key) => uUrl.searchParams.delete(key))

    const bmRepo = this.bookmarkRepo
    const res = await bmRepo.getBookmark(uUrl.toString(), privateUser)

    let relatetion
    if (res && res.bookmark_id) relatetion = await bmRepo.getUserBookmark(res.bookmark_id, ctx.getUserId())

    return {
      exists: !!relatetion,
      bookmark_id: !!res?.bookmark_id ? ctx.hashIds.encodeId(res.bookmark_id) : 0,
      parse_type: police.getParserType()
    }
  }

  /** 获取收藏列表 */
  public async bookmarkList(ctx: ContextManager, page: number, size: number, filter: string) {
    return (await this.bookmarkRepo.listUserBookmarks(ctx.getUserId(), (page - 1) * size, size, filter)).map(
      ({ bookmark, alias_title, archive_status, is_starred, deleted_at, type }) => {
        const { private_user, content_md_key, content_key, ...bookmarkWithout } = bookmark!
        return {
          ...bookmarkWithout,
          alias_title,
          id: ctx.hashIds.encodeId(bookmark!.id),
          archived: archive_status === 1 ? 'archive' : archive_status === 2 ? 'later' : 'inbox',
          starred: is_starred ? 'star' : 'unstar',
          trashed_at: !!deleted_at ? deleted_at : undefined,
          type: type === 1 ? 'shortcut' : 'article'
        }
      }
    )
  }

  /** 根据标签ID获取收藏列表 */
  public async bookmarkListByTopic(ctx: ContextManager, page: number, size: number, tagId: number): Promise<bookmarkPO[]> {
    return (await this.bookmarkRepo.listUserBookmarksByTagId(ctx.getUserId(), tagId, (page - 1) * size, size)).map(({ user_bookmark, bookmark }) => {
      const { private_user, content_md_key, content_key, ...bookmarkWithout } = bookmark!
      return {
        ...bookmarkWithout!,
        alias_title: user_bookmark!.alias_title,
        id: ctx.hashIds.encodeId(user_bookmark!.bookmark_id),
        archived: user_bookmark!.archive_status === 1 ? 'archive' : user_bookmark!.archive_status === 2 ? 'later' : 'inbox',
        starred: user_bookmark!.is_starred ? 'star' : 'unstar'
      }
    })
  }

  public async getBookmarkContent(bmKey: string) {
    if (!bmKey) return
    const target = await this.bucket().R2Bucket.get(bmKey)
    if (target) {
      const content = await target.text()
      return content
    }
  }

  public async bookmarkArchive(ctx: ContextManager, bmId: number, status: string) {
    const updateStatus = status === 'archive' ? 1 : status === 'later' ? 2 : 0
    await this.bookmarkRepo.updateBookmarkArchiveStatus(bmId, ctx.getUserId(), updateStatus)
    return null
  }

  public async bookmarkAliasTitle(ctx: ContextManager, bmId: number, alias_title: string) {
    await this.bookmarkRepo.updateBookmarkAliasTitle(bmId, ctx.getUserId(), alias_title)
  }

  public async clearExpiredTrashedBookmarkTask(ctx: ContextManager) {
    // 1. 扫表，扫描需要删除slax_user_bookmark
    // 2. 判断是否需要删除slax_bookmark （根据private_user === 用户自己的id）
    // 	-  如果上一步需要删除，根据content_key、content_md_key去R2删除文件
    // 3. 删除share数据
    // 4. 删除summary数据
    // 5. 删除comment数据
    // 6. 删除slax_user_bookmark_tag标签数据
    // 7. 可选 - 扫描内容中的图片，根据key去真删除
    const bmRepo = this.bookmarkRepo
    const bookmarks = await bmRepo.getExpiredTrashedBookmark()

    for (const bookmark of bookmarks) {
      console.log('clear expired trashed bookmark:', bookmark.bookmark_id, ' user:', bookmark.user_id)
      try {
        await this.deleteBookmark(ctx, bookmark.user_id, bookmark.bookmark_id)
      } catch (error) {
        console.error('clear expired trashed bookmark task failed:', error)
      }
    }
  }

  /**
   * 获取书签总结列表
   */
  public async getBookmarkSummaries(ctx: ContextManager, bmId: number) {
    const bmRepo = this.bookmarkRepo
    const userId = ctx.getUserId()
    const lang = ctx.getlang()

    if (!userId || !bmId || supportedLang.indexOf(lang) === -1) throw ErrorParam()

    const summaries = await bmRepo.getBookmarkSummariesRaw(bmId, lang, userId, 6)
    const selfSummary = summaries.find(summary => summary.user_id === userId)

    return [...(selfSummary ? [selfSummary] : []), ...summaries.filter(summary => summary.user_id !== userId)].map(summary => {
      const { user_id, content, updated_at } = summary

      return {
        content,
        updated_at,
        is_self: user_id === ctx.getUserId()
      }
    })
  }

  /** 获取书签ID */
  public async getBookmarkId(ctx: ContextManager, bmId?: number, shareCode?: string, cbId?: number) {
    if (bmId) return ctx.hashIds.decodeId(bmId)

    if (shareCode) {
      const share = await this.bookmarkRepo.getBookmarkShareByShareCode(shareCode)
      if (!share) return 0
      return share.bookmark_id
    }
    if (cbId) {
      const ubm = await this.bookmarkRepo.getUserBookmarkById(ctx.hashIds.decodeId(cbId))
      if (!ubm) return 0

      return ubm?.bookmark_id
    }

    return 0
  }

  /** 书签添加标签 */
  public async tagBookmark(ctx: ContextManager, userId: number, bmId: number, tags: string[]) {
    const bookmarkRepo = this.bookmarkRepo

    for (const tag of tags) {
      const repoTag = await bookmarkRepo.createUserTag(userId, tag)
      if (!repoTag) continue
      await bookmarkRepo.createBookmarkTag(bmId, userId, repoTag.id, repoTag.tag_name)
    }
  }

  /** 创建书签概述 */
  public async createBookmarkOverview(userId: number, bookmarkId: number, overview: string, content: string) {
    return await this.bookmarkRepo.createBookmarkOverview(userId, bookmarkId, overview, content)
  }

  /** 获取用户书签概述 */
  public async getUserBookmarkOverview(userId: number, bookmarkId: number) {
    return await this.bookmarkRepo.getUserBookmarkOverview(userId, bookmarkId)
  }

  /** 更新书签解析队列重试 */
  public async updateBookmarkParseQueueRetry(bookmarkId: number, userIds: number[], options: UpdateParseQueueRetryOptions) {
    if (options.status === bookmarkFetchRetryStatus.PENDING) {
      if (options.retryCount !== undefined) {
        await Promise.allSettled(userIds.map(userId => this.bookmarkRepo.createBookmarkFetchRetry(bookmarkId, userId, options.retryCount)))
      } else {
        await this.bookmarkRepo.updateBookmarkFetchRetry(bookmarkId, {
          status: bookmarkFetchRetryStatus.PENDING
        })
      }
    } else if (options.status === bookmarkFetchRetryStatus.PARSING) {
      await this.bookmarkRepo.updateBookmarkFetchRetry(bookmarkId, {
        status: bookmarkFetchRetryStatus.PARSING,
        retry_count: options.retryCount,
        last_retry_at: new Date()
      })
    } else if ([bookmarkFetchRetryStatus.SUCCESS, bookmarkFetchRetryStatus.FAILED, bookmarkFetchRetryStatus.PARSING].indexOf(options.status) !== -1) {
      await this.bookmarkRepo.updateBookmarkFetchRetry(bookmarkId, { status: options.status })
    }
  }

  /** 检查并获取需要重试的书签 */
  public async checkAndFetchRetryBookmarks(ctx: ContextManager) {
    const bmRepo = this.bookmarkRepo

    // 找出retry表中，pending状态的书签
    const list = await bmRepo.getFilterBookmarkFetchRetries({ status: bookmarkFetchRetryStatus.PENDING })
    if (!list) {
      return
    }

    const res = list
      .map(item => {
        // 因为存在一个书签多个用户，因此涉及状态（比如重试次数）的变更和获取都给予值最高的那个来处理。
        const userIds = item.user_ids.split(',').map(id => Number(id))
        const retryCounts = item.retry_counts.split(',').map(count => Number(count))
        const maxRetryCount = Math.max(...retryCounts)

        return {
          bookmark_id: item.bookmark_id,
          user_ids: userIds,
          retry_count: maxRetryCount,
          created_at: new Date(item.created_at)
        }
      })
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())

    if (res.length === 0) {
      return
    }

    for (const item of res) {
      const bmInfo = await bmRepo.getBookmarkById(item.bookmark_id)
      if (!bmInfo) {
        await bmRepo.updateBookmarkFetchRetry(item.bookmark_id, { status: bookmarkFetchRetryStatus.FAILED })
        continue
      }

      const target_url = new URL(bmInfo.target_url)
      const urlPolicie = new URLPolicie(ctx.env, target_url)

      if (urlPolicie.isBlocked()) {
        await bmRepo.updateBookmarkFetchRetry(item.bookmark_id, { status: bookmarkFetchRetryStatus.FAILED })
        continue
      }

      const { retry_count, user_ids } = item

      // 更新状态为QUEUEING
      await bmRepo.updateBookmarkFetchRetry(item.bookmark_id, { status: bookmarkFetchRetryStatus.QUEUEING })

      if (!urlPolicie.isUrlShortcut()) {
        await this.queue().pushRetryMessage(ctx, {
          targetUrl: bmInfo.target_url,
          resource: '',
          parserType: parserType.SERVER_PUPPETEER_PARSE,
          bookmarkId: bmInfo.id,
          callback: callbackType.NOT_CALLBACK,
          ignoreGenerateTag: false,
          retry: { retryCount: retry_count, userIds: user_ids }
        })
      }
    }
  }

  /** 检查并覆盖失败的书签 */
  public async checkAndCoverFailBookmark(targetUrl: string, userId: number, privateUser: number) {
    const bmRepo = this.bookmarkRepo

    // 找到用户相同targetUrl下的另外一个书签（如果是公有的就去找它私有的，如果是私有的就去找它公有的）
    const res = await bmRepo.getBookmark(targetUrl, privateUser === 0 ? userId : 0)
    if (!res || !res.bookmark_id || (res.status !== bookmarkParseStatus.FAILED && res.status !== bookmarkParseStatus.PENDING)) return

    await bmRepo.deleteUserBookmark(res.bookmark_id, userId)
  }

  /** 检查并填充公用书签数据 */
  async checkAndFillPublicBookmarkData(ctx: ContextManager, bookmarkId: number, targetUrl: string) {
    const bmRepo = this.bookmarkRepo

    // 根据targetUrl 查看是否有公用的书签
    const publicBookmark = await bmRepo.getBookmark(targetUrl, 0)
    if (!publicBookmark || !publicBookmark.bookmark_id || publicBookmark.status !== bookmarkParseStatus.SUCCESS) return

    // 看看用户是否已经有存了公用书签了
    const publicUserBookmark = await bmRepo.getUserBookmark(publicBookmark.bookmark_id, ctx.getUserId())
    if (publicUserBookmark) return // 已经存在了

    // 找到用户失败的书签
    const userBookmark = await bmRepo.getUserBookmark(bookmarkId, ctx.getUserId())
    if (!userBookmark) return

    // 更新用户书签中的id，指向公用书签
    await bmRepo.updateUserBookmarkBookmarkId(userBookmark.id, publicBookmark.bookmark_id)
  }

  /** 获取书签标题和文本内容 */
  public async getBookmarkTitleAndTextContentTry(bookmarkId: number) {
    const bmRepo = this.bookmarkRepo

    const res = await bmRepo.getBookmarkById(bookmarkId)
    if (!res || res.status !== queueStatus.SUCCESS) {
      return null
    }

    const textContent = await this.getBookmarkContent(res.content_md_key)
    if (!textContent) {
      return null
    }

    return {
      title: res.title,
      textContent
    }
  }

  public async getUserBookmarkWithDetail(userId: number, bmId: number) {
    return (await this.bookmarkRepo.getUserBookmarkWithDetail(bmId, userId)) ?? null
  }

  public async updateBookmarkStarStatus(userId: number, bmId: number, status: boolean) {
    return await this.bookmarkRepo.updateBookmarkStarStatus(bmId, userId, status)
  }

  public async getBookmarkById(bmId: number) {
    return await this.bookmarkRepo.getBookmarkById(bmId)
  }

  public async getUserBookmark(bmId: number, userId: number) {
    return await this.bookmarkRepo.getUserBookmark(bmId, userId)
  }

  public async getUserBookmarkByUUid(uid: string, userId: number) {
    return await this.bookmarkRepo.getUserBookmarkByUId(uid, userId)
  }

  public async updateBookmark(bmId: number, info: bookmarkParsePO) {
    return await this.bookmarkRepo.updateBookmark(bmId, info)
  }

  public async updateBookmarkStatus(bmId: number, status: queueStatus) {
    return await this.bookmarkRepo.updateBookmarkStatus(bmId, status)
  }

  public async getAllBookmarkChangesLog(ctx: ContextManager, userId: number) {
    const res = (await this.bookmarkRepo.getAllBookmarkChanges(userId)) || []

    const logs = res.map(item => ({
      target_url: item.target_url,
      bookmark_id: ctx.hashIds.encodeId(item.bookmark_id)
    }))

    const previous_sync = res.length > 0 ? res[0].created_at.getTime() : null

    return {
      logs,
      ...(previous_sync ? { previous_sync } : {})
    }
  }

  public async getPartialBookmarkChangesLog(ctx: ContextManager, userId: number, time: number) {
    const res = (await this.bookmarkRepo.getPartialBookmarkChanges(userId, time)) || []

    const logs = res.map(item => ({
      target_url: item.target_url,
      bookmark_id: ctx.hashIds.encodeId(item.bookmark_id),
      action: item.action
    }))

    const previous_sync = res.length > 0 ? res[0].created_at.getTime() : null

    return {
      logs,
      ...(previous_sync ? { previous_sync } : {})
    }
  }

  public async connectBookmarkChanges(ctx: ContextManager, request: Request, token: string) {
    await authToken(ctx, token)

    let pushToken = String(randomUUID())
    const headers = new Headers(request.headers)
    const locationHint = selectDORegion(request)
    const doId = ctx.env.WEBSOCKET_SERVER.idFromName('global')
    const stub = ctx.env.WEBSOCKET_SERVER.get(doId, { locationHint })

    headers.set('uuid', pushToken)
    headers.set('region', locationHint)
    headers.set('user_id', ctx.getUserId().toString())
    headers.set('connect_type', 'extensions')
    console.log(`locationHint, user ${ctx.getUserId()} from ${request.cf?.country} match ${locationHint}, push uuid ${pushToken}`)

    return stub
      .fetch(
        new Request(request, {
          headers
        })
      )
      .catch(async (e: any) => {
        pushToken = ''
        console.log('fetch error', e)
        return new Response(null, { status: 500 })
      })
  }

  public async getUserBookmarkSummary(ctx: ContextManager, bmId?: number, shareCode?: string, cbId?: number) {
    const bookmarkId = await this.getBookmarkId(ctx, bmId, shareCode, cbId)
    if (!bookmarkId || bookmarkId < 1) throw ErrorParam()

    return await this.bookmarkRepo.getUserBookmarkSummary(bookmarkId, ctx.getUserId(), ctx.get('ai_lang'))
  }

  public async getUserBookmarkSummaryByMCP(bmId: number, userId: number, lang: string) {
    const bookmark = await this.getBookmarkById(bmId)
    if (!bookmark || bookmark instanceof MultiLangError || !bookmark.content_md_key) {
      throw BookmarkNotFoundError()
    }
    return await this.bookmarkRepo.getUserBookmarkSummary(bmId, userId, lang)
  }

  async saveSummary(ctx: ContextManager, bmId: number, provider: string, content: string, model: string) {
    const info = { content: content, ai_name: provider || '', ai_model: model || '', bookmark_id: bmId, user_id: ctx.getUserId(), lang: ctx.get('ai_lang') }
    await this.bookmarkRepo.upsertBookmarkSummary(info)
  }

  public getQueue(): LazyInstance<QueueClient> {
    return this.queue
  }

  public async getBookmarkTitleContent(
    ctx: ContextManager,
    bmId?: number,
    shareCode?: string,
    cbId?: number,
    title?: string,
    content?: string
  ): Promise<{ title: string; content: string; bmId: number }> {
    if (!bmId && !shareCode && !cbId && !title && !content) throw ErrorParam()

    if (!bmId && !shareCode && !cbId && title && content) {
      return { title, content, bmId: 0 }
    }

    const bookmarkId = await this.getBookmarkId(ctx, bmId, shareCode, cbId)
    if (!bookmarkId || bookmarkId < 1) throw ErrorParam()

    const bookmark = await this.getBookmarkById(bookmarkId)
    if (!bookmark || bookmark instanceof MultiLangError || !bookmark.content_md_key) {
      throw BookmarkNotFoundError()
    }

    const body = await this.getBookmarkContent(bookmark.content_md_key)

    if (!body) throw BookmarkContentNotFoundError()

    return { title: bookmark.title, content: body, bmId: bookmarkId }
  }

  public async getStreamBookmarkContent(ctx: ContextManager, bookmarkUids: string): Promise<ReadableStream> {
    const bookmarks = await this.bookmarkRepo.getBookmarkListByUid(ctx.getUserId(), bookmarkUids)

    const stream = new ReadableStream({
      start: async controller => {
        try {
          if (!bookmarks || bookmarks.length < 1 || !bookmarks[0].content_key) {
            controller.close()
            return
          }

          try {
            const r2Object = await this.bucket().R2Bucket.get(bookmarks[0].content_key)
            if (r2Object && r2Object.body) {
              const reader = r2Object.body.getReader()
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                controller.enqueue(value)
              }
            }
          } catch (error) {
            console.error(`Failed to get content for bookmark ${bookmarks[0].uuid}:`, error)
          }

          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      }
    })

    return stream
  }
}

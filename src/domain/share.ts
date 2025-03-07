import { BookmarkNotFoundError, ErrorParam, ServerError } from '../const/err'
import { ContextManager } from '../utils/context'
import { hashMD5 } from '../utils/strings'
import { BookmarkTag } from './tag'
import { inject, injectable } from '../decorators/di'
import { BookmarkRepo } from '../infra/repository/dbBookmark'

export interface createBookmarkShareResp {
  share_code: string
  show_comment_line: boolean
  show_userinfo: boolean
  allow_action: boolean
}

export interface updateBookmarkShareReq {
  show_comment_line: boolean
  show_userinfo: boolean
  allow_action: boolean
  bookmark_id: number
}

export interface getBookmarkByShareResp {
  byline: string
  content: string
  content_cover: string
  content_icon: string
  content_word_count: number
  created_at: string
  description: string
  host_url: string
  published_at: string
  site_name: string
  target_url: string
  title: string
  share_info: {
    need_login: boolean
    created_at: string
    allow_action: boolean
    share_code: string
  }
  user_info: {
    nick_name: string
    avatar: string
    show_userinfo: boolean
  }
  user_id: number
  tags: BookmarkTag[]
}

@injectable()
export class ShareService {
  constructor(@inject(BookmarkRepo) private bookmarkRepo: BookmarkRepo) {}

  public async checkBookmarkShareExists(ctx: ContextManager, bmId: number): Promise<createBookmarkShareResp> {
    const userId = ctx.getUserId()

    bmId = ctx.hashIds.decodeId(bmId)
    if (bmId < 1) throw ErrorParam()

    const res = await this.bookmarkRepo.getBookmarkShareByBookmarkId(bmId, userId)
    const isEnable = res && res.is_enable
    return {
      allow_action: isEnable ? res.allow_comment : false,
      show_comment_line: isEnable ? res.show_comment : false,
      show_userinfo: isEnable ? res.show_userinfo : false,
      share_code: isEnable ? res.share_code : ''
    }
  }

  public async deleteBookmarkShare(ctx: ContextManager, bmId: number): Promise<undefined> {
    bmId = ctx.hashIds.decodeId(bmId)
    if (bmId < 1) throw ErrorParam()

    await this.bookmarkRepo.updateBookmarkShareIsEnable(bmId, ctx.getUserId(), false)
    return
  }

  public async updateBookmarkShare(ctx: ContextManager, req: updateBookmarkShareReq): Promise<createBookmarkShareResp> {
    const userId = ctx.getUserId()

    const bmId = ctx.hashIds.decodeId(req.bookmark_id)
    if (bmId < 1 || !bmId) throw ErrorParam()

    const bookmark = await this.bookmarkRepo.getUserBookmark(bmId, userId)
    if (!bookmark) throw BookmarkNotFoundError()

    const share = await this.bookmarkRepo.getBookmarkShareByBookmarkId(bmId, userId)

    let res: any
    if (share && share.user_id !== userId) throw BookmarkNotFoundError()
    const updateShare = async () => {
      try {
        res = await this.bookmarkRepo.updateBookmarkShare(bmId, userId, req.show_comment_line, req.show_userinfo, req.allow_action)
      } catch (err) {
        console.log(`update bookmark share failed: ${err}`)
        return BookmarkNotFoundError()
      }
    }
    const createShare = async () => {
      for (let i = 0; i < 3; i++) {
        const timeCode = ctx.hashIds.generateTimeCode()
        const hash = (await hashMD5(`${bmId}-${userId}-${Date.now()}`)).slice(0, 7)
        const code = `${timeCode}${hash}`
        const shareRes = await this.bookmarkRepo.createBookmarkShare(code, userId, bmId, req.show_comment_line, req.show_userinfo, req.allow_action)
        if (!shareRes) throw ServerError()
        res = shareRes
        return
      }
      throw ServerError()
    }
    if (share) {
      await updateShare()
    } else {
      await createShare()
    }

    return {
      allow_action: res.allow_comment,
      show_comment_line: res.show_comment,
      show_userinfo: res.show_userinfo,
      share_code: res.share_code
    }
  }

  public async getBookmarkShareByShareCode(shareCode: string) {
    const res = await this.bookmarkRepo.getBookmarkShareByShareCode(shareCode)
    if (!res || !res.is_enable) throw BookmarkNotFoundError()
    return res
  }
}

import { inject, injectable } from '../../decorators/di'
import { ShareService } from '../share'
import { BookmarkService } from '../bookmark'
import { ContextManager } from '../../utils/context'
import { getBookmarkByShareResp } from '../share'
import { UserService } from '../user'
import { TagService } from '../tag'
import { BookmarkNotFoundError } from '../../const/err'
import { MarkService } from '../mark'
import { markDetail } from '../bookmark'

export interface getInlineShareDetailResp {
  title: string
  target_url: string
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
  marks: markDetail
}

@injectable()
export class ShareOrchestrator {
  constructor(
    @inject(ShareService) private shareService: ShareService,
    @inject(UserService) private userService: UserService,
    @inject(TagService) private tagService: TagService,
    @inject(MarkService) private markService: MarkService,
    @inject(BookmarkService) private bookmarkService: BookmarkService
  ) {}

  public async getInlineShareDetail(ctx: ContextManager, shareCode: string): Promise<getInlineShareDetailResp> {
    const share = await this.shareService.getBookmarkShareByShareCode(shareCode)
    if (!share) throw BookmarkNotFoundError()

    const userBm = await this.bookmarkService.getUserBookmark(share.bookmark_id, share.user_id)
    if (!userBm) throw BookmarkNotFoundError()

    const [userInfo, bookmark, marks] = await Promise.all([
      this.userService.getUserBriefInfo(share.show_userinfo, share.user_id),
      this.bookmarkService.getBookmarkById(share.bookmark_id),
      this.markService.getBookmarkMarkList(ctx, userBm.id, share.show_comment && share.show_line)
    ])
    if (!bookmark) throw BookmarkNotFoundError()

    return {
      title: bookmark.title,
      target_url: bookmark.target_url,
      share_info: {
        need_login: ctx.getUserId() < 1,
        created_at: share.created_at.toISOString(),
        allow_action: share.allow_comment,
        share_code: share.share_code
      },
      user_info: {
        ...userInfo,
        show_userinfo: share.show_userinfo
      },
      marks
    }
  }

  public async getBookmarkByShareCode(ctx: ContextManager, shareCode: string): Promise<getBookmarkByShareResp> {
    const share = await this.shareService.getBookmarkShareByShareCode(shareCode)

    const [userInfo, bookmark, tags] = await Promise.all([
      this.userService.getUserBriefInfo(share.show_userinfo, share.user_id),
      this.bookmarkService.getBookmarkById(share.bookmark_id),
      this.tagService.getBookmarkTags(ctx, share.user_id, share.bookmark_id)
    ])

    if (!bookmark) throw BookmarkNotFoundError()

    const bmContent = await this.bookmarkService.getBookmarkContent(bookmark.content_key)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, private_user, status, ...restProps } = bookmark

    return {
      ...restProps,
      content: bmContent || '',
      created_at: bookmark.created_at.toISOString(),
      published_at: bookmark.published_at.toISOString(),
      share_info: {
        need_login: ctx.getUserId() < 1,
        allow_action: share.allow_comment,
        created_at: share.created_at.toISOString(),
        share_code: share.share_code
      },
      user_info: {
        ...userInfo,
        show_userinfo: share.show_userinfo
      },
      user_id: ctx.hashIds.encodeId(share.user_id),
      tags
    }
  }

  public async getBookmarkShareMarkList(ctx: ContextManager, shareCode: string): Promise<markDetail> {
    const share = await this.shareService.getBookmarkShareByShareCode(shareCode)
    if (!share || !share.is_enable) throw BookmarkNotFoundError()

    const userBm = await this.bookmarkService.getUserBookmark(share.bookmark_id, share.user_id)
    if (!userBm) return { mark_list: [], user_list: [] }
    return await this.markService.getBookmarkMarkList(ctx, userBm.id, share.show_comment && share.show_line)
  }
}

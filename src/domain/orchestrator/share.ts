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

@injectable()
export class ShareOrchestrator {
  constructor(
    @inject(ShareService) private shareService: ShareService,
    @inject(UserService) private userService: UserService,
    @inject(TagService) private tagService: TagService,
    @inject(MarkService) private markService: MarkService,
    @inject(BookmarkService) private bookmarkService: BookmarkService
  ) {}

  public async getBookmarkByShareCode(ctx: ContextManager, shareCode: string): Promise<getBookmarkByShareResp> {
    const share = await this.shareService.getBookmarkShareByShareCode(shareCode)

    const [userInfo, bookmark, tags] = await Promise.all([
      this.userService.getUserBriefInfo(share.show_userinfo, share.user_id),
      this.bookmarkService.getBookmarkById(share.bookmark_id),
      this.tagService.getBookmarkTags(ctx, share.user_id, share.bookmark_id)
    ])

    if (!bookmark) throw BookmarkNotFoundError()

    const bmContent = await this.bookmarkService.getBookmarkContent(bookmark.content_key)
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

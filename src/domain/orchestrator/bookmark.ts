import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { BookmarkNotFoundError, ErrorParam } from '../../const/err'
import { BookmarkService } from '../bookmark'
import { TagService } from '../tag'
import { MarkService } from '../mark'
import { NotificationService } from '../notification'

@injectable()
export class BookmarkOrchestrator {
  constructor(
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(TagService) private tagService: TagService,
    @inject(MarkService) private markService: MarkService,
    @inject(NotificationService) private notificationService: NotificationService
  ) {}

  /** 获取收藏详情 */
  public async bookmarkDetail(ctx: ContextManager, bmId: number) {
    const userId = ctx.getUserId()

    const res = await this.bookmarkService.getUserBookmarkWithDetail(userId, bmId)
    if (!res) throw BookmarkNotFoundError()
    if (res.bookmark.private_user > 0 && res.bookmark.private_user !== userId) throw BookmarkNotFoundError()

    const [contentResult, marksResult, tagsResult] = await Promise.allSettled([
      this.bookmarkService.getBookmarkContent(res.bookmark.content_key),
      this.markService.getBookmarkMarkList(ctx, res.id, true),
      this.tagService.getBookmarkTags(ctx, userId, bmId)
    ])

    // concat return data
    const { id, content_key, content_md_key, private_user, ...bookmarkWithoutId } = res.bookmark
    return {
      ...bookmarkWithoutId,
      bookmark_id: ctx.hashIds.encodeId(res.bookmark.id),
      content: contentResult.status === 'fulfilled' ? contentResult.value : undefined,
      archived: res.archive_status === 1 ? 'archive' : res.archive_status === 2 ? 'later' : 'inbox',
      starred: res.is_starred ? 'star' : 'unstar',
      trashed_at: res.deleted_at,
      marks: marksResult.status === 'fulfilled' ? marksResult.value : { mark_list: [], user_list: {} },
      alias_title: res.alias_title,
      tags: tagsResult.status === 'fulfilled' ? tagsResult.value : [],
      user_id: ctx.hashIds.encodeId(userId),
      type: res.type === 1 ? 'shortcut' : 'article'
    }
  }

  // 书签加星标
  public async bookmarkStar(ctx: ContextManager, bmId: number, status: 'star' | 'unstar') {
    const res = await this.bookmarkService.updateBookmarkStarStatus(ctx.getUserId(), bmId, status === 'star')
  }
}

import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { BookmarkNotFoundError } from '../../const/err'
import { BookmarkService } from '../bookmark'
import { TagService } from '../tag'
import { MarkService } from '../mark'

@injectable()
export class BookmarkOrchestrator {
  constructor(
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(TagService) private tagService: TagService,
    @inject(MarkService) private markService: MarkService
  ) {}

  public async getBookmarkMarkList(ctx: ContextManager, userId: number, bmId: number) {
    const res = await this.bookmarkService.getUserBookmarkWithDetail(userId, bmId)
    if (!res) throw BookmarkNotFoundError()
    if (res.bookmark.private_user > 0 && res.bookmark.private_user !== userId) throw BookmarkNotFoundError()

    const marksResult = await this.markService.getBookmarkMarkList(ctx, res.id, true)
    return marksResult
  }

  public async getBookmarkBriefInfo(ctx: ContextManager, bmId: number) {
    const res = await this.bookmarkService.getUserBookmarkWithDetail(ctx.getUserId(), bmId)
    if (!res) throw BookmarkNotFoundError()
    if (res.bookmark.private_user > 0 && res.bookmark.private_user !== ctx.getUserId()) throw BookmarkNotFoundError()

    const marksResult = await this.markService.getBookmarkMarkList(ctx, res.id, true)
    const { id, content_key, content_md_key, private_user, ...bookmarkWithoutId } = res.bookmark

    return {
      ...bookmarkWithoutId,
      bookmark_id: ctx.hashIds.encodeId(res.bookmark.id),
      archived: res.archive_status === 1 ? 'archive' : res.archive_status === 2 ? 'later' : 'inbox',
      starred: res.is_starred ? 'star' : 'unstar',
      alias_title: res.alias_title,
      marks: marksResult
    }
  }

  /** 获取收藏详情 */
  public async bookmarkDetail(ctx: ContextManager, bmId: number) {
    const userId = ctx.getUserId()

    const res = await this.bookmarkService.getUserBookmarkWithDetail(userId, bmId)
    if (!res) throw BookmarkNotFoundError()
    if (res.bookmark.private_user > 0 && res.bookmark.private_user !== userId) throw BookmarkNotFoundError()

    const [contentResult, marksResult, tagsResult, overviewResult] = await Promise.allSettled([
      this.bookmarkService.getBookmarkContent(res.bookmark.content_key),
      this.markService.getBookmarkMarkList(ctx, res.id, true),
      this.tagService.getBookmarkTags(ctx, userId, bmId),
      this.bookmarkService.getUserBookmarkOverview(userId, bmId)
    ])

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      type: res.type === 1 ? 'shortcut' : 'article',
      overview: overviewResult.status === 'fulfilled' && overviewResult.value ? overviewResult.value.overview : undefined
    }
  }

  // 书签加星标
  public async bookmarkStar(ctx: ContextManager, bmId: number, status: 'star' | 'unstar') {
    return await this.bookmarkService.updateBookmarkStarStatus(ctx.getUserId(), bmId, status === 'star')
  }
}

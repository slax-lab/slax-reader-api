import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { BookmarkNotFoundError } from '../../const/err'
import { BookmarkService } from '../bookmark'
import { TagService } from '../tag'
import { MarkService } from '../mark'
import { MixTagsOverviewResult } from '../aigc'

type BookmarkRow = { id: number; content_key: string; content_md_key: string | null; private_user: number; [key: string]: unknown }

export function stripBookmarkInternals<T extends BookmarkRow>(
  bookmark: T,
  encodeId: (id: number) => number
): Omit<T, 'id' | 'content_key' | 'content_md_key' | 'private_user'> & { bookmark_id: number } {
  const copy = { ...bookmark } as Record<string, unknown>
  const id = copy.id as number
  delete copy.id
  delete copy.content_key
  delete copy.content_md_key
  delete copy.private_user
  copy.bookmark_id = encodeId(id)
  return copy as Omit<T, 'id' | 'content_key' | 'content_md_key' | 'private_user'> & { bookmark_id: number }
}

@injectable()
export class BookmarkOrchestrator {
  constructor(
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(TagService) private tagService: TagService,
    @inject(MarkService) private markService: MarkService
  ) {}

  public async getBookmarkMarkList(ctx: ContextManager, userId: number, bmId: number) {
    const res = await this.bookmarkService.getUserBookmarkWithDetail(userId, bmId)
    if (!res || !res.bookmark) throw BookmarkNotFoundError()
    if (res.bookmark.private_user > 0 && res.bookmark.private_user !== userId) throw BookmarkNotFoundError()

    const marksResult = await this.markService.getBookmarkMarkList(ctx, { id: res.id, isShowMarks: true })
    return marksResult
  }

  public async getBookmarkBriefInfo(ctx: ContextManager, bmId: number) {
    const res = await this.bookmarkService.getUserBookmarkWithDetail(ctx.getUserId(), bmId)
    if (!res || !res.bookmark) throw BookmarkNotFoundError()
    if (res.bookmark.private_user > 0 && res.bookmark.private_user !== ctx.getUserId()) throw BookmarkNotFoundError()

    const [marksResult, overviewResult, tagsResult] = await Promise.allSettled([
      this.markService.getBookmarkMarkList(ctx, { id: res.id, isShowMarks: true }),
      this.bookmarkService.getUserBookmarkOverview(ctx.getUserId(), bmId),
      this.tagService.getBookmarkTags(ctx, ctx.getUserId(), bmId)
    ])
    const { overview, key_takeaways } = this.parseOverviewRes(overviewResult.status === 'fulfilled' ? (overviewResult.value ?? null) : null)
    const base = stripBookmarkInternals(res.bookmark, id => ctx.hashIds.encodeId(id))

    return {
      ...base,
      archived: res.archive_status === 1 ? 'archive' : res.archive_status === 2 ? 'later' : 'inbox',
      starred: res.is_starred ? 'star' : 'unstar',
      alias_title: res.alias_title,
      tags: tagsResult.status === 'fulfilled' ? tagsResult.value : [],
      marks: marksResult.status === 'fulfilled' ? marksResult.value : [],
      overview,
      key_takeaways
    }
  }

  /** 获取收藏详情 */
  public async bookmarkDetail(ctx: ContextManager, bmId: number) {
    const userId = ctx.getUserId()

    const res = await this.bookmarkService.getUserBookmarkWithDetail(userId, bmId)
    if (!res || !res.bookmark) throw BookmarkNotFoundError()
    if (res.bookmark.private_user > 0 && res.bookmark.private_user !== userId) throw BookmarkNotFoundError()

    const [contentResult, marksResult, tagsResult, overviewResult] = await Promise.allSettled([
      this.bookmarkService.getBookmarkContent(res.bookmark.content_key),
      this.markService.getBookmarkMarkList(ctx, { id: res.id, isShowMarks: true }),
      this.tagService.getBookmarkTags(ctx, userId, bmId),
      this.bookmarkService.getUserBookmarkOverview(userId, bmId)
    ])

    const { overview, key_takeaways } = this.parseOverviewRes(overviewResult.status === 'fulfilled' ? (overviewResult.value ?? null) : null)
    const base = stripBookmarkInternals(res.bookmark, id => ctx.hashIds.encodeId(id))

    return {
      ...base,
      content: contentResult.status === 'fulfilled' ? contentResult.value : undefined,
      archived: res.archive_status === 1 ? 'archive' : res.archive_status === 2 ? 'later' : 'inbox',
      starred: res.is_starred ? 'star' : 'unstar',
      trashed_at: res.deleted_at,
      marks: marksResult.status === 'fulfilled' ? marksResult.value : { mark_list: [], user_list: {} },
      alias_title: res.alias_title,
      tags: tagsResult.status === 'fulfilled' ? tagsResult.value : [],
      user_id: ctx.hashIds.encodeId(userId),
      type: res.type === 1 ? 'shortcut' : 'article',
      overview,
      key_takeaways
    }
  }

  // 书签加星标
  public async bookmarkStar(ctx: ContextManager, bmId: number, status: 'star' | 'unstar') {
    return await this.bookmarkService.updateBookmarkStarStatus(ctx.getUserId(), bmId, status === 'star')
  }

  parseOverviewRes(overviewRes: { overview: string; content: string } | null) {
    let overview = ''
    let key_takeaways: string[] = []

    if (overviewRes?.content && overviewRes.content.length > 0) {
      try {
        const overviewContent = JSON.parse(overviewRes.content) as Omit<MixTagsOverviewResult, 'tags'>
        overview = overviewContent.overview
        key_takeaways = overviewContent.key_takeaways
      } catch (e) {
        console.error('Failed to parse overview content:', e)
      }
    } else if (overviewRes?.overview) {
      overview = overviewRes.overview
    }

    return { overview, key_takeaways }
  }
}

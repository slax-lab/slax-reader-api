import { Failed, Successed } from '../../utils/responseUtils'
import { ContextManager } from '../../utils/context'
import { ErrorParam } from '../../const/err'
import { RequestUtils } from '../../utils/requestUtils'
import { callbackType } from '../../infra/queue/queueClient'
import { bookmarkPO } from '../../infra/repository/dbBookmark'
import { Controller } from '../../decorators/controller'
import { Get, Post } from '../../decorators/route'
import { inject } from '../../decorators/di'
import { BookmarkOrchestrator } from '../../domain/orchestrator/bookmark'
import { TagService } from '../../domain/tag'
import { BookmarkService } from '../../domain/bookmark'
import { ImportService } from '../../domain/import'
import { SearchService } from '../../domain/search'
import { addBookmarkReq, addUrlBookmarkReq } from '../../domain/bookmark'
import { UrlParserHandler } from '../../domain/orchestrator/urlParser'

@Controller('/v1/bookmark')
export class BookmarkController {
  constructor(
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(BookmarkOrchestrator) private bookmarkOrchestrator: BookmarkOrchestrator,
    @inject(ImportService) private importService: ImportService,
    @inject(SearchService) private searchService: SearchService,
    @inject(TagService) private tagService: TagService,
    @inject(UrlParserHandler) private urlParserHandler: UrlParserHandler
  ) {}

  /**
   * 新增收藏
   */
  @Post('/add')
  public async handleUserAddBookmarkRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<addBookmarkReq>(request)
    console.log(`user ${ctx.getUserId()} add ${req.target_url} ${req.target_title} bookmark`)

    const res = await this.bookmarkService.addBookmark(ctx, req)
    if (typeof res === 'number') {
      return Successed({ bmId: ctx.hashIds.encodeId(res) })
    } else if (typeof res === 'object') {
      ctx.execution.waitUntil(this.urlParserHandler.processParseMessage(ctx, res))
      return Successed({ bmId: ctx.hashIds.encodeId(res.info.bookmarkId) })
    }
    return Failed(ErrorParam())
  }

  /**
   * 使用URL新增收藏
   */
  @Post('/add_url')
  public async handleUserAddUrlBookmarkRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<addUrlBookmarkReq>(request)

    console.log(`user ${ctx.getUserId()} add ${req.target_url} ${req.target_title} bookmark`)

    const res = await this.bookmarkService.addUrlBookmark(ctx, req, callbackType.NOT_CALLBACK, {})
    if (typeof res === 'number') {
      return Successed({ bmId: ctx.hashIds.encodeId(res) })
    } else if (typeof res === 'object') {
      ctx.execution.waitUntil(this.urlParserHandler.processParseMessage(ctx, res))
      return Successed({ bmId: ctx.hashIds.encodeId(res.info.bookmarkId) })
    }
    return Failed(ErrorParam())
  }

  /**
   * 删除收藏
   */
  @Post('/del')
  public async handleUserDeleteBookmarkRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number }>(request)
    console.log(`user ${ctx.getUserId()} delete ${req.bookmark_id} bookmark`)

    const bmId = ctx.hashIds.decodeId(req.bookmark_id)
    if (bmId < 1) return Failed(ErrorParam())

    const res = await this.bookmarkService.deleteBookmark(ctx, ctx.getUserId(), bmId)
    return Successed(res)
  }

  /**
   * 将收藏丢进垃圾篓
   */
  @Post('/trash')
  public async handleUserTrashBookmarkRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number }>(request)
    console.log(`user ${ctx.getUserId()} trash ${req.bookmark_id} bookmark`)

    const bmId = ctx.hashIds.decodeId(req.bookmark_id)
    if (bmId < 1) return Failed(ErrorParam())

    const res = await this.bookmarkService.trashBookmark(ctx, bmId)
    return Successed(res)
  }

  /**
   * 将收藏移出垃圾篓
   */
  @Post('/trash_revert')
  public async handleUserTrashRevertBookmarkRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number }>(request)
    console.log(`user ${ctx.getUserId()} revert ${req.bookmark_id} bookmark`)

    const bmId = ctx.hashIds.decodeId(req.bookmark_id)
    if (bmId < 1) return Failed(ErrorParam())

    const res = await this.bookmarkService.trashRevertBookmark(ctx, bmId)
    return Successed(res)
  }

  /**
   * 获取收藏列表
   */
  @Get('/list')
  public async handleUserGetBookmarksRequest(ctx: ContextManager, request: Request) {
    const params = await RequestUtils.query<{ page: number; size: number; filter?: string; topic_id?: number; collection_id?: number }>(request)
    if (params.page < 1 || params.size < 1 || params.page === undefined || params.size === undefined) {
      return Failed(ErrorParam())
    }

    let res: bookmarkPO[] = []
    if (params.filter === 'topics') {
      params.topic_id = ctx.hashIds.decodeId(params.topic_id || 0)
      if (params.topic_id < 1) return Failed(ErrorParam())

      res = await this.bookmarkService.bookmarkListByTopic(ctx, Number(params.page), Number(params.size), params.topic_id)
    } else {
      res = await this.bookmarkService.bookmarkList(ctx, Number(params.page), Number(params.size), params.filter || 'all')
    }

    return Successed(res)
  }

  /**
   * 获取收藏详情
   */
  @Get('/detail')
  public async handleUserGetBookmarkDetailRequest(ctx: ContextManager, request: Request) {
    const params = await RequestUtils.query<{ bookmark_id: string }>(request)
    if (!params || !params.bookmark_id) return Failed(ErrorParam())

    const bmId = ctx.hashIds.decodeId(Number(params.bookmark_id))
    if (bmId < 1 || isNaN(bmId)) return Failed(ErrorParam())

    const res = await this.bookmarkOrchestrator.bookmarkDetail(ctx, bmId)
    return Successed(res)
  }

  /**
   * 判断收藏是否存在
   */
  @Post('/exists')
  public async handleUserBookmarkExistsRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ target_url: string }>(request)
    if (!req || !req.target_url) return Failed(ErrorParam())

    const res = await this.bookmarkService.bookmarkExists(ctx, req.target_url)
    return Successed(res)
  }

  /**
   * 内容归档/稍后读
   */
  @Post('/archive')
  public async handleUserBookmarkArchiveRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number; status: 'inbox' | 'archive' | 'later' }>(request)
    if (!req || !req.bookmark_id || !req.status) return Failed(ErrorParam())

    req.bookmark_id = ctx.hashIds.decodeId(req.bookmark_id)
    if (req.bookmark_id < 1) return Failed(ErrorParam())

    await this.bookmarkService.bookmarkArchive(ctx, req.bookmark_id, req.status)
    return Successed(null)
  }

  /**
   * 加星/取消加星
   */
  @Post('/star')
  public async handleUserBookmarkStarRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number; status: 'star' | 'unstar' }>(request)
    if (!req || !req.bookmark_id || !req.status) return Failed(ErrorParam())

    const bmId = ctx.hashIds.decodeId(req.bookmark_id)
    if (bmId < 1) return Failed(ErrorParam())

    await this.bookmarkOrchestrator.bookmarkStar(ctx, bmId, req.status)
    return Successed(null)
  }

  /**
   * 修改别名
   */
  @Post('/alias_title')
  public async handleUserBookmarkAliasTitleRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number; alias_title: string }>(request)
    if (!req || !req.bookmark_id || !req.alias_title) return Failed(ErrorParam())

    const bmId = ctx.hashIds.decodeId(req.bookmark_id)
    if (bmId < 1) return Failed(ErrorParam())

    await this.bookmarkService.bookmarkAliasTitle(ctx, bmId, req.alias_title)
    return Successed(null)
  }

  /**
   * 导入第三方平台书签
   */
  @Post('/import')
  public async handleUserImportBookmarkRequest(ctx: ContextManager, request: Request) {
    const importData = await request.text()
    const query = await RequestUtils.query<{ type: string; file_type: string }>(request)
    if (!query || !query.type || !query.file_type) {
      return Failed(ErrorParam())
    }

    const taskId = await this.importService.importBookmark(ctx, query.type, query.file_type, importData)
    return Successed({ id: ctx.hashIds.encodeId(taskId) })
  }

  /**
   * 获取导入书签状态
   */
  @Get('/import_status')
  public async handleUserImportBookmarkStatusRequest(ctx: ContextManager, request: Request) {
    const taskStatus = await this.importService.getImportInfo(ctx)
    return Successed(taskStatus)
  }

  /**
   * 获取书签对应的ai总结列表数据
   */
  @Get('/summaries')
  public async handleUserBookmarkSummariesRequest(ctx: ContextManager, request: Request) {
    const params = await RequestUtils.query<{ bookmark_id?: number; share_code?: string; cb_id?: number; collection_code?: string }>(request)
    if (!params || (!params.bookmark_id && !params.share_code && !(params.cb_id && params.collection_code))) return Failed(ErrorParam())

    const bmId = await this.bookmarkService.getBookmarkId(ctx, params.bookmark_id, params.share_code, params.cb_id)
    if (!bmId || bmId < 1) return Failed(ErrorParam())

    const res = await this.bookmarkService.getBookmarkSummaries(ctx, bmId)
    return Successed(res)
  }

  /**
   * 搜索书签
   */
  @Post('/search')
  public async handleUserBookmarkSearchRequest(ctx: ContextManager, request: Request) {
    const params = await RequestUtils.json<{ keyword: string }>(request)
    if (!params || !params.keyword) return Failed(ErrorParam())

    const searchResult = await this.searchService.hybridSearch(ctx, params.keyword)
    return Successed(
      searchResult.map(item => {
        item.bookmark_id = ctx.hashIds.encodeId(item.bookmark_id)
        return item
      })
    )
  }

  /**
   * 添加标签
   */
  @Post('/add_tag')
  public async handleUserBookmarkAddTagRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number; tag_name?: string; tag_id?: number }>(request)
    if (!req || !req.bookmark_id) return Failed(ErrorParam())

    req.bookmark_id = ctx.hashIds.decodeId(req.bookmark_id)
    if (!req.bookmark_id) return Failed(ErrorParam())

    const res = await this.tagService.addBookmarkTag(ctx, req.bookmark_id, req.tag_name, req.tag_id)
    return Successed(res)
  }

  /**
   * 删除标签
   */
  @Post('/del_tag')
  public async handleUserBookmarkDelTagRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ bookmark_id: number; tag_id: number }>(request)
    if (!req || !req.bookmark_id || !req.tag_id) return Failed(ErrorParam())

    req.bookmark_id = ctx.hashIds.decodeId(req.bookmark_id)
    req.tag_id = ctx.hashIds.decodeId(req.tag_id)
    if (!req.bookmark_id || !req.tag_id) return Failed(ErrorParam())

    await this.tagService.deleteBookmarkTag(ctx, req.bookmark_id, req.tag_id)
    return Successed(null)
  }

  /**
   * 获取全量书签记录
   */
  @Get('/all_changes')
  public async handleUserGetAllBookmarkChangesRequest(ctx: ContextManager, request: Request) {
    const res = await this.bookmarkService.getAllBookmarkChangesLog(ctx, ctx.getUserId())
    return Successed(res)
  }

  /**
   * 获取增量书签记录
   */
  @Get('/partial_changes')
  public async handleUserGetPartialBookmarkChangesRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.query<{ end_time: number }>(request)

    // 校验end_time的时间戳合法性
    if (!req.end_time || isNaN(req.end_time) || req.end_time < 0) {
      return Failed(ErrorParam())
    }

    const res = await this.bookmarkService.getPartialBookmarkChangesLog(ctx, ctx.getUserId(), Number(req.end_time))
    return Successed(res)
  }
}

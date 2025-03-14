import { ContextManager } from '../../utils/context'
import { corsHeader } from '../../middleware/cors'
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { AigcService, completionQuote } from '../../domain/aigc'
import { ErrorParam } from '../../const/err'
import { inject } from '../../decorators/di'
import { Controller } from '../../decorators/controller'
import { Post } from '../../decorators/route'
import { UserService } from '../../domain/user'
import { BookmarkService } from '../../domain/bookmark'

interface SummaryRequest {
  bmId?: number
  shareCode?: string
  cbId?: number
  collectionCode: string
  force: boolean
}

interface CompletionsRequest {
  bmId?: number
  shareCode?: string
  cbId?: number
  collectionCode: string
  messages: ChatCompletionMessageParam[]
  quote?: completionQuote[]
}

@Controller('/v1/aigc')
export class AigcController {
  constructor(
    @inject(AigcService) private aigcService: AigcService,
    @inject(UserService) private userService: UserService,
    @inject(BookmarkService) private bookmarkService: BookmarkService
  ) {}

  @Post('/summaries')
  public async handleSummariesRequest(ctx: ContextManager, request: Request): Promise<Response> {
    let req: SummaryRequest
    try {
      req = await request.json<SummaryRequest>()
    } catch (err) {
      console.error(`Get summaries failed: ${err}`)
      throw ErrorParam()
    }

    // 校验权限
    if (!req.bmId && !req.shareCode) throw ErrorParam()

    // 设置上下文
    ctx.set('country', request.cf?.country || '')
    ctx.set('continent', request.cf?.continent || '')

    const aiSvc = this.aigcService
    const { readable, writable } = new TransformStream({
      transform: (chunk, controller) => aiSvc.recordChunks(chunk, controller)
    })

    // 拿到bookmark_id
    const bmId = await this.bookmarkService.getBookmarkId(ctx, req.bmId, req.shareCode, req.cbId)
    if (!bmId || bmId < 1) throw ErrorParam()

    ctx.execution.waitUntil(aiSvc.summaryBookmark(ctx, bmId, req.force, writable))

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', ...corsHeader }
    })
  }

  @Post('/chat')
  public async handleCompletionsRequest(ctx: ContextManager, request: Request): Promise<Response> {
    // TODO 拿到CTX中的user_id进行速率限制
    let req: CompletionsRequest
    try {
      req = await request.json<CompletionsRequest>()
    } catch (err) {
      console.error(`Generate question failed: ${err}`)
      throw ErrorParam()
    }

    // 校验权限
    if (!req.bmId && !req.shareCode) throw ErrorParam()

    // 设置上下文
    ctx.set('country', request.cf?.country || '')
    ctx.set('continent', request.cf?.continent || '')

    const aiSvc = this.aigcService
    const { readable, writable } = new TransformStream()
    const bmId = await this.bookmarkService.getBookmarkId(ctx, req.bmId, req.shareCode, req.cbId)
    if (!bmId || bmId < 1) throw ErrorParam()

    ctx.execution.waitUntil(aiSvc.chatBookmark(ctx, bmId, req.messages, writable, req.quote || []))

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', ...corsHeader }
    })
  }
}

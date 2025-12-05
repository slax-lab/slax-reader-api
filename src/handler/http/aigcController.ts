import { ContextManager } from '../../utils/context'
import { corsHeader } from '../../middleware/cors'
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { AigcService, completionQuote } from '../../domain/aigc'
import { inject } from '../../decorators/di'
import { Controller } from '../../decorators/controller'
import { Post } from '../../decorators/route'
import { UserService } from '../../domain/user'
import { BookmarkService } from '../../domain/bookmark'
import { RequestUtils } from '../../utils/requestUtils'
import { convertToCore } from '../../utils/ai'

type SummaryRequest = {
  bm_id?: number
  share_code?: string
  cb_id?: number
  collection_code: string
  force: boolean
  raw_content?: string
}

type CompletionsRequest = {
  bm_id?: number
  share_code?: string
  cb_id?: number
  collection_code?: string
  title?: string
  raw_content?: string
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
    const req = await RequestUtils.json<SummaryRequest>(request)

    const aiSvc = this.aigcService
    const { readable, writable } = new TransformStream({
      transform: (chunk, controller) => aiSvc.recordChunks(chunk, controller)
    })

    const user = await this.userService.getUserInfo(ctx)
    ctx.set('ai_lang', user.ai_lang || user.lang?.slice(0, 2) || 'en')
    ctx.set('country', request.cf?.country || '')
    ctx.set('continent', request.cf?.continent || '')

    if (!req.force && req.bm_id) {
      const summary = await this.bookmarkService.getUserBookmarkSummary(ctx, {
        bmId: req.bm_id,
        shareCode: req.share_code,
        cbId: req.cb_id
      })

      if (summary) {
        await writable.getWriter().write(summary)
        return new Response(readable, {
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8', ...corsHeader }
        })
      }
    }

    const { title, content, bmId } = await this.bookmarkService.getBookmarkTitleContent(ctx, req.bm_id, req.share_code, req.cb_id, 'no title', req.raw_content)
    ctx.execution.waitUntil(
      aiSvc.bookmarkSummary(ctx, content, writable, async result => {
        bmId > 0 && (await this.bookmarkService.saveSummary(ctx, bmId, result.provider, result.response, result.model))
      })
    )

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', ...corsHeader }
    })
  }

  @Post('/chat')
  public async handleCompletionsRequest(ctx: ContextManager, request: Request): Promise<Response> {
    // TODO 拿到CTX中的user_id进行速率限制
    const req = await RequestUtils.json<CompletionsRequest>(request)

    const [user, { title, content, bmId }] = await Promise.all([
      this.userService.getUserInfo(ctx),
      this.bookmarkService.getBookmarkTitleContent(ctx, req.bm_id, req.share_code, req.cb_id, req.title, req.raw_content)
    ])

    // 设置上下文
    ctx.set('req_url', request.url)
    ctx.set('req_auth', request.headers.get('Authorization') || '')
    ctx.set('country', request.cf?.country || '')
    ctx.set('continent', request.cf?.continent || '')
    ctx.set('ai_lang', user.ai_lang || user.lang?.slice(0, 2) || 'en')
    ctx.set('bm_id', bmId)

    const aiSvc = this.aigcService
    const { readable, writable } = new TransformStream()
    ctx.execution.waitUntil(aiSvc.bookmarkChat(ctx, title, content, convertToCore(req.messages), writable, req.quote || []))

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', ...corsHeader }
    })
  }
}

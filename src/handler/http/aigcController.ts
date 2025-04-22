import { ContextManager } from '../../utils/context'
import { corsHeader } from '../../middleware/cors'
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { AigcService, completionQuote } from '../../domain/aigc'
import { BookmarkContentNotFoundError, BookmarkNotFoundError, ErrorParam } from '../../const/err'
import { inject } from '../../decorators/di'
import { Controller } from '../../decorators/controller'
import { Post } from '../../decorators/route'
import { UserService } from '../../domain/user'
import { BookmarkService } from '../../domain/bookmark'
import { MultiLangError } from '../../utils/multiLangError'

type SummaryRequest =
  | {
      bmId?: number
      shareCode?: string
      cbId?: number
      collectionCode: string
      force: boolean
    }
  | {
      raw_content: string
    }

type CompletionsRequest = (
  | {
      bmId?: number
      shareCode?: string
      cbId?: number
      collectionCode?: string
    }
  | { title: string; raw_content: string }
) & {
  messages: ChatCompletionMessageParam[]
  quote?: completionQuote[]
}

interface RawContentSummaryRequest {
  raw_content: string
  collectionCode: string
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

    let rawContent = ''

    const aiSvc = this.aigcService
    const { readable, writable } = new TransformStream({
      transform: (chunk, controller) => aiSvc.recordChunks(chunk, controller)
    })

    let tasks: Promise<unknown>[] = []

    // 校验权限
    if ('raw_content' in req) {
      if (!req.raw_content) throw ErrorParam()

      rawContent = req.raw_content

      tasks.push(aiSvc.summaryRawContent(ctx, rawContent, writable))
    } else {
      if (!req.bmId && !req.shareCode && !req.cbId) throw ErrorParam()

      const bmId = await this.bookmarkService.getBookmarkId(ctx, req.bmId, req.shareCode, req.cbId)
      if (!bmId || bmId < 1) throw ErrorParam()

      const bookmark = await this.bookmarkService.getBookmarkById(bmId)
      if (!bookmark || bookmark instanceof MultiLangError || !bookmark.content_md_key) {
        throw BookmarkNotFoundError()
      }

      const content = await this.bookmarkService.getBookmarkContent(bookmark.content_md_key)
      if (!content) throw BookmarkContentNotFoundError()

      rawContent = content || ''

      if (!req.force) {
        const summary = await this.bookmarkService.getUserBookmarkSummary(bmId, ctx.getUserId(), ctx.getlang())
        if (summary && !(summary instanceof MultiLangError)) {
          tasks.push(writable.getWriter().write(summary))
        } else {
          tasks.push(
            aiSvc.summaryRawContent(ctx, rawContent, writable, async result => {
              await this.bookmarkService.saveSummary(bmId, ctx.getUserId(), ctx.getlang(), result.provider, result.response, result.model)
            })
          )
        }
      } else {
        tasks.push(
          aiSvc.summaryRawContent(ctx, rawContent, writable, async result => {
            await this.bookmarkService.saveSummary(bmId, ctx.getUserId(), ctx.getlang(), result.provider, result.response, result.model)
          })
        )
      }
    }

    // 设置上下文
    ctx.set('country', request.cf?.country || '')
    ctx.set('continent', request.cf?.continent || '')

    if (tasks.length > 0) {
      ctx.execution.waitUntil(Promise.all(tasks))
    }

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

    let title = ''
    let rawContent = ''

    // 校验权限
    if ('title' in req) {
      if (!req.title || !req.raw_content) throw ErrorParam()

      title = req.title
      rawContent = req.raw_content
    } else {
      if (!req.bmId && !req.shareCode && !req.cbId) throw ErrorParam()

      const bmId = await this.bookmarkService.getBookmarkId(ctx, req.bmId, req.shareCode, req.cbId)
      if (!bmId || bmId < 1) throw ErrorParam()

      const bookmark = await this.bookmarkService.getBookmarkById(bmId)
      if (!bookmark || bookmark instanceof MultiLangError || !bookmark.content_md_key) {
        throw BookmarkNotFoundError()
      }

      const content = await this.bookmarkService.getBookmarkContent(bookmark.content_md_key)
      if (!content) throw BookmarkContentNotFoundError()

      title = bookmark.title
      rawContent = content
    }

    // 设置上下文
    ctx.set('country', request.cf?.country || '')
    ctx.set('continent', request.cf?.continent || '')

    const aiSvc = this.aigcService
    const { readable, writable } = new TransformStream()
    ctx.execution.waitUntil(aiSvc.chatRawContent(ctx, title, rawContent, req.messages, writable, req.quote || []))

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', ...corsHeader }
    })
  }
}

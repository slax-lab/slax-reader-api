import { CoreAssistantMessage, CoreMessage, CoreUserMessage, ToolCallPart, tool } from 'ai'
import { z } from 'zod'
import {
  generateQuestionPrompt,
  systemPrompt,
  userChatBookmarkSystemPrompt,
  getUserChatBookmarkUserPrompt,
  generateRelatedTagPrompt,
  generateOverviewTagsPrompt,
  generateOverviewTagsUserPrompt
} from '../const/prompt'
import { ContextManager } from '../utils/context'
import { GoogleSearch } from '../infra/external/searchGoogle'
import { ContentParser } from '../utils/parser'
import { systemTag } from '../const/systemTag'
import { inject, injectable } from '../decorators/di'
import type { LazyInstance } from '../decorators/lazy'
import { BucketClient } from '../infra/repository/bucketClient'
import { MultiLangError } from '../utils/multiLangError'
import { CHAT_COMPLETION } from '../const/symbol'
import { AppChatCompletion } from '../di/data'
import { SlaxFetch } from '../infra/external/remoteFetcher'
import { BookmarkRepo } from '../infra/repository/dbBookmark'

export type deltaType = {
  role?: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  function_call?: { name: string; arguments: string }
  name?: string
  tool_call_id?: string
}

export type completionQuote = {
  type: 'text' | 'image'
  content: string
}

export enum toolStatus {
  PROCESSING = 'processing',
  SUCCESSFULLY = 'finished_successfully',
  FAILED = 'finished_failed'
}

export type MixTagsOverviewResult = {
  tags: string[]
  overview: string
}

@injectable()
export class AigcService {
  private chunks: Uint8Array[] = []
  private ted = new TextEncoder()
  private wr!: WritableStreamDefaultWriter<Uint8Array>

  static target = '<relatedQuestionStart>'

  constructor(
    @inject(CHAT_COMPLETION) private aigc: LazyInstance<AppChatCompletion>,
    @inject(BucketClient) private bucket: LazyInstance<BucketClient>,
    @inject(BookmarkRepo) private bookmarkRepo: BookmarkRepo
  ) {}

  async recordChunks(chunk: Uint8Array, controller: TransformStreamDefaultController<Uint8Array>) {
    this.chunks.push(chunk)
    controller.enqueue(chunk)
  }

  public async writeDone() {
    await this.wr.write(this.ted.encode('data: [DONE]'))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isToolCallPart(part: any): part is ToolCallPart {
    return part.type === 'tool-call'
  }

  private isToolCall(message: CoreMessage): message is CoreAssistantMessage {
    return message.role === 'assistant' && Array.isArray(message.content) && message.content.length > 0 && message.content.every(part => this.isToolCallPart(part))
  }

  public async writeChunk(delta: deltaType[], status: string | null = null, finishReason: string | null = null) {
    const chunk = {
      id: `slax-chat-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'slax-4o',
      choices: [{ index: 0, delta, status, finish_reason: finishReason }]
    }
    await this.wr.write(this.ted.encode(`data: ${JSON.stringify(chunk)}\n\n`))
  }

  public async writeProgress(
    role: 'system' | 'user' | 'assistant' | 'tool',
    name: string | undefined = undefined,
    content: string | undefined = undefined,
    status: string | undefined = undefined,
    finishReason: string | undefined = undefined
  ) {
    await this.writeChunk([{ role, name, content }], status, finishReason)
  }

  /** LLM Detail Bookmark Tool */
  public async chatToolDetailBookmark(ctx: ContextManager, args: { bookmark_id: number }) {
    const bmId = ctx.hashIds.decodeId(args.bookmark_id)

    const bookmark = await this.bookmarkRepo.getBookmarkById(bmId)
    if (!bookmark) return 'Bookmark not found'
    if (!bookmark.content_md_key) return 'Bookmark content not found'

    const content = await this.bucket().R2Bucket.get(bookmark.content_md_key)
    if (!content) return 'Bookmark content not found'

    return {
      title: bookmark.title,
      content: content,
      bookmark_id: bookmark.id
    }
  }

  /** LLM Browser Tool */
  public async chatToolBrowser(env: Env, args: { title: string; url: string }) {
    await this.writeProgress('tool', 'browser', args.title, toolStatus.PROCESSING)

    const fetchUrl = async () => {
      const fetcher = new SlaxFetch(env)
      const result = await fetcher.headless(args.url, 'Asia/Hong_Kong')
      const content = await ContentParser.parse({ url: new URL(args.url), content: result.content, title: args.title })

      this.writeProgress('tool', 'browser', args.title, toolStatus.SUCCESSFULLY)
      return content.textContent
    }

    try {
      // max 10s timeout
      return await Promise.race([fetchUrl(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))])
    } catch (e) {
      console.log(`fetch failed: ${e as Error}`)
      await this.writeProgress('tool', 'browser', args.title, toolStatus.FAILED)
      return `fetch failed, please use your knowledge to answer the question`
    }
  }

  /** LLM Search Tool */
  public async chatToolSeach(env: Env, args: { q: string }) {
    await this.writeProgress('tool', 'search', args.q, toolStatus.PROCESSING)
    const res = await new GoogleSearch(env).search(args.q)
    if (res instanceof MultiLangError) {
      console.log(`chat tool search search failed: ${res.message}`)
      await this.writeProgress('tool', 'search', '', toolStatus.FAILED)
      return `search failed, please use your knowledge to answer the question.`
    }
    await this.writeProgress('tool', 'search', JSON.stringify(res), toolStatus.SUCCESSFULLY)
    return res.map(item => {
      return {
        source: item.url,
        title: item.title,
        snippet: item.content
      }
    })
  }

  /** LLM Search bookmark tool */
  public async chatToolSearchBookmark(ctx: ContextManager, args: { q: string }) {
    // HOOK: Due to hierarchical issues
    // It is not possible to use the search method directly
    // But we can to call the HTTP request first.
    this.writeProgress('tool', 'searchBookmark', args.q, toolStatus.PROCESSING)

    const url = ctx.get('req_url')
    const auth = ctx.get('req_auth')
    if (!url) {
      await this.writeProgress('tool', 'searchBookmark', args.q, toolStatus.FAILED)
      return 'Search fail, context no found.'
    }
    const urlObj = new URL(url)
    urlObj.pathname = '/v1/bookmark/search'

    const res = await fetch(urlObj.toString(), {
      method: 'POST',
      headers: {
        Authorization: auth
      },
      body: JSON.stringify({ keyword: args.q })
    })

    if (!res.ok) {
      await this.writeProgress('tool', 'searchBookmark', args.q, toolStatus.FAILED)
      const body = await res.text()
      return `Search fail, ${body}`
    }

    const data = await res.json<{ code: number; message: string; data: { title: string; content: string; bookmark_id: number }[] }>()
    await this.writeProgress('tool', 'searchBookmark', JSON.stringify(data), toolStatus.SUCCESSFULLY)
    return data
  }

  /** Chat with bookmark */
  public async chatRawContentText(ctx: ContextManager, rawContent: string, content: string, messages: CoreMessage[], quote: completionQuote[]) {
    if (!rawContent) return await this.writeChunk([{ role: 'assistant', content: 'No Content' }])

    messages.pop()
    const model = this.aigc().hasOrDefaultModel(ctx.get('ai_chat_model'))
    const systemMessage = userChatBookmarkSystemPrompt.replace('{article}', rawContent)
    const userContent = getUserChatBookmarkUserPrompt().replace('{content}', content).replace('{ai_lang}', ctx.get('ai_lang'))
    const quoteMessage: CoreUserMessage[] = quote.map(item => {
      if (item.type === 'text') {
        return { role: 'user', content: item.content }
      } else {
        return {
          role: 'user',
          content: [{ type: 'image', image: new URL(item.content) }]
        }
      }
    })

    messages.push({ role: 'system', content: systemMessage })
    messages.push(...quoteMessage, { role: 'user', content: userContent })

    const tools = {
      search: tool({
        description: 'Search for information in network',
        parameters: z.object({
          q: z.string().describe('Search query')
        }),
        execute: this.chatToolSeach.bind(this, ctx.env)
      }),
      searchBookmark: tool({
        description: 'Search for user bookmarks in database',
        parameters: z.object({
          q: z.string().describe('Search query')
        }),
        execute: this.chatToolSearchBookmark.bind(this, ctx)
      }),
      getBookmarkDetail: tool({
        description: 'Get bookmark detail by bookmark id',
        parameters: z.object({
          bookmark_id: z.number().describe('Bookmark ID')
        }),
        execute: this.chatToolDetailBookmark.bind(this, ctx)
      }),
      browser: tool({
        description: 'Browse a web page by url',
        parameters: z.object({
          title: z.string().describe('Page title'),
          url: z.string().describe('URL to browse')
        }),
        execute: this.chatToolBrowser.bind(this, ctx.env)
      }),
      relatedQuestion: tool({
        description: 'Generate related questions',
        parameters: z.object({
          question: z.string().describe('Related question to generate')
        }),
        execute: async (args: { question: string }) => {
          console.log('relatedQuestion', args.question)
          await this.writeProgress('tool', 'relatedQuestion', args.question, toolStatus.SUCCESSFULLY)
          return `Generated related question: ${args.question}`
        }
      })
    }
    //
    let buffer = ''
    let matchIndex = 0

    let outputDone = false

    const callback = async (chunk: string | MultiLangError) => {
      if (chunk instanceof MultiLangError) return await this.writeChunk([{ role: 'assistant', content: chunk.message }])
      if (outputDone) return

      for (const char of chunk) {
        if (char === AigcService.target[matchIndex]) {
          buffer += char
          matchIndex++
          if (matchIndex === AigcService.target.length) {
            outputDone = true
            return
          }
        } else {
          if (matchIndex > 0) {
            await this.writeChunk([{ role: 'assistant', content: buffer + char }])
            buffer = ''
            matchIndex = 0
          } else {
            await this.writeChunk([{ role: 'assistant', content: char }])
          }
        }
      }
    }

    try {
      await this.aigc().streamText(messages, callback, { tools, models: [model] })
    } catch (error) {
      console.error('StreamText error:', error)
      throw error
    }

    if (buffer && !outputDone) await this.writeChunk([{ role: 'assistant', content: buffer }])

    await this.writeProgress('assistant', 'chat', undefined, 'completed')
    await this.writeDone()
  }

  /** LLM Tool: Generate Question */
  public async chatToolGenerateRawContentQuestion(ctx: ContextManager, title: string) {
    if (!title) return this.writeChunk([{ role: 'assistant', content: 'No raw content' }])

    const messages: CoreMessage[] = [
      { role: 'system', content: generateQuestionPrompt.replace('{ai_lang}', ctx.get('ai_lang')) },
      { role: 'user', content: title }
    ]

    let buffer: string = ''
    const model = this.aigc().hasOrDefaultModel(ctx.get('ai_chat_model'))

    const callback = async (chunk: string | MultiLangError) => {
      if (chunk instanceof MultiLangError) return this.writeChunk([{ role: 'assistant', content: chunk.message }])

      if (chunk.endsWith('\n') && buffer.length > 0) {
        buffer = buffer.concat(chunk)
        await this.writeProgress('tool', 'generateQuestion', JSON.stringify([buffer]), toolStatus.SUCCESSFULLY)
        buffer = ''
        return
      }
      if (chunk.startsWith('-') || buffer.length > 0) {
        buffer = buffer.concat(chunk)
      }
    }

    // 给前端一个提示
    await this.writeProgress('tool', 'generateQuestion', undefined, toolStatus.PROCESSING)

    // 调用GPT-4o生成问题
    await this.aigc().streamText(messages, callback, {
      models: [model]
    })

    // 如果buffer还有内容，则直接输出
    if (buffer) await this.writeProgress('tool', 'generateQuestion', JSON.stringify([buffer]), toolStatus.SUCCESSFULLY)

    await this.writeDone()
  }

  // Generate tags from system tag list
  public async generateTagsFromPresupposition(bmTitle: string, bmContent: string): Promise<string[]> {
    const messages: CoreMessage[] = [
      { role: 'system', content: generateRelatedTagPrompt },
      { role: 'user', content: `title: ${bmTitle}\n content: ${bmContent.slice(0, 200)}` }
    ]

    const result = await this.aigc().generateText(messages)

    const tags = result.text
      .split('\n')
      .filter(t => systemTag.has(t))
      .filter(tag => tag.length >= 1)

    console.log(`generate tags: ${tags}`)
    return tags
  }

  // Generate tags from user tags
  public async generateOverviewTags(ctx: ContextManager, bmTitle: string, bmContent: string, bmByline: string, userTags: string[]): Promise<MixTagsOverviewResult> {
    const userLang = ctx.get('ai_lang') || 'EN'
    const model = this.aigc().hasOrDefaultModel(ctx.get('ai_tag_model'))

    const messages: CoreMessage[] = [
      {
        role: 'system',
        content: generateOverviewTagsPrompt(bmTitle, bmContent, bmByline)
      },
      {
        role: 'system',
        content: generateOverviewTagsUserPrompt(userLang, userTags)
      }
    ]

    const result = await this.aigc().generateText(messages, { models: [model, 'gpt-4o-mini'] })

    const overviewMatch = result.text.match(/<OVERVIEW>(.*?)<\/OVERVIEW>/s)
    const overview = overviewMatch ? overviewMatch[1].trim() : ''

    const tagsMatches = result.text.matchAll(/<TAGS>(.*?)<\/TAGS>/g)
    const tags = [...tagsMatches].map(match => match[1].trim())

    console.log(`${model} generate overview tags result: ${result.text}`)
    console.log(`generate overview tags: ${overview}`)
    console.log(`generate overview tags: ${tags}`)

    return { tags, overview }
  }

  // chat with bookmark
  public async bookmarkChat(ctx: ContextManager, title: string, rawContent: string, messages: CoreMessage[], writer: WritableStream<Uint8Array>, quote: completionQuote[]) {
    this.wr = writer.getWriter()
    const latestMessageIdx = messages.length - 1

    if (messages.length < 1) return this.wr.write(this.ted.encode('Invalid request\n'))

    // just process the latest message
    const latestMessage = messages[latestMessageIdx]
    const isToolCall = this.isToolCall(latestMessage)
    const content = typeof latestMessage.content === 'string' ? latestMessage.content : ''

    try {
      if (!isToolCall) return await this.chatRawContentText(ctx, rawContent, content, messages, quote)
      if (!this.isToolCallPart(latestMessage.content[0])) return this.wr.write(this.ted.encode('Invalid request\n'))

      switch (latestMessage.content[0].toolName) {
        case 'generateQuestion':
          return await this.chatToolGenerateRawContentQuestion(ctx, title)
        default:
          return this.wr.write(this.ted.encode('Invalid request\n'))
      }
    } catch (err) {
      console.error(err)
      this.writeChunk([{ role: 'assistant', content: 'Failed to generate question, please try again later.\n' }])
    } finally {
      this.wr.close()
    }
  }

  // generate bookmark summary
  public async bookmarkSummary(
    ctx: ContextManager,
    rawContent: string,
    writer: WritableStream<Uint8Array>,
    callbackHandler?: (result: { provider: string; model: string; response: string }) => Promise<void>
  ) {
    let providerInfo
    this.wr = writer.getWriter()
    const model = this.aigc().hasOrDefaultModel(ctx.get('ai_chat_model'))

    try {
      const callback = async (chunk: string | MultiLangError) => {
        if (chunk instanceof MultiLangError) return this.wr.write(this.ted.encode(chunk.message))
        await this.wr.write(this.ted.encode(chunk))
      }

      const prompt = systemPrompt.replace('{ai_lang}', ctx.get('ai_lang'))
      const messages: CoreMessage[] = [
        { role: 'system', content: prompt },
        { role: 'user', content: rawContent }
      ]

      providerInfo = await this.aigc().streamText(messages, callback, { models: [model] })
    } catch (error) {
      console.error(error)
      this.wr.write(this.ted.encode(error instanceof MultiLangError ? error.message : 'Failed to get summary, please try again later.\n'))
    } finally {
      this.wr.close()

      if (!callbackHandler || !this.chunks || !providerInfo) return

      const blob = new Blob(this.chunks)

      await callbackHandler({
        provider: providerInfo?.model || '',
        model: providerInfo?.model || '',
        response: await blob.text()
      })
    }
  }
}

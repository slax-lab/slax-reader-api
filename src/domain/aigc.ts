import OpenAI from 'openai'

import {
  generateAnswerPrompt,
  generateQuestionPrompt,
  systemPrompt,
  generateUserAnserPrompt,
  userChatBookmarkSystemPrompt,
  getUserChatBookmarkUserPrompt,
  generateRelatedTagPrompt
} from '../const/prompt'
import { ContextManager } from '../utils/context'
import { ChatCompletionMessageToolCall, ChatCompletionMessageParam, ChatCompletionContentPart } from 'openai/resources/chat/completions'
import { GoogleSearch } from '../infra/external/searchGoogle'
import { ContentParser } from '../utils/parser'
import { systemTag } from '../const/systemTag'
import { inject, injectable } from '../decorators/di'
import type { LazyInstance } from '../decorators/lazy'
import { ChatCompletion } from '../infra/external/chatCompletion'
import { BucketClient } from '../infra/repository/bucketClient'
import { MultiLangError } from '../utils/multiLangError'

export type deltaType = {
  role?: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  function_call?: { name: string; arguments: string }
  tool_calls?: ChatCompletionMessageToolCall[]
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

@injectable()
export class AigcService {
  private chunks: Uint8Array[] = []
  private ted = new TextEncoder()
  private wr!: WritableStreamDefaultWriter<Uint8Array>

  static target = '<relatedQuestionStart>'

  constructor(
    @inject(ChatCompletion) private aigc: LazyInstance<ChatCompletion>,
    @inject(BucketClient) private bucket: LazyInstance<BucketClient>
  ) {}

  async recordChunks(chunk: Uint8Array, controller: TransformStreamDefaultController<any>) {
    this.chunks.push(chunk)
    controller.enqueue(chunk)
  }

  private isToolCallMessage(message: ChatCompletionMessageParam): message is OpenAI.Chat.ChatCompletionUserMessageParam & { tool_calls: ChatCompletionMessageToolCall[] } {
    return message.role === 'assistant' && 'tool_calls' in message
  }

  private async writeDone() {
    await this.wr.write(this.ted.encode('data: [DONE]'))
  }

  private async writeChunk(delta: deltaType[], status: string | null = null, finishReason: string | null = null) {
    const chunk = {
      id: `slax-chat-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'slax-4o',
      choices: [{ index: 0, delta, status, finish_reason: finishReason }]
    }
    await this.wr.write(this.ted.encode(`data: ${JSON.stringify(chunk)}\n\n`))
  }

  private async writeProgress(
    role: 'system' | 'user' | 'assistant' | 'tool',
    name: string | undefined = undefined,
    content: string | undefined = undefined,
    status: string | undefined = undefined,
    finishReason: string | undefined = undefined
  ) {
    await this.writeChunk([{ role, name, content }], status, finishReason)
  }

  /** GPT 4o 浏览器工具 */
  private async chatToolBrowser(args: { title: string; url: string }) {
    console.log(`chat tool browser fetching: ${args.url}`)

    let response: Response | null = null
    const controller = new AbortController()
    let status: toolStatus = toolStatus.FAILED
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const headers = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    await this.writeProgress('tool', 'browser', args.title, toolStatus.PROCESSING)

    try {
      response = (await fetch(args.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': headers,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
      })) as Response
      if (!response.ok) return 'fetch failed, please use your knowledge to answer the question.'
      //
      const content = await ContentParser.parse({ url: new URL(args.url), content: await response.text(), title: args.title })
      if (content instanceof Error) return 'fetch success, buf parse content failed, please use your knowledge to answer the question.'

      status = toolStatus.SUCCESSFULLY
      return content.textContent
    } catch (e) {
      console.log(`fetch failed: ${e as Error}`)
      return `fetch failed, please use your knowledge to answer the question`
    } finally {
      clearTimeout(timeoutId)
      await this.writeProgress('tool', 'browser', '', status)
    }
  }

  /** GPT 4o 搜索工具 */
  private async chatToolSeach(env: Env, args: { q: string }) {
    console.log(`chat tool search searching: ${args.q}`)
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

  async generateTags(ctx: ContextManager, env: Env, bmTitle: string, bmContent: string) {
    let buffer = ''
    let isErr = false

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: generateRelatedTagPrompt },
      { role: 'user', content: `title: ${bmTitle}\n content: ${bmContent.slice(0, 200)}` }
    ]

    await this.aigc().universal(ctx, messages, async (chunk: string | MultiLangError) => {
      if (chunk instanceof MultiLangError || isErr) {
        isErr = true
      } else buffer += chunk
    })

    const tags = buffer
      .split('\n')
      .filter(t => systemTag.has(t))
      .filter(tag => tag.length >= 1)

    console.log(`generate tags: ${tags}`)
    return tags
  }

  async chatRawContent(
    ctx: ContextManager,
    title: string,
    rawContent: string,
    messages: ChatCompletionMessageParam[],
    writer: WritableStream<Uint8Array>,
    quote: completionQuote[]
  ) {
    this.wr = writer.getWriter()
    const latestMessageIdx = messages.length - 1
    if (messages.length < 1) return this.wr.write(this.ted.encode('Invalid request\n'))

    // 只处理最后一条信息
    const latestMessage = messages[latestMessageIdx]
    const content = typeof latestMessage.content === 'string' ? latestMessage.content : ''

    try {
      // chat or tool call
      if (!this.isToolCallMessage(latestMessage)) return await this.chatRawContentText(ctx, rawContent, content, messages, quote)

      // tool call chat
      switch (latestMessage.tool_calls[0].function.name) {
        case 'generateQuestion':
          return await this.chatToolGenerateRawContentQuestion(ctx, title)
        case 'replyAnswer':
          return await this.chatToolGenerateRawContentAnswer(ctx, content, rawContent)
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

  async summaryRawContent(
    ctx: ContextManager,
    rawContent: string,
    writer: WritableStream<Uint8Array>,
    callbackHandler?: (result: { provider: string; model: string; response: string }) => Promise<void>
  ) {
    let providerInfo
    this.wr = writer.getWriter()
    const lang = ctx.getlang()

    try {
      const callback = async (chunk: string | MultiLangError) => {
        if (chunk instanceof MultiLangError) return this.wr.write(this.ted.encode(chunk.message))
        await this.wr.write(this.ted.encode(chunk))
      }

      const prompt = systemPrompt(lang)
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: prompt },
        { role: 'user', content: rawContent }
      ]

      providerInfo = await this.aigc().universal(ctx, messages, callback)
    } catch (error) {
      console.error(error)
      this.wr.write(this.ted.encode(error instanceof MultiLangError ? error.message : 'Failed to get summary, please try again later.\n'))
    } finally {
      this.wr.close()

      if (!callbackHandler || !this.chunks || !providerInfo) return

      const blob = new Blob(this.chunks)

      await callbackHandler({
        provider: providerInfo?.provider || '',
        model: providerInfo?.model || '',
        response: await blob.text()
      })
    }
  }

  /** 基于文章内容回答问题 */
  private async chatRawContentText(ctx: ContextManager, rawContent: string, content: string, messages: ChatCompletionMessageParam[], quote: completionQuote[]) {
    if (!rawContent) return this.writeChunk([{ role: 'assistant', content: 'No Content' }])

    // 去掉最后一条消息
    messages.pop()
    const raw = rawContent
    const systemMessage = userChatBookmarkSystemPrompt.replace('{article}', raw)
    const userMessage = { type: 'text', text: getUserChatBookmarkUserPrompt().replace('{content}', content) } as ChatCompletionContentPart
    const quoteMessage = quote.map(item => {
      return item.type === 'text' ? { type: 'text', text: item.content } : { type: 'image_url', image_url: { url: item.content } }
    }) as Array<ChatCompletionContentPart>

    messages.push({ role: 'system', content: systemMessage })
    messages.push({ role: 'user', content: [...quoteMessage, userMessage] })

    const tools: any[] = [
      {
        type: 'function',
        function: {
          name: 'search',
          function: this.chatToolSeach.bind(this, ctx.env),
          parse: JSON.parse,
          parameters: { type: 'object', properties: { q: { type: 'string' } } }
        }
      },
      {
        type: 'function',
        function: {
          name: 'browser',
          function: this.chatToolBrowser.bind(this),
          parse: JSON.parse,
          parameters: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } } }
        }
      },
      {
        type: 'function',
        function: {
          name: 'relatedQuestion',
          function: async (args: { question: string }) => {
            console.log('relatedQuestion', args.question)
            await this.writeProgress('tool', 'relatedQuestion', args.question, toolStatus.SUCCESSFULLY)
          },
          parse: JSON.parse,
          parameters: { type: 'object', properties: { question: { type: 'string' } } }
        }
      }
    ]
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

    await this.aigc().runTools(ctx, messages, callback, tools)

    if (buffer && !outputDone) {
      await this.writeChunk([{ role: 'assistant', content: buffer }])
    }

    await this.writeProgress('assistant', 'chat', undefined, 'completed')
    await this.writeDone()
  }

  /** GPT 4o 生成问题 */
  private async chatToolGenerateRawContentQuestion(ctx: ContextManager, title: string) {
    if (!title) return this.writeChunk([{ role: 'assistant', content: 'No raw content' }])

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: generateQuestionPrompt },
      { role: 'user', content: title }
    ]

    let buffer: string = ''
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
    await this.aigc().universal(ctx, messages, callback)

    // 如果buffer还有内容，则直接输出
    if (buffer) await this.writeProgress('tool', 'generateQuestion', JSON.stringify([buffer]), toolStatus.SUCCESSFULLY)

    await this.writeDone()
  }

  /** GPT 4o 解答问题 */
  private async chatToolGenerateRawContentAnswer(ctx: ContextManager, rawContent: string, question: string) {
    if (!rawContent) return await this.writeChunk([{ role: 'assistant', content: 'No raw content' }])

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: generateAnswerPrompt },
      { role: 'user', content: generateUserAnserPrompt.replace('{raw}', rawContent).replace('{questions}', question) }
    ]

    return await this.aigc().universal(ctx, messages, async (chunk: string | MultiLangError) => {
      if (chunk instanceof MultiLangError) return this.writeChunk([{ role: 'assistant', content: chunk.message }])
      await this.writeChunk([{ role: 'assistant', content: chunk }])
    })
  }
}

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { OpenAI } from 'openai'
import { MultiLangError } from '../../utils/multiLangError'
import { AIContentHarmful, AIError, AIRateLimitError } from '../../const/err'
import { getBestAzureInstance } from '../../utils/azureOpenAI'
import { ContextManager } from '../../utils/context'
import { injectable } from '../../decorators/di'

export type callbackHandle = (chunk: string | MultiLangError) => Promise<void>

@injectable()
export class ChatCompletion {
  private kv: KVNamespace

  private static readonly OPENAI_API = 'https://api.openai.com/v1'

  constructor(private env: Env) {
    this.kv = env.KV
  }

  private async chatOpenAI(ctx: ContextManager, provider: string, model: string, chat: OpenAI.Chat.Completions, messages: ChatCompletionMessageParam[], callback: callbackHandle) {
    for await (const chunk of await chat.create({
      model,
      messages,
      temperature: 0.6,
      stream: true,
      user: ctx.getUserId().toString()
    })) {
      const value = chunk.choices[0]?.delta?.content
      if (value) await callback(value)
    }
    return { provider, model }
  }

  private async chatCfAI(messages: ChatCompletionMessageParam[], callback: callbackHandle) {
    const msg: RoleScopedChatInput[] = messages.map(item => {
      return {
        role: item.role as any,
        content: item.content as string
      }
    })

    const rdStream = (await this.env.AI.run('@cf/qwen/qwen1.5-14b-chat-awq', {
      stream: true,
      messages: msg,
      temperature: 0.6,
      max_tokens: 4096
    })) as ReadableStream

    const rd = rdStream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await rd.read()
      if (done) break

      const val = decoder.decode(value, { stream: true })
      if (val === '[DONE]') break

      buffer += val

      let processedBuffer = ''
      const lines = buffer.split('\n')

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim()
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6)
            const parsedChunk = JSON.parse(jsonStr)
            processedBuffer += parsedChunk.response
          } catch (error) {
            console.error('Error parsing JSON:', error, 'Line:', line)
          }
        }
      }

      if (processedBuffer) {
        await callback(processedBuffer)
      }

      buffer = lines[lines.length - 1]
    }

    if (buffer.trim()) {
      const line = buffer.trim()
      if (line.startsWith('data: ')) {
        try {
          const jsonStr = line.slice(6)
          const parsedChunk = JSON.parse(jsonStr)
          await callback(parsedChunk.response)
        } catch (error) {
          console.error('Error parsing JSON:', error, 'Line:', line)
        }
      }
    }
  }

  private async runToolsAI(
    ctx: ContextManager,
    model: string,
    chat: OpenAI.Beta.Chat.Completions,
    messages: ChatCompletionMessageParam[],
    callback: callbackHandle,
    tools: Parameters<typeof chat.runTools>[0]['tools']
  ) {
    const runner = chat.runTools({
      model,
      messages,
      temperature: 0.6,
      stream: true,
      user: ctx.getUserId().toString(),
      tools
    })
    for await (const chunk of runner) {
      if (runner.errored) {
        await callback(AIError())
        return
      }
      if (runner.ended) break
      if (!chunk.choices || !chunk.choices[0] || !chunk.choices[0].delta || !chunk.choices[0].delta.content) continue
      await callback(chunk.choices[0].delta.content)
    }
  }

  private getCompletionsList<T extends boolean>(ctx: ContextManager, isBeta: T): T extends true ? OpenAI.Beta.Chat.Completions[] : OpenAI.Chat.Completions[] {
    const country = ctx.get('country') || ''
    let openAI = new OpenAI({
      apiKey: this.env.OPENAI_API_KEY,
      baseURL: country === 'CN' ? (this.env.PROXY_OPENAI_GATEWAY ?? ChatCompletion.OPENAI_API) : (this.env.OPENAI_GATEWAY ?? ChatCompletion.OPENAI_API)
    })
    const azureInfo = getBestAzureInstance(ctx)
    if (!azureInfo) {
      return [openAI] as any
    }
    const azureCompletions = isBeta ? azureInfo.beta.chat.completions : azureInfo.chat.completions
    const openAICompletions = isBeta ? openAI.beta.chat.completions : openAI.chat.completions

    return [azureCompletions, openAICompletions] as any
  }

  async catchAIError(error: any, callback: callbackHandle) {
    const err = error as { status: number; error: { message: string; code: string } }
    if (!err) {
      console.error(`Failed to run tools: ${error}`)
      callback(AIError())
      return
    }
    if (err.status === 400) {
      if (err.error.code === 'BadRequest') {
        await callback(err.error.message)
        return
      }
      if (err.error.code === 'content_filter') {
        await callback(AIContentHarmful())
        return
      }
    }
    if (err.status === 429) {
      this.kv.put('rate_limit', 'true', { expirationTtl: 600 })
      await callback(AIRateLimitError())
      return
    }
    if (err.status >= 500) {
      await callback(AIError())
      return
    }
    await callback(AIError())
  }

  async runTools(ctx: ContextManager, messages: ChatCompletionMessageParam[], callback: callbackHandle, tools: any[]) {
    const completionServices = this.getCompletionsList(ctx, true)
    for (const completion of completionServices) {
      try {
        return await this.runToolsAI(ctx, 'gpt-4o', completion, messages, callback, tools)
      } catch (error) {
        console.log(error)
        await this.catchAIError(error, callback)
      }
    }
  }

  async universal(ctx: ContextManager, messages: ChatCompletionMessageParam[], callback: callbackHandle) {
    const gptList = this.getCompletionsList(ctx, false).map((c, idx) => {
      const provider = idx === 0 ? 'azure' : 'openai'
      return this.chatOpenAI.bind(this, ctx, provider, 'gpt-4o', c, messages, callback)
    })
    const cfAi = this.chatCfAI.bind(this, messages, callback)
    for (const chatFetch of [...gptList, cfAi]) {
      try {
        return await chatFetch()
      } catch (error) {
        await this.catchAIError(error, callback)
      }
    }
  }
}

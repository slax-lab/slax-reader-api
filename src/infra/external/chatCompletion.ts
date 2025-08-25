import { streamText, generateText, CoreMessage, LanguageModel, generateObject, streamObject } from 'ai'
import { MultiLangError } from '../../utils/multiLangError'
import { AIContentHarmful, AIError, AIRateLimitError } from '../../const/err'
import z from 'zod'

export type StreamTextCallbackHandle = (chunk: string | MultiLangError) => Promise<void>
export type StreamSchemaCallbackHandle = (chunk: any | MultiLangError) => Promise<void>
export type GenerateTextResult = { text: string; model: string }
export type GenerateObjectResult = { object: any; model: string }

export type ProviderTextParams = {
  providerInstance: LanguageModel
  messages: CoreMessage[]
  tools?: Record<string, any>
} & { isStreaming: boolean; callback?: StreamTextCallbackHandle }

export type ProviderSchemaParams = {
  providerInstance: LanguageModel
  messages: CoreMessage[]
  schema: z.Schema<any>
} & {
  isStreaming: boolean
  callback?: StreamSchemaCallbackHandle
}

export type ProviderParams = ProviderTextParams | ProviderSchemaParams

type ProviderResult<T extends ProviderParams> = T extends ProviderSchemaParams ? { object?: any; model: string } : { text?: string; model: string }

export type ModelSelector<T extends Record<string, LanguageModel> = Record<string, LanguageModel>> = keyof T

export interface ChatOptions<T extends Record<string, LanguageModel> = Record<string, LanguageModel>> {
  tools?: Record<string, any>
  models?: ModelSelector<T>[]
}

export class ChatCompletion<T extends Record<string, LanguageModel> = Record<string, LanguageModel>> {
  private modelRegistry: T
  private providers: { modelId: string; model: LanguageModel }[]

  constructor(modelRegistry: T) {
    this.modelRegistry = modelRegistry ?? ({} as T)
    this.providers = Object.entries(this.modelRegistry).map(([modelId, model]) => ({ modelId, model }))
  }

  public hasOrDefaultModel(model: string): ModelSelector<T> {
    return model in this.modelRegistry ? (model as ModelSelector<T>) : this.providers[0].modelId
  }

  private async executeWithProvider<T extends ProviderParams>(params: T): Promise<ProviderResult<T>> {
    const { messages, isStreaming, providerInstance } = params
    const model = providerInstance

    if ('schema' in params) {
      if (isStreaming && params.callback) {
        const result = await streamObject({
          model,
          messages,
          schema: params.schema,
          temperature: 0.6,
          maxTokens: 4096
        })

        for await (const part of result.fullStream) {
          if (part.type === 'object') {
            await params.callback!(part.object)
          } else if (part.type === 'error') {
            throw part.error
          }
        }
      } else if (!isStreaming) {
        const result = await generateObject({
          model,
          messages,
          schema: params.schema,
          temperature: 0.6,
          maxTokens: 4096
        })

        return {
          object: result.object,
          model: providerInstance.modelId
        } as unknown as ProviderResult<T>
      }
    } else {
      if (isStreaming) {
        const result = await streamText({
          model,
          messages,
          tools: params.tools,
          temperature: 0.6,
          maxTokens: 4096
        })

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            await params.callback!(part.textDelta)
          } else if (part.type === 'error') {
            throw part.error
          }
        }
      } else {
        const result = await generateText({
          model,
          messages,
          tools: params.tools,
          temperature: 0.6,
          maxTokens: 4096
        })

        return {
          text: result.text,
          model: providerInstance.modelId
        } as unknown as ProviderResult<T>
      }
    }

    return { model: providerInstance.modelId } as unknown as ProviderResult<T>
  }

  async streamText(messages: CoreMessage[], callback: StreamTextCallbackHandle, options: ChatOptions<T> = {}): Promise<{ model: string }> {
    const compatibleProviders = options.models
      ? (options.models.map(modelId => this.providers.find(p => p.modelId === modelId)).filter(Boolean) as typeof this.providers)
      : this.providers

    for (const providerInstance of compatibleProviders) {
      try {
        const result = await this.executeWithProvider({
          providerInstance: providerInstance.model,
          messages,
          tools: options.tools,
          isStreaming: true,
          callback
        })
        return { model: result.model }
      } catch (error) {
        console.log(`Provider ${providerInstance.modelId} failed:`, error)
        await this.catchAIError(error, callback)
      }
    }

    throw new Error('All AI providers failed')
  }

  async streamObject(messages: CoreMessage[], schema: z.Schema<any>, callback: StreamSchemaCallbackHandle, options: ChatOptions<T> = {}): Promise<{ model: string }> {
    const compatibleProviders = options.models
      ? (options.models.map(modelId => this.providers.find(p => p.modelId === modelId)).filter(Boolean) as typeof this.providers)
      : this.providers

    for (const providerInstance of compatibleProviders) {
      try {
        const result = await this.executeWithProvider({
          providerInstance: providerInstance.model,
          messages,
          schema,
          isStreaming: true,
          callback
        })
        return { model: result.model }
      } catch (error) {
        console.log(`Provider ${providerInstance.modelId} failed:`, error)
        await this.catchAIError(error, callback)
      }
    }

    throw new Error('All AI providers failed')
  }

  async generateText(messages: CoreMessage[], options: ChatOptions<T> = {}): Promise<GenerateTextResult> {
    const compatibleProviders = options.models
      ? (options.models.map(modelId => this.providers.find(p => p.modelId === modelId)).filter(Boolean) as typeof this.providers)
      : this.providers

    for (const providerInstance of compatibleProviders) {
      try {
        const result = await this.executeWithProvider({
          providerInstance: providerInstance.model,
          messages,
          tools: options.tools,
          isStreaming: false
        })
        return {
          text: result.text!,
          model: result.model
        }
      } catch (error) {
        console.log(`Provider ${providerInstance.modelId} failed:`, error)
      }
    }

    throw new Error('All AI providers failed')
  }

  async generateObject(messages: CoreMessage[], schema: z.Schema<any>, options: ChatOptions<T> = {}): Promise<GenerateObjectResult> {
    const compatibleProviders = options.models
      ? (options.models.map(modelId => this.providers.find(p => p.modelId === modelId)).filter(Boolean) as typeof this.providers)
      : this.providers

    for (const providerInstance of compatibleProviders) {
      try {
        const result = await this.executeWithProvider({
          providerInstance: providerInstance.model,
          messages,
          isStreaming: false,
          schema
        })
        return {
          object: result.object!,
          model: result.model
        }
      } catch (error) {
        console.log(`Provider ${providerInstance.modelId} failed:`, error)
      }
    }

    throw new Error('All AI providers failed')
  }

  private async catchAIError(error: unknown, callback: StreamTextCallbackHandle) {
    const err = error as { status?: number; error?: { message?: string; code?: string } }
    if (!err || typeof err !== 'object') {
      console.error(`Failed to run AI: ${error}`)
      await callback(AIError())
      return
    }

    if (err.status === 400 && err.error) {
      if (err.error.code === 'BadRequest' && err.error.message) {
        await callback(err.error.message)
        return
      }
      if (err.error.code === 'content_filter') {
        await callback(AIContentHarmful())
        return
      }
    }

    if (err.status === 429) {
      await callback(AIRateLimitError())
      return
    }

    if (err.status && err.status >= 500) {
      await callback(AIError())
      return
    }

    await callback(AIError())
  }
}

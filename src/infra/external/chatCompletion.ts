import { streamText, generateText, CoreMessage, LanguageModel, generateObject, streamObject } from 'ai'
import { MultiLangError } from '../../utils/multiLangError'
import { AIContentHarmful, AIError, AIRateLimitError } from '../../const/err'
import z from 'zod'

// callback handle
export type StreamTextCallbackHandle = (chunk: string | MultiLangError) => Promise<void>
export type StreamObjectCallbackHandle<T = any> = (chunk: T | MultiLangError) => Promise<void>

// generate result
export type GenerateTextResult = { text: string; model: string }
export type GenerateObjectResult = { object: any; model: string }
export type GenerateResult = { model: string }

// model selector
export type ModelSelector<T extends Record<string, LanguageModel> = Record<string, LanguageModel>> = keyof T

export interface ChatOptions<T extends Record<string, LanguageModel> = Record<string, LanguageModel>> {
  isStreaming: boolean
  tools?: Record<string, any>
  models?: ModelSelector<T>[]
  schema?: z.Schema<any>
  headers?: Record<string, string>
  callback?: StreamTextCallbackHandle | StreamObjectCallbackHandle
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

  private async executeWithProvider(
    providerInstance: LanguageModel,
    messages: CoreMessage[],
    options: {
      isStreaming: boolean
      schema?: z.Schema<any>
      tools?: Record<string, any>
      callback?: StreamTextCallbackHandle | StreamObjectCallbackHandle
      temperature?: number
      maxTokens?: number
      headers?: Record<string, string>
    }
  ) {
    const config = {
      model: providerInstance,
      messages,
      temperature: options.temperature ?? 0.6,
      maxTokens: options.maxTokens ?? 16384,
      maxSteps: 10,
      headers: options.headers || {}
    }

    // object generation
    if (options.schema) {
      if (options.isStreaming && options.callback) {
        const result = await streamObject({ ...config, schema: options.schema })
        for await (const part of result.fullStream) {
          if (part.type === 'object') await options.callback(part.object)
          else if (part.type === 'error') throw part.error
        }
        return { model: providerInstance.modelId }
      }

      const result = await generateObject({ ...config, schema: options.schema })
      return { object: result.object, model: providerInstance.modelId }
    }

    // text generation
    if (options.isStreaming && options.callback) {
      const result = await streamText({ ...config, tools: options.tools })
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          await options.callback(part.textDelta)
        } else if (part.type === 'tool-call') {
          continue
        } else if (part.type === 'tool-result') {
          continue
        } else if (part.type === 'error') {
          throw part.error
        }
      }
      return { model: providerInstance.modelId }
    }

    const result = await generateText({ ...config, tools: options.tools })
    return { text: result.text, model: providerInstance.modelId }
  }

  // generate text
  generate(
    messages: CoreMessage[],
    options: { isStreaming: false; tools?: Record<string, any>; models?: ModelSelector<T>[]; headers?: Record<string, string> }
  ): Promise<GenerateTextResult>
  // generate object
  generate<S>(
    messages: CoreMessage[],
    options: { isStreaming: false; schema: z.Schema<S>; models?: ModelSelector<T>[]; headers?: Record<string, string> }
  ): Promise<{ object: S; model: string }>
  // generate text stream
  generate(
    messages: CoreMessage[],
    options: { isStreaming: true; tools?: Record<string, any>; models?: ModelSelector<T>[]; headers?: Record<string, string>; callback: StreamTextCallbackHandle }
  ): Promise<GenerateResult>
  // generate object stream
  generate<S>(
    messages: CoreMessage[],
    options: { isStreaming: true; schema: z.Schema<S>; models?: ModelSelector<T>[]; headers?: Record<string, string>; callback: StreamObjectCallbackHandle<S> }
  ): Promise<GenerateResult>

  // base function
  async generate(messages: CoreMessage[], options: ChatOptions<T>): Promise<GenerateResult | GenerateObjectResult | GenerateTextResult> {
    const providers = this.getCompatibleProviders(options.models)

    for (const provider of providers) {
      try {
        return await this.executeWithProvider(provider.model, messages, { ...options })
      } catch (error) {
        console.log(`Provider ${provider.modelId} failed:`, error)
        await this.catchAIError(error, options.callback)
      }
    }

    throw new Error('All AI providers failed')
  }

  private getCompatibleProviders(modelIds?: ModelSelector<T>[]) {
    return modelIds ? (modelIds.map(id => this.providers.find(p => p.modelId === id)).filter(Boolean) as typeof this.providers) : this.providers
  }

  private async catchAIError(error: unknown, callback?: StreamTextCallbackHandle | StreamObjectCallbackHandle<unknown>) {
    if (!callback) return

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

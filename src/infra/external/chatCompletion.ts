import { streamText, generateText, CoreMessage, LanguageModel } from 'ai'
import { MultiLangError } from '../../utils/multiLangError'
import { AIContentHarmful, AIError, AIRateLimitError } from '../../const/err'

export type StreamCallbackHandle = (chunk: string | MultiLangError) => Promise<void>
export type GenerateResult = { text: string; model: string }

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

  private async executeWithProvider(
    providerInstance: LanguageModel,
    messages: CoreMessage[],
    tools?: Record<string, any>,
    isStreaming: boolean = true,
    callback?: StreamCallbackHandle
  ): Promise<{ text?: string; model: string }> {
    const model = providerInstance

    if (isStreaming) {
      const result = await streamText({
        model,
        messages,
        tools,
        temperature: 0.6,
        maxTokens: 4096,
        maxSteps: 10
      })

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          await callback!(part.textDelta)
        } else if (part.type === 'error') {
          throw part.error
        }
      }
    } else {
      const result = await generateText({
        model,
        messages,
        tools,
        temperature: 0.6,
        maxTokens: 4096
      })

      return {
        text: result.text,
        model: providerInstance.modelId
      }
    }

    return { model: providerInstance.modelId }
  }

  async streamText(messages: CoreMessage[], callback: StreamCallbackHandle, options: ChatOptions<T> = {}): Promise<{ model: string }> {
    const compatibleProviders = options.models
      ? (options.models.map(modelId => this.providers.find(p => p.modelId === modelId)).filter(Boolean) as typeof this.providers)
      : this.providers

    for (const providerInstance of compatibleProviders) {
      try {
        const result = await this.executeWithProvider(providerInstance.model, messages, options.tools, true, callback)
        return { model: result.model }
      } catch (error) {
        console.log(`Provider ${providerInstance.modelId} failed:`, error)
        await this.catchAIError(error, callback)
      }
    }

    throw new Error('All AI providers failed')
  }

  async generateText(messages: CoreMessage[], options: ChatOptions<T> = {}): Promise<GenerateResult> {
    const compatibleProviders = options.models
      ? (options.models.map(modelId => this.providers.find(p => p.modelId === modelId)).filter(Boolean) as typeof this.providers)
      : this.providers

    for (const providerInstance of compatibleProviders) {
      try {
        const result = await this.executeWithProvider(providerInstance.model, messages, options.tools, false)
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

  private async catchAIError(error: unknown, callback: StreamCallbackHandle) {
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

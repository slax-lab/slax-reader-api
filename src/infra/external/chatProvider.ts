import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createXai } from '@ai-sdk/xai'
import { createAzure } from '@ai-sdk/azure'
import { LanguageModel } from 'ai'

export enum AIProvider {
  AZURE_OPENAI = 'azure_openai',
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  CLOUDFLARE = 'cloudflare',
  DEEPSEEK = 'deepseek'
}

export type ModelRegistry = {
  [K in AIProvider]: {
    [modelName: string]: LanguageModel
  }
}

export class ChatProvider {
  static createAzureOpenAI(apiKey: string, area: string, model: string, version: string): LanguageModel {
    return createAzure({
      resourceName: area,
      apiVersion: version,
      apiKey
    })(model)
  }

  static createOpenAI(apiKey: string, baseURL = 'https://api.openai.com/v1', model = 'gpt-4o'): LanguageModel {
    return createOpenAI({
      apiKey,
      baseURL
    })(model)
  }

  static createClaude(apiKey: string, baseURL = 'https://api.anthropic.com/v1', model = 'claude-3-5-sonnet-20241022'): LanguageModel {
    return createAnthropic({
      apiKey,
      baseURL
    })(model)
  }

  static createXai(apiKey: string, baseURL = 'https://api.xai.com/v1', model = 'xai-4o-latest'): LanguageModel {
    return createXai({
      apiKey,
      baseURL
    })(model)
  }

  static createGemini(apiKey: string, baseURL = 'https://generativelanguage.googleapis.com/v1beta', model = 'gemini-2.5-flash'): LanguageModel {
    return createGoogleGenerativeAI({
      apiKey,
      baseURL
    })(model)
  }
}

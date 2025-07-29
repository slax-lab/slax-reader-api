import { PrismaClient } from '@prisma/client'
import { CHAT_COMPLETION, PRISIMA_CLIENT, PRISIMA_FULLTEXT_CLIENT, VECTORIZE_CLIENTS } from '../const/symbol'
import { container, singleton } from '../decorators/di'
import { PrismaD1 } from '@prisma/adapter-d1'
import { BucketClient } from '../infra/repository/bucketClient'
import { KVClient } from '../infra/repository/KVClient'
import { QueueClient } from '../infra/queue/queueClient'
import { ChatProvider } from '../infra/external/chatProvider'
import { ChatCompletion } from '../infra/external/chatCompletion'

// TODO: need to use config to manage model registry
export const createModelRegistry = (env: Env) =>
  ({
    'azure-gpt-4o': ChatProvider.createAzureOpenAI(env.AZURE_OPENAI_JAPAN_EAST_KEY, 'slax-common-openai-japan-east', 'gpt-4o', '2024-09-01-preview'),
    'gpt-4o-mini': ChatProvider.createAzureOpenAI(env.AZURE_OPENAI_JAPAN_EAST_KEY, 'slax-common-openai-japan-east', 'gpt-4o-mini', '2024-09-01-preview'),
    'gcp-gemini-2.5-flash': ChatProvider.createGemini(env.GOOGLE_GEMINI_KEY, env.GOOGLE_GEMINI_URL, 'gemini-2.5-flash'),
    'gcp-gemini-2.5-pro': ChatProvider.createGemini(env.GOOGLE_GEMINI_KEY, env.GOOGLE_GEMINI_URL, 'gemini-2.5-pro')
  }) as const

export type AppModelRegistry = ReturnType<typeof createModelRegistry>
export type AppChatCompletion = ChatCompletion<AppModelRegistry>

@singleton()
export class DatabaseRegistry {
  public register(env: Env): void {
    container.register(PRISIMA_CLIENT, {
      useFactory: () => new PrismaClient({ adapter: new PrismaD1(env.DB) }),
      uncached: true
    })
    container.register(PRISIMA_FULLTEXT_CLIENT, {
      useFactory: () => new PrismaClient({ adapter: new PrismaD1(env.DB_FULLTEXT) }),
      uncached: true
    })
    container.register(VECTORIZE_CLIENTS, {
      useFactory: () => [env.VECTORIZE1, env.VECTORIZE2, env.VECTORIZE3, env.VECTORIZE4, env.VECTORIZE5],
      uncached: true
    })
    container.register(CHAT_COMPLETION, {
      useFactory: () => new ChatCompletion<AppModelRegistry>(createModelRegistry(env)),
      uncached: true
    })
    container.register(BucketClient, { useFactory: () => new BucketClient(env), uncached: true })
    container.register(KVClient, { useFactory: () => new KVClient(env), uncached: true })
    container.register(QueueClient, { useFactory: () => new QueueClient(env), uncached: true })
  }

  public async clean(): Promise<void> {}
}

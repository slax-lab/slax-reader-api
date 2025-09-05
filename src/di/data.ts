import { PrismaClient } from '@prisma/client'
import { PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'
import { CHAT_COMPLETION, PRISIMA_CLIENT, PRISIMA_FULLTEXT_CLIENT, VECTORIZE_CLIENTS } from '../const/symbol'
import { container, Container, singleton } from '../decorators/di'
import { PrismaD1 } from '@prisma/adapter-d1'
import { BucketClient } from '../infra/repository/bucketClient'
import { KVClient } from '../infra/repository/KVClient'
import { QueueClient } from '../infra/queue/queueClient'
import { ChatProvider } from '../infra/external/chatProvider'
import { ChatCompletion } from '../infra/external/chatCompletion'
import { PRISIMA_HYPERDRIVE_CLIENT } from '../const/symbol'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

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
  public register(env: Env, targetContainer: Container = container): void {
    targetContainer.register(PRISIMA_CLIENT, {
      useFactory: () => new PrismaClient({ adapter: new PrismaD1(env.DB) }),
      uncached: false
    })
    targetContainer.register(PRISIMA_FULLTEXT_CLIENT, {
      useFactory: () => new PrismaClient({ adapter: new PrismaD1(env.DB_FULLTEXT) }),
      uncached: false
    })
    targetContainer.register(PRISIMA_HYPERDRIVE_CLIENT, {
      useFactory: () => new HyperdrivePrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 1, maxUses: 1 })) }),
      uncached: false
    })
    targetContainer.register(VECTORIZE_CLIENTS, {
      useFactory: () => [env.VECTORIZE1, env.VECTORIZE2, env.VECTORIZE3, env.VECTORIZE4, env.VECTORIZE5],
      uncached: true
    })
    targetContainer.register(CHAT_COMPLETION, {
      useFactory: () => new ChatCompletion<AppModelRegistry>(createModelRegistry(env)),
      uncached: false
    })
    targetContainer.register(BucketClient, { useFactory: () => new BucketClient(env), uncached: false })
    targetContainer.register(KVClient, { useFactory: () => new KVClient(env), uncached: false })
    targetContainer.register(QueueClient, { useFactory: () => new QueueClient(env), uncached: false })
  }

  public async clean(): Promise<void> {}
}

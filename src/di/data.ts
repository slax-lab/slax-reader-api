import { PrismaClient } from '@prisma/client'
import { PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'
import { GEMINI_AGENT, PRISIMA_CLIENT, PRISIMA_FULLTEXT_CLIENT, VECTORIZE_CLIENTS } from '../const/symbol'
import { container, Container, singleton } from '../decorators/di'
import { PrismaD1 } from '@prisma/adapter-d1'
import { BucketClient } from '../infra/repository/bucketClient'
import { KVClient } from '../infra/repository/KVClient'
import { QueueClient } from '../infra/queue/queueClient'
import { PRISIMA_HYPERDRIVE_CLIENT } from '../const/symbol'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { VertexAIClient } from '../infra/external/vertexAIClient'

@singleton()
export class DatabaseRegistry {
  //@ts-ignore
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
      useFactory: () => new HyperdrivePrismaClient({ log: ['query'], adapter: new PrismaPg(new Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 1, maxUses: 1 })) }),
      uncached: false
    })
    targetContainer.register(VECTORIZE_CLIENTS, {
      useFactory: () => [env.VECTORIZE1, env.VECTORIZE2, env.VECTORIZE3, env.VECTORIZE4, env.VECTORIZE5],
      uncached: true
    })
    targetContainer.register(GEMINI_AGENT, {
      useFactory: container => new VertexAIClient(env),
      uncached: false
    })
    targetContainer.register(BucketClient, { useFactory: () => new BucketClient(env), uncached: false })
    targetContainer.register(KVClient, { useFactory: () => new KVClient(env), uncached: false })
    targetContainer.register(QueueClient, { useFactory: () => new QueueClient(env), uncached: false })
  }

  public async clean(): Promise<void> {}
}

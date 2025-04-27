import { PrismaClient } from '@prisma/client'
import { PRISIMA_CLIENT, PRISIMA_FULLTEXT_CLIENT, VECTORIZE_CLIENTS } from '../const/symbol'
import { container, singleton } from '../decorators/di'
import { PrismaD1 } from '@prisma/adapter-d1'
import { ChatCompletion } from '../infra/external/chatCompletion'
import { BucketClient } from '../infra/repository/bucketClient'
import { KVClient } from '../infra/repository/KVClient'
import { QueueClient } from '../infra/queue/queueClient'

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
    container.register(ChatCompletion, { useFactory: () => new ChatCompletion(env), uncached: true })
    container.register(BucketClient, { useFactory: () => new BucketClient(env), uncached: true })
    container.register(KVClient, { useFactory: () => new KVClient(env), uncached: true })
    container.register(QueueClient, { useFactory: () => new QueueClient(env), uncached: true })
  }

  public async clean(): Promise<void> {}
}

import { container } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { BookmarkConsumer } from '../../handler/queue/bookmarkConsumer'

const handleMessages = async (exec: ExecutionContext, env: Env, messages: readonly Message[], processFunction: (ctx: ContextManager, body: any) => Promise<void>) => {
  for (const item of messages) {
    const param = { id: item.id, info: item.body }
    const ctx = new ContextManager(exec, env)
    await processFunction(ctx, param).finally(() => {
      item.ack()
    })
  }
}

const handleBatchMessages = async (exec: ExecutionContext, env: Env, messages: readonly Message[], processFunction: (ctx: ContextManager, body: any) => Promise<void>) => {
  const processParams = []
  for (const item of messages) {
    const param = { id: item.id, info: item.body }
    processParams.push(param)
  }
  await processFunction(new ContextManager(exec, env), processParams).finally(() => {
    for (const item of messages) {
      item.ack()
    }
  })
}

export const handleMessage = async (batch: MessageBatch, env: Env, exec: ExecutionContext) => {
  switch (batch.queue) {
    case 'slax-reader-parser-twitter': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleBatchMessages(exec, env, batch.messages, consumer.handleParseThirdPartyURL.bind(consumer))
      break
    }
    case 'slax-reader-parser-twitter-beta': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleBatchMessages(exec, env, batch.messages, consumer.handleParseThirdPartyURL.bind(consumer))
      break
    }
    case 'slax-reader-parser-fetch-retry-prod': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleMessages(exec, env, batch.messages, consumer.handleParseRetryURL.bind(consumer))
      break
    }
    case 'slax-reader-parser-fetch-retry-beta': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleMessages(exec, env, batch.messages, consumer.handleParseRetryURL.bind(consumer))
      break
    }
    case 'slax-reader-import-other': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleMessages(exec, env, batch.messages, consumer.handleImportOther.bind(consumer))
      break
    }
    case 'slax-reader-migrate-from-other': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleMessages(exec, env, batch.messages, consumer.handleImportOther.bind(consumer))
      break
    }
    case 'slax-reader-parser-prod': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleMessages(exec, env, batch.messages, consumer.handleParseURL.bind(consumer))
      break
    }
    case 'slax-reader-parser-beta': {
      const consumer = container.resolve(BookmarkConsumer)
      await handleMessages(exec, env, batch.messages, consumer.handleParseURL.bind(consumer))
      break
    }
    default:
      console.warn(`Unknown queue: ${batch.queue}`)
      return
  }

  console.log(`handle ${batch.queue} ${batch.messages.length} messages`)
}

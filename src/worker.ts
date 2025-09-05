import { SlaxBrowser } from './utils/browser'
import { SlaxJieba } from './utils/hybridSearch/jieba'
import { MultiLangError } from './utils/multiLangError'
import { Failed } from './utils/responseUtils'
import { ServerError } from './const/err'
import { ContextManager } from './utils/context'
import { SlaxWebSocketServer } from './infra/message/websocket'
import { initializeInfrastructure, initializeCore } from './di/generated/dependency'
import { container } from './decorators/di'
import { handleMessage } from './di/generated/consumer'
import { handleCronjob } from './di/generated/cronjob'
import { getRouter } from './di/generated/readerRouter'
import { SlaxMcpServer } from './domain/orchestrator/mcp'

initializeCore()

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const currentContainer = container.clone()
    initializeInfrastructure(env, currentContainer)

    return getRouter(currentContainer)
      .fetch(request, new ContextManager(ctx, env))
      .catch(err => {
        if (err instanceof MultiLangError) return Failed(err)
        console.error(err)
        return Failed(ServerError())
      })
      .then(res => {
        if (res instanceof Response) return res
        console.error(`[${request.method}] ${request.url} ${res} is not a response`)
        return Failed(ServerError())
      })
  },

  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    const currentContainer = container.clone()
    initializeInfrastructure(env, currentContainer)
    return await handleMessage(currentContainer, batch, env, ctx)
  },

  async scheduled(event: Event, env: Env, ctx: ExecutionContext) {
    const currentContainer = container.clone()
    initializeInfrastructure(env, currentContainer)
    return await handleCronjob(currentContainer, event, env, ctx)
  }
}

export { SlaxBrowser, SlaxJieba, SlaxWebSocketServer, SlaxMcpServer }

import { Controller } from '../../decorators/controller'
import { Post } from '../../decorators/route'
import { ContextManager } from '../../utils/context'

@Controller('/v1/sync')
export class SyncController {
  constructor() {}

  @Post('/sign')
  public async handleSignRequest(ctx: ContextManager, request: Request) {
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  @Post('/upload')
  public async handleSyncSaveRequest(ctx: ContextManager, request: Request) {}
}

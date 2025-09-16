import { Controller } from '../../decorators/controller'
import { Post } from '../../decorators/route'
import { ContextManager } from '../../utils/context'
import { inject } from '../../decorators/di'
import { Failed, Successed } from '../../utils/responseUtils'
import { SyncOrchestrator } from '../../domain/orchestrator/sync'
import { RequestUtils } from '../../utils/requestUtils'
import { ErrorParam } from '../../const/err'
import { SyncChangeItem } from '../../domain/orchestrator/sync'

@Controller('/v1/sync')
export class SyncController {
  constructor(@inject(SyncOrchestrator) private syncOrchestrator: SyncOrchestrator) {}

  @Post('/token')
  public async handleSignRequest(ctx: ContextManager, request: Request) {
    const { token, endpoint } = await this.syncOrchestrator.signToken(ctx)
    return Successed({ token, endpoint })
  }

  @Post('/changes')
  public async handleSyncSaveRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<SyncChangeItem[]>(request)
    if (!req) return Failed(ErrorParam())

    await this.syncOrchestrator.syncChanges(ctx, req)
    return Successed()
  }
}

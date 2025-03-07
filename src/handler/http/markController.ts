import { ErrorMarkTypeError, ErrorParam } from '../../const/err'
import { markType } from '../../infra/repository/dbMark'
import { markRequest } from '../../domain/mark'
import { RequestUtils } from '../../utils/requestUtils'
import { Failed, Successed } from '../../utils/responseUtils'
import { Controller } from '../../decorators/controller'
import { Get, Post } from '../../decorators/route'
import { inject } from '../../decorators/di'
import { MarkService } from '../../domain/mark'
import { ContextManager } from '../../utils/context'
import { MarkOrchestrator } from '../../domain/orchestrator/mark'

@Controller('/v1/mark')
export class MarkController {
  constructor(
    @inject(MarkService) private markService: MarkService,
    @inject(MarkOrchestrator) private markOrchestrator: MarkOrchestrator
  ) {}

  /**
   * 创建划线
   */
  @Post('/create')
  public async createMark(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<markRequest>(request)
    if (!req || !req.source || (!req.bm_id && !req.share_code && !req.collection_code && !req.cb_id)) {
      return Failed(ErrorParam())
    }
    if (req.type && req.type !== markType.LINE && req.type !== markType.COMMENT && req.type !== markType.REPLY) {
      return Failed(ErrorMarkTypeError())
    }

    const sourceType = typeof req.source
    if (req.type === markType.LINE && (req.comment || sourceType !== 'object')) return Failed(ErrorMarkTypeError())
    if (req.type === markType.COMMENT && (!req.comment || req.comment.length < 1 || sourceType !== 'object')) return Failed(ErrorMarkTypeError())
    if (req.type === markType.REPLY && (!req.comment || req.comment.length < 1)) return Failed(ErrorMarkTypeError())

    const createResult = await this.markOrchestrator.createMark(ctx, req)

    return Successed({
      mark_id: createResult.id,
      root_id: createResult.root_id
    })
  }

  /**
   * 删除划线
   */
  @Post('/delete')
  public async deleteMark(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ mark_id: number }>(request)
    if (!req || !req.mark_id) {
      return Failed(ErrorParam())
    }
    const deleteResult = await this.markService.deleteMark(ctx, req.mark_id)
    return Successed(deleteResult)
  }

  @Get('/list')
  public async getMarkList(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.query<{ page: string; size: string }>(request)
    if (!req) return Failed(ErrorParam())

    let page = parseInt(req.page)
    let size = parseInt(req.size)

    if (isNaN(page) || page < 1) page = 1
    if (isNaN(size) || size < 1 || size > 6) size = 6

    const listResult = await this.markService.getMarkList(ctx, page, size)
    return Successed(listResult)
  }
}

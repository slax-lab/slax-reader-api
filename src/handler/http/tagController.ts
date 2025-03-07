import { ErrorParam } from '../../const/err'
import { ContextManager } from '../../utils/context'
import { RequestUtils } from '../../utils/requestUtils'
import { Failed, Successed } from '../../utils/responseUtils'
import { Controller } from '../../decorators/controller'
import { inject } from '../../decorators/di'
import { TagService } from '../../domain/tag'
import { Get, Post } from '../../decorators/route'

@Controller('/v1/tag')
export class TagController {
  constructor(@inject(TagService) private tagService: TagService) {}

  @Get('/list')
  public async handleListTagsRequest(ctx: ContextManager, request: Request): Promise<Response> {
    const tags = await this.tagService.listUserTags(ctx)
    return Successed(tags)
  }

  @Post('/update')
  public async handleUpdateTagRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ tag_id: number; tag_name: string }>(request)
    if (!req || !req.tag_name || req.tag_name.length > 30) return Failed(ErrorParam())

    req.tag_id = ctx.hashIds.decodeId(req.tag_id)
    if (!req.tag_id) return Failed(ErrorParam())

    await this.tagService.editTag(ctx, req.tag_id, req.tag_name)
    return Successed()
  }

  @Post('/create')
  public async handleCreateTagRequest(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.json<{ tag_name: string }>(request)
    if (!req || !req.tag_name || req.tag_name.length > 30) return Failed(ErrorParam())

    const res = await this.tagService.createTag(ctx, req.tag_name)
    return Successed(res)
  }
}

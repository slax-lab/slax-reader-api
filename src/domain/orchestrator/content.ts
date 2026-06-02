import { inject, injectable } from '../../decorators/di'
import { BookmarkService } from '../bookmark'
import { UserService } from '../user'
import { TagService } from '../tag'
import { MarkService } from '../mark'
import { ContextManager } from '../../utils/context'
import { BookmarkNotFoundError } from '../../const/err'

const EMPTY_TRACE = {
  user_info: { nick_name: '', avatar: '', show_userinfo: false },
  tags: [],
  first_comment: '',
  outline: ''
}

@injectable()
export class ContentOrchestrator {
  constructor(
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(UserService) private userService: UserService,
    @inject(TagService) private tagService: TagService,
    @inject(MarkService) private markService: MarkService
  ) {}

  public async getContentMeta(ctx: ContextManager, uuid: string) {
    const ub = await this.bookmarkService.getUserBookmarkByUuidWithDetail(uuid)
    if (!ub || !ub.bookmark) throw BookmarkNotFoundError()

    const isOwner = ctx.getUserId() > 0 && ctx.getUserId() === ub.user_id

    const share = (ub.metadata as { share?: { is_enable: boolean; show_userinfo: boolean } | null } | null)?.share ?? null

    const owner = await this.userService.getOwnerShareInfo(ub.user_id)

    let showTrace = true
    if (!isOwner) {
      if (ub.deleted_at) throw BookmarkNotFoundError()
      if (share) {
        if (!share.is_enable) throw BookmarkNotFoundError()
      } else if (!owner.snapshot_sharing) {
        throw BookmarkNotFoundError()
      }
      showTrace = share?.show_userinfo ?? false
    }

    const trace = showTrace ? await this.loadTrace(ctx, ub.bookmark_id, ub.user_id, { nick_name: owner.nick_name, avatar: owner.avatar }) : EMPTY_TRACE

    const { id, content_key, content_md_key, private_user, created_at, updated_at, published_at, ...bookmarkMeta } = ub.bookmark

    const base = {
      ...bookmarkMeta,
      ...trace,
      created_at: created_at.toISOString(),
      published_at: published_at.toISOString(),
      bookmark_uuid: ub.uuid,
      user_id: ctx.hashIds.encodeId(ub.user_id),
      content_key,
      role: isOwner ? 'owner' : 'visitor'
    }

    if (!isOwner) return base

    return {
      ...base,
      archived: ub.archive_status === 1 ? 'archive' : ub.archive_status === 2 ? 'later' : 'inbox',
      starred: ub.is_starred ? 'star' : 'unstar',
      trashed_at: ub.deleted_at,
      alias_title: ub.alias_title,
      type: ub.type === 1 ? 'shortcut' : 'article'
    }
  }

  private async loadTrace(ctx: ContextManager, bookmarkId: number, userId: number, owner: { nick_name: string; avatar: string }) {
    const [tags, firstComment, outline] = await Promise.all([
      this.tagService.getBookmarkTags(ctx, userId, bookmarkId),
      this.markService.getFirstComment(bookmarkId, userId),
      this.bookmarkService.getBookmarkOutline(bookmarkId, userId)
    ])

    return {
      user_info: { ...owner, show_userinfo: true },
      tags,
      first_comment: (firstComment || '').slice(0, 120),
      outline: outline ?? ''
    }
  }
}

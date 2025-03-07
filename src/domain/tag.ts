import { inject, injectable } from '../decorators/di'
import { BookmarkNotFoundError, ErrorParam, ServerError } from '../const/err'
import { systemTag } from '../const/systemTag'
import { ContextManager } from '../utils/context'
import { BookmarkRepo } from '../infra/repository/dbBookmark'

export interface BookmarkTag {
  id: number
  name: string
  show_name: string
  system: boolean
  display?: boolean
}

@injectable()
export class TagService {
  constructor(@inject(BookmarkRepo) private bookmarkRepo: BookmarkRepo) {}

  public async addBookmarkTag(ctx: ContextManager, bmId: number, tagName?: string, tagId?: number): Promise<BookmarkTag> {
    const bmRepo = this.bookmarkRepo

    const res = await bmRepo.getUserBookmark(bmId, ctx.getUserId())
    if (!res) throw BookmarkNotFoundError()

    // 创建标签逻辑
    // 如果是传递的ID，则代表是user tag中曾经存在的，此时更新一下display并且插入到bookmark_tag中
    // 如果是传递的tagName，则代表是新创建的tag，此时插入user_tag和bookmark_tag
    if (tagName) {
      const res = await bmRepo.createUserTag(ctx.getUserId(), tagName, false)
      if (!res) throw ServerError()
      await bmRepo.createBookmarkTag(bmId, ctx.getUserId(), res.id, tagName, false)
      tagId = res.id
    } else if (tagId) {
      tagId = ctx.hashIds.decodeId(tagId)
      const tag = await bmRepo.getUserTagById(ctx.getUserId(), tagId)
      if (!tag) throw ErrorParam()
      await Promise.allSettled([bmRepo.createBookmarkTag(bmId, ctx.getUserId(), tagId, tag.tag_name, tag.system_tag), bmRepo.updateUserTagDisplay(ctx.getUserId(), tagId, true)])
      tagName = tag.tag_name
    }
    if (!tagName || !tagId) throw ServerError()
    const lang = ctx.getlang()
    return {
      id: ctx.hashIds.encodeId(tagId),
      name: tagName,
      show_name: systemTag.get(tagName)?.get(lang) ?? tagName,
      system: systemTag.has(tagName)
    }
  }

  public async deleteBookmarkTag(ctx: ContextManager, bmId: number, tagId: number) {
    const bmRepo = this.bookmarkRepo
    const res = await bmRepo.getUserBookmark(bmId, ctx.getUserId())
    if (!res) throw BookmarkNotFoundError()

    await bmRepo.deleteBookmarkTag(bmId, ctx.getUserId(), tagId).then(async () => {
      const hasRecord = await bmRepo.countBookmarksByTag(ctx.getUserId(), tagId)
      if (!hasRecord) await bmRepo.deleteUserTag(ctx.getUserId(), tagId)
    })

    return null
  }

  public async createTag(ctx: ContextManager, tagName: string): Promise<BookmarkTag> {
    const bmRepo = this.bookmarkRepo

    const res = await bmRepo.createUserTag(ctx.getUserId(), tagName, false)
    if (!res) throw ErrorParam()

    return {
      id: ctx.hashIds.encodeId(res.id),
      name: res.tag_name,
      show_name: res.tag_name,
      system: false,
      display: true
    }
  }

  public async editTag(ctx: ContextManager, tagId: number, tagName: string) {
    const bmRepo = this.bookmarkRepo
    const tag = await bmRepo.getUserTagById(ctx.getUserId(), tagId)
    if (!tag) throw ErrorParam()
    if (tag.system_tag) throw ErrorParam()

    await Promise.allSettled([bmRepo.updateUserTag(ctx.getUserId(), tagId, tagName), bmRepo.updateBookmarkTag(ctx.getUserId(), tagId, tagName)])
    return null
  }

  public async listUserTags(ctx: ContextManager): Promise<BookmarkTag[]> {
    const bmRepo = this.bookmarkRepo
    const res = await bmRepo.getUserTags(ctx.getUserId())
    const lang = ctx.getlang()
    return res.map(item => ({
      show_name: item.system_tag ? systemTag.get(item.tag_name)?.get(lang || 'en') || item.tag_name : item.tag_name,
      name: item.tag_name,
      system: item.system_tag,
      id: ctx.hashIds.encodeId(item.id),
      display: item.display
    }))
  }

  public async getBookmarkTags(ctx: ContextManager, userId: number, bmId: number): Promise<BookmarkTag[]> {
    const userLang = ctx.getlang()
    return (await this.bookmarkRepo.getBookmarkTags(userId, bmId)).map(t => ({
      show_name: t.system_tag ? (systemTag.get(t.tag_name)?.get(userLang) ?? t.tag_name) : t.tag_name,
      name: t.tag_name,
      system: t.system_tag,
      id: ctx.hashIds.encodeId(t.tag_id)
    }))
  }
}

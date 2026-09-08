import { Prisma, PrismaClient } from '@prisma/client'
import { MultiLangError } from '../../utils/multiLangError'
import { BookmarkNotFoundError, CreateBookmarkShareUniqueFail, DeleteBookmarkFailError } from '../../const/err'
import { inject, injectable } from '../../decorators/di'
import { PRISIMA_CLIENT, PRISIMA_HYPERDRIVE_CLIENT } from '../../const/symbol'
import type { LazyInstance } from '../../decorators/lazy'
import { PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'

export enum queueStatus {
  PENDING = 'pending',
  PARSEING = 'parseing',
  RETRYING = 'retrying',
  FAILED = 'failed',
  PENDING_RETRY = 'pending_retry', // 失败后如果重新发起抓取，状态变为此状态
  SUCCESS = 'success',
  PENDING_IMPORT = 'pending_import'
}

export enum bookmarkParseStatus {
  PENDING = 'pending',
  PARSEING = 'parseing',
  FAILED = 'failed',
  SUCCESS = 'success',
  UPDATING = 'updating'
}

export enum bookmarkFetchRetryStatus {
  PENDING = 'pending',
  QUEUEING = 'queueing',
  PARSING = 'parsing',
  FAILED = 'failed',
  SUCCESS = 'success'
}

export type UserTagSource = 'auto' | 'mine'
export type BookmarkTagSource = 'user' | 'ai' | ''

export interface bookmarkPO {
  bookmark_id?: number
  title: string
  alias_title?: string
  host_url: string
  target_url: string
  content_icon: string
  content_cover: string
  content_key?: string
  content_md_key?: string
  content_word_count?: number
  description?: string
  byline?: string
  private_user?: number
  status?: string
  created_at?: Date
  updated_at?: Date
  published_at?: Date
}

export interface bookmarkParsePO {
  title?: string
  content_icon?: string
  content_cover?: string
  content_key: string
  content_md_key?: string
  content_word_count: number
  description?: string
  byline?: string
  status: string
  published_at: Date
  site_name: string
}

export interface bookmarkSummaryPO {
  content: string
  ai_name?: string
  ai_model?: string
  created_at?: Date
  bookmark_id: number
  user_id: number
  lang: string
  updated_at?: Date
}

export interface bookmarkTitlePO {
  user_bookmark_id: number
  title: string
}

export interface bookmarkShardPO {
  id: number
  bookmark_id: number
  bucket_idx: number
  created_at: Date
}

export interface bookmarkChangePO {
  target_url: string
  bookmark_id: number
  created_at: Date
}

export interface bookmarkActionChangePO {
  user_id: number
  bookmark_id: number
  created_at: Date
  target_url: string
  action: 'add' | 'delete' | 'update'
}

@injectable()
export class BookmarkRepo {
  constructor(
    @inject(PRISIMA_CLIENT) private prisma: LazyInstance<PrismaClient>,
    @inject(PRISIMA_HYPERDRIVE_CLIENT) private prismaPg: LazyInstance<HyperdrivePrismaClient>
  ) {}

  public async deleteUserBookmark(bmId: number, userId: number): Promise<MultiLangError | null> {
    try {
      await this.prismaPg().sr_user_delete_bookmark.delete({ where: { user_id_bookmark_id: { user_id: Number(userId), bookmark_id: Number(bmId) } } })
    } catch (e) {
      const err = e as { code: string; message: string; name: string }
      if (err.code !== 'P2025') {
        console.log(`delete expired trashed bookmark failed: ${err}`)
        return DeleteBookmarkFailError()
      }

      console.log(`delete expired trashed bookmark failed: ${err}`)
    }

    try {
      await this.prismaPg().sr_user_bookmark_tag.deleteMany({ where: { bookmark_id: Number(bmId), user_id: Number(userId) } })
      await this.prismaPg().sr_user_bookmark.delete({ where: { user_id_bookmark_id: { bookmark_id: Number(bmId), user_id: Number(userId) } } })
      return null
    } catch (err) {
      console.log(`delete user bookmark failed: ${err}, userId: ${userId}, bookmarkId: ${bmId} `)
      return DeleteBookmarkFailError()
    }
  }

  public async updateBookmarkDeleteAt(bmId: number, userId: number, isDeleted: boolean) {
    const date = new Date()

    const deleteTasks = []
    if (isDeleted) {
      deleteTasks.push(
        this.prismaPg().sr_user_delete_bookmark.create({
          data: {
            user_id: userId,
            bookmark_id: bmId,
            deleted_at: date
          }
        })
      )
    } else {
      deleteTasks.push(this.prismaPg().sr_user_delete_bookmark.delete({ where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } } }))
    }

    deleteTasks.push(
      this.prismaPg().sr_user_bookmark.update({
        where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
        data: { deleted_at: isDeleted ? date : null, updated_at: date }
      })
    )

    deleteTasks.push(
      this.prismaPg().sr_user_bookmark_tag.updateMany({
        where: { bookmark_id: bmId, user_id: userId },
        data: { is_deleted: isDeleted }
      })
    )

    await Promise.allSettled(deleteTasks)
  }

  public async deleteBookmarkTry(bmId: number, userId: number): Promise<bookmarkPO | null> {
    try {
      const bookmark = await this.prismaPg().sr_bookmark.findUnique({ where: { id: bmId } })
      if (!bookmark || bookmark.private_user !== userId) return null

      await this.prismaPg().$executeRaw`DELETE FROM sr_bookmark WHERE id = ${bmId}`

      return { bookmark_id: bookmark.id, ...bookmark }
    } catch (e) {
      console.log(`delete bookmark failed:`, e)
      return null
    }
  }

  public async getBookmarkById(bmId: number) {
    try {
      return await this.prismaPg().sr_bookmark.findFirst({ where: { id: bmId } })
    } catch (err) {
      console.log(`get bookmark by id failed: ${err}`)
      throw BookmarkNotFoundError()
    }
  }

  public async getBookmark(targetUrl: string, privateUser: number): Promise<bookmarkPO | null> {
    const res = await this.prismaPg().sr_bookmark.findFirst({
      where: {
        target_url: targetUrl,
        private_user: privateUser
      }
    })
    if (!res) return null
    return { bookmark_id: res.id, ...res }
  }

  public async getUserBookmark(bmId: number, userId: number) {
    return await this.prismaPg().sr_user_bookmark.findFirst({ where: { bookmark_id: bmId, user_id: userId } })
  }

  public async getUserBookmarkUuidsByBmIds(userId: number, bmIds: number[]): Promise<Map<number, string>> {
    if (bmIds.length < 1) return new Map()
    const rows = await this.prismaPg().sr_user_bookmark.findMany({
      where: { user_id: userId, bookmark_id: { in: bmIds } },
      select: { bookmark_id: true, uuid: true }
    })
    return new Map(rows.map(row => [row.bookmark_id, row.uuid]))
  }

  public async getUserBookmarkById(id: number) {
    return await this.prismaPg().sr_user_bookmark.findFirst({ where: { id } })
  }

  public async getUserBookmarkByUId(uid: string, userId: number) {
    return await this.prismaPg().sr_user_bookmark.findFirst({ where: { uuid: uid, user_id: userId }, include: { bookmark: true } })
  }

  public async getUserBookmarkByUuid(uuid: string) {
    return await this.prismaPg().sr_user_bookmark.findFirst({ where: { uuid } })
  }

  public async getUserBookmarkByUuidWithDetail(uuid: string) {
    return await this.prismaPg().sr_user_bookmark.findFirst({ where: { uuid }, include: { bookmark: true } })
  }

  public async getUserBookmarkByUserBmId(userBmId: number) {
    return await this.prismaPg().sr_user_bookmark.findFirst({ where: { id: userBmId }, include: { bookmark: true } })
  }

  public async getUserBookmarkWithDetail(bmId: number, userId: number) {
    try {
      return await this.prismaPg().sr_user_bookmark.findFirst({
        where: { bookmark_id: bmId, user_id: userId },
        include: { bookmark: true }
      })
    } catch (err) {
      console.error(`get user bookmark detail failed: ${err}`)
      throw BookmarkNotFoundError()
    }
  }

  public async createBookmark(info: bookmarkPO, status: string) {
    return await this.prismaPg().sr_bookmark.upsert({
      where: { target_url_private_user: { target_url: info.target_url, private_user: info.private_user || 0 } },
      create: { ...info, created_at: new Date(), updated_at: new Date(), published_at: new Date(), status },
      update: { ...info, updated_at: new Date() }
    })
  }

  public async createBookmarkRelation(userId: number, bmId: number, type: number, isArchive: boolean, importMetadata?: { savedAt?: Date; starred: boolean }) {
    // re-save bumps created_at (save time, tops inbox); replay may re-top
    return await this.prismaPg().sr_user_bookmark.upsert({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      create: {
        user_id: userId,
        bookmark_id: bmId,
        created_at: importMetadata?.savedAt ?? new Date(),
        updated_at: new Date(),
        type,
        archive_status: isArchive ? 1 : 0,
        is_starred: importMetadata?.starred ?? false
      },
      update: importMetadata ? {} : { created_at: new Date(), updated_at: new Date() }
    })
  }

  public async listAllUserBookmarks(userId: number) {
    return await this.prismaPg().sr_user_bookmark.findMany({ where: { user_id: userId, deleted_at: null } })
  }

  public async listUserStarBookmarksByTargetUser(userId: number, offset: number, limit: number, subscribeEndTime: Date) {
    return await this.prismaPg().sr_user_bookmark.findMany({
      where: { user_id: userId, deleted_at: null, is_starred: true, created_at: { lte: subscribeEndTime } },
      skip: offset,
      take: limit,
      include: { bookmark: true },
      orderBy: { created_at: 'desc' }
    })
  }

  public async getExportUpperId(userId: number): Promise<number> {
    const row = await this.prismaPg().sr_user_bookmark.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { id: 'desc' },
      select: { id: true }
    })
    return row?.id ?? 0
  }

  public async listExportBookmarks(userId: number, afterId: number, upperId: number) {
    return this.prismaPg().sr_user_bookmark.findMany({
      where: { user_id: userId, deleted_at: null, id: { gt: afterId, lte: upperId } },
      orderBy: { id: 'asc' },
      take: 501,
      select: {
        id: true,
        alias_title: true,
        created_at: true,
        is_read: true,
        archive_status: true,
        is_starred: true,
        type: true,
        bookmark: { select: { target_url: true, title: true } },
        sr_user_bookmark_tag: {
          where: { user_id: userId, is_deleted: false },
          orderBy: { id: 'asc' },
          select: { tag_name: true, source: true }
        }
      }
    })
  }

  public async listUserBookmarks(userId: number, offset: number, limit: number, filter: string) {
    let where: any = { user_id: userId, deleted_at: null }
    let orderBy: any = { created_at: 'desc' }

    if (['read', 'unread'].includes(filter)) {
      where.is_read = filter === 'read'
    } else if (['archive', 'later', 'inbox'].includes(filter)) {
      // inbox: 0, archive: 1, later: 2
      const archiveStatus = filter === 'archive' ? 1 : filter === 'later' ? 2 : 0
      where.archive_status = archiveStatus
      // no nulls (backfill+trigger) → matches index
      if (filter === 'archive') orderBy = { archived_at: 'desc' }
    } else if (filter === 'starred') {
      where.is_starred = true
      orderBy = { starred_at: 'desc' }
    } else if (filter === 'trashed') {
      where.deleted_at = { not: null }
      orderBy = { deleted_at: 'desc' }
    } else if (filter === 'untagged') {
      return await this.listUntaggedUserBookmarks(userId, offset, limit)
    }

    return await this.prismaPg().sr_user_bookmark.findMany({
      where,
      skip: offset,
      take: limit,
      include: this.userBookmarkListInclude(),
      orderBy
    })
  }

  /** list rows carry the live tag links so the list UI can draw chips without a second round trip */
  private userBookmarkListInclude() {
    return {
      bookmark: true,
      sr_user_bookmark_tag: { where: { is_deleted: false }, orderBy: { created_at: 'asc' as const } }
    }
  }

  /**
   * Bookmarks that carry every tag in tagIds (intersection).
   * Uses metadata.tags (uuid array kept by trigger_tag_uuid_update) with jsonb containment,
   * so one query serves n = 1 and n > 1 alike.
   */
  public async listUserBookmarksByTagIds(userId: number, tagIds: number[], offset: number, limit: number) {
    if (tagIds.length < 1) return []
    const tags = await this.prismaPg().sr_user_tag.findMany({ where: { id: { in: tagIds }, user_id: userId }, select: { uuid: true } })
    if (tags.length !== tagIds.length) return []

    return await this.prismaPg().sr_user_bookmark.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        metadata: { path: ['tags'], array_contains: tags.map(t => t.uuid) }
      },
      skip: offset,
      take: limit,
      include: this.userBookmarkListInclude(),
      orderBy: { created_at: 'desc' }
    })
  }

  /** Bookmarks with no live tag. Raw SQL so rows whose metadata lacks a tags array still count as untagged. */
  public async listUntaggedUserBookmarks(userId: number, offset: number, limit: number) {
    const rows = await this.prismaPg().$queryRaw<{ id: number }[]>`
      SELECT id FROM sr_user_bookmark
      WHERE user_id = ${userId} AND deleted_at IS NULL
        AND (jsonb_typeof(metadata->'tags') IS DISTINCT FROM 'array' OR metadata->'tags' = '[]'::jsonb)
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}`
    if (rows.length < 1) return []

    return await this.prismaPg().sr_user_bookmark.findMany({
      where: { id: { in: rows.map(r => r.id) } },
      include: this.userBookmarkListInclude(),
      orderBy: { created_at: 'desc' }
    })
  }

  /**
   * For the "+" picker on the multi-tag filter page: tags that still appear inside the
   * intersection of `uuids`, with how many bookmarks each one would leave.
   */
  public async countTagsWithinBookmarks(userId: number, uuids: string[], excludeTagIds: number[]) {
    if (uuids.length < 1) return []
    const exclude = excludeTagIds.length > 0 ? Prisma.sql`AND bt.tag_id NOT IN (${Prisma.join(excludeTagIds)})` : Prisma.empty
    return await this.prismaPg().$queryRaw<{ tag_id: number; count: number }[]>`
      SELECT bt.tag_id, COUNT(DISTINCT bt.bookmark_id)::int AS count
      FROM sr_user_bookmark_tag bt
      JOIN sr_user_bookmark ub ON ub.bookmark_id = bt.bookmark_id AND ub.user_id = bt.user_id
      WHERE bt.user_id = ${userId}
        AND bt.is_deleted = false
        AND ub.deleted_at IS NULL
        AND ub.metadata->'tags' @> ${JSON.stringify(uuids)}::jsonb
        ${exclude}
      GROUP BY bt.tag_id`
  }

  public async updateBookmark(bmId: number, info: bookmarkParsePO) {
    return await this.prismaPg().sr_bookmark.update({ where: { id: bmId }, data: { updated_at: new Date(), ...info } })
  }

  public async upsertBookmarkSummary(info: bookmarkSummaryPO) {
    const { bookmark_id, lang, user_id, ...infoWithoutIds } = info
    return await this.prismaPg().sr_bookmark_summary.upsert({
      where: { bookmark_id_lang_user_id: { bookmark_id: bookmark_id, lang: lang, user_id: user_id } },
      create: { ...info, created_at: new Date() },
      update: { ...infoWithoutIds, updated_at: new Date() }
    })
  }

  public async deleteBookmarkSummary(bmId: number, userId: number) {
    return await this.prismaPg().sr_bookmark_summary.deleteMany({ where: { bookmark_id: bmId, user_id: userId } })
  }

  public async updateBookmarkArchiveStatus(bmId: number, userId: number, status: number) {
    await this.prismaPg().sr_user_bookmark.update({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      data: { archive_status: status }
    })
  }

  public async updateBookmarkStarStatus(bmId: number, userId: number, status: boolean) {
    return await this.prismaPg().sr_user_bookmark.update({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      data: { is_starred: status }
    })
  }

  public async updateBookmarkStatus(bmId: number, status: queueStatus) {
    return await this.prismaPg().sr_bookmark.update({ where: { id: bmId }, data: { status, updated_at: new Date() } })
  }

  public async updateBookmarkAliasTitle(bmId: number, userId: number, alias_title: string) {
    return await this.prismaPg().sr_user_bookmark.update({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      data: { alias_title }
    })
  }

  public async updateUserBookmarkBookmarkId(id: number, bookmarkId: number) {
    return await this.prismaPg().sr_user_bookmark.update({ where: { id }, data: { bookmark_id: bookmarkId, updated_at: new Date() } })
  }

  public async getBookmarkShareByBookmarkId(bmId: number, userId: number) {
    return await this.prismaPg().sr_bookmark_share.findFirst({ where: { bookmark_id: bmId, user_id: userId } })
  }

  public async deleteBookmarkShare(bmId: number, userId: number) {
    try {
      await this.prismaPg().sr_bookmark_share.delete({ where: { bookmark_id_user_id: { bookmark_id: bmId, user_id: userId } } })
    } catch (err) {
      const error = err as { code: string; message: string; name: string }
      if (error.code === 'P2025') return null
      console.log(`delete bookmark share failed: ${err}`)
      return null
    }
  }

  public async updateBookmarkShareIsEnable(bmId: number, userId: number, isEnable: boolean) {
    return await this.prismaPg().sr_bookmark_share.update({
      where: { bookmark_id_user_id: { bookmark_id: bmId, user_id: userId } },
      data: { is_enable: isEnable }
    })
  }

  public async getBookmarkShareByShareCode(shareCode: string) {
    return await this.prismaPg().sr_bookmark_share.findFirst({ where: { share_code: shareCode } })
  }

  public async createBookmarkShare(shareCode: string, userId: number, bmId: number, showCommentLine: boolean, showUserinfo: boolean, allowAction: boolean) {
    try {
      return await this.prismaPg().sr_bookmark_share.create({
        data: {
          share_code: shareCode,
          user_id: userId,
          bookmark_id: bmId,
          created_at: new Date(),
          show_userinfo: showUserinfo,
          show_line: showCommentLine,
          show_comment: showCommentLine,
          allow_comment: allowAction,
          allow_line: allowAction
        }
      })
    } catch (err) {
      console.log(`create bookmark share failed: ${err}`)
      // 失败要抛出，让上层走错误响应；之前 return 错误对象会被 createShare 当成 share 行，导致返回畸形 200
      throw CreateBookmarkShareUniqueFail()
    }
  }

  public async updateBookmarkShare(bmId: number, userId: number, showCommentLine: boolean, showUserinfo: boolean, allowAction: boolean) {
    return await this.prismaPg().sr_bookmark_share.update({
      where: {
        bookmark_id_user_id: {
          bookmark_id: bmId,
          user_id: userId
        }
      },
      data: {
        show_line: showCommentLine,
        show_comment: showCommentLine,
        show_userinfo: showUserinfo,
        allow_comment: allowAction,
        allow_line: allowAction,
        is_enable: true
      }
    })
  }

  /**
   * A tag the user typed is "mine". If the name already exists as an auto tag,
   * the user has just claimed it: same row, same links, source flips to mine.
   */
  public async createUserTag(userId: number, tag: string, source: UserTagSource = 'mine') {
    if (!tag) return
    return this.prismaPg().sr_user_tag.upsert({
      where: {
        user_id_tag_name: {
          user_id: userId,
          tag_name: tag
        }
      },
      create: {
        user_id: userId,
        tag_name: tag,
        created_at: new Date(),
        display: true,
        source
      },
      // an auto write (e.g. import) never demotes a tag the user already claimed
      update: source === 'mine' ? { display: true, source } : { display: true }
    })
  }

  public async createUserTags(userId: number, tags: string[]) {
    if (!tags.length) return
    return this.prismaPg().sr_user_tag.createManyAndReturn({
      data: tags.map(tag => ({
        user_id: userId,
        tag_name: tag,
        created_at: new Date(),
        display: true,
        source: 'mine'
      })),
      skipDuplicates: true
    })
  }

  public async updateUserTagDisplay(userId: number, tagId: number, display: boolean) {
    return await this.prismaPg().sr_user_tag.update({
      where: { id: tagId, user_id: userId },
      data: { display }
    })
  }

  public async updateUserTagSource(userId: number, tagId: number, source: UserTagSource) {
    return await this.prismaPg().sr_user_tag.update({
      where: { id: tagId, user_id: userId },
      data: { source }
    })
  }

  /** the user just attached these tags by hand; AI attachments never call this */
  public async touchUserTagsLastUsed(userId: number, tagIds: number[]) {
    if (tagIds.length < 1) return 0
    return await this.prismaPg().sr_user_tag.updateMany({
      where: { id: { in: tagIds }, user_id: userId },
      data: { last_used_at: new Date() }
    })
  }

  public async createBookmarkTag(bmId: number, userId: number, tagId: number, tagName: string, source: BookmarkTagSource) {
    return await this.prismaPg().sr_user_bookmark_tag.upsert({
      where: { bookmark_id_user_id_tag_id: { bookmark_id: bmId, user_id: userId, tag_id: tagId } },
      create: { user_id: userId, bookmark_id: bmId, tag_id: tagId, tag_name: tagName, created_at: new Date(), source },
      // a link soft-deleted through PowerSync comes back alive when re-added over HTTP
      update: { is_deleted: false, source }
    })
  }

  /** soft delete, same tombstone the PowerSync path writes; the metadata trigger handles both */
  public async deleteBookmarkTag(bookmarkId: number, userId: number, tagId: number) {
    return await this.prismaPg().sr_user_bookmark_tag.updateMany({
      where: { bookmark_id: bookmarkId, user_id: userId, tag_id: tagId },
      data: { is_deleted: true }
    })
  }

  /** the tags page "delete": detach from every bookmark */
  public async softDeleteBookmarkTagsByTag(userId: number, tagId: number) {
    return await this.prismaPg().sr_user_bookmark_tag.updateMany({
      where: { tag_id: tagId, user_id: userId, is_deleted: false },
      data: { is_deleted: true }
    })
  }

  public async countBookmarksByTag(userId: number, tagId: number) {
    const [result] = await this.prismaPg().$queryRaw<[{ exists: boolean }]>`
      SELECT EXISTS (
        SELECT 1
        FROM sr_user_bookmark_tag
        WHERE user_id = ${userId} AND tag_id = ${tagId} AND is_deleted = false
      ) as "exists"`
    return result.exists
  }

  public async deleteUserTag(userId: number, tagId: number) {
    return await this.prismaPg().sr_user_tag.update({ where: { id: tagId, user_id: userId }, data: { display: false } })
  }

  public async getBookmarkTags(userId: number, bookmarkId: number) {
    return await this.prismaPg().sr_user_bookmark_tag.findMany({ where: { bookmark_id: bookmarkId, user_id: userId, is_deleted: false } })
  }

  /** the live vocabulary, mine first by recency. Serves both the tags page and the AI picker */
  public async getUserTags(userId: number) {
    return await this.prismaPg().sr_user_tag.findMany({
      where: { user_id: userId, display: true },
      orderBy: [{ last_used_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }]
    })
  }

  public async getUserTagById(userId: number, tagId: number) {
    return await this.prismaPg().sr_user_tag.findFirst({ where: { id: tagId, user_id: userId } })
  }

  public async getUserTagByUuid(userId: number, uuid: string) {
    return await this.prismaPg().sr_user_tag.findFirst({ where: { uuid, user_id: userId } })
  }

  public async getUserTagsByIds(userId: number, tagIds: number[]) {
    if (tagIds.length < 1) return []
    return await this.prismaPg().sr_user_tag.findMany({ where: { id: { in: tagIds }, user_id: userId } })
  }

  /** case-insensitive exact match; caller normalizes whitespace and width first */
  public async findUserTagByName(userId: number, tagName: string) {
    return await this.prismaPg().sr_user_tag.findFirst({ where: { user_id: userId, tag_name: { equals: tagName, mode: 'insensitive' } } })
  }

  public async updateUserTag(userId: number, tagId: number, tagName: string) {
    return await this.prismaPg().sr_user_tag.update({ where: { id: tagId, user_id: userId }, data: { tag_name: tagName } })
  }

  public async updateBookmarkTag(userId: number, tagId: number, tagName: string) {
    await this.prismaPg().sr_user_bookmark_tag.updateMany({ where: { tag_id: tagId, user_id: userId }, data: { tag_name: tagName } })
  }

  public async createBookmarkOverview(userId: number, bookmarkId: number, overview: string, content: string) {
    return await this.prismaPg().sr_user_bookmark_overview.upsert({
      // @ts-ignore
      where: { bookmark_id_user_id: { bookmark_id: bookmarkId, user_id: userId } },
      create: {
        user_id: userId,
        bookmark_id: bookmarkId,
        overview: overview,
        content: content,
        created_at: new Date()
      },
      update: {}
    })
  }

  public async getBookmarkListByUid(userId: number, uid: string) {
    return await this.prismaPg().$queryRaw<{ content_key: string; uuid: string }[]>(Prisma.sql`
     SELECT sb.content_key,sub.uuid  FROM sr_bookmark sb
     INNER JOIN (SELECT bookmark_id, uuid FROM sr_user_bookmark WHERE user_id = ${userId} AND uuid = ${uid}) sub ON sb.id = sub.bookmark_id;`)
  }

  public async getUserBookmarkOverview(userId: number, bookmarkId: number) {
    return await this.prismaPg().sr_user_bookmark_overview.findFirst({
      where: {
        user_id: userId,
        bookmark_id: bookmarkId
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  public async createBookmarkImportTask(userId: number, type: string, objectKey: string, totalCount: number, batchCount: number) {
    return await this.prismaPg().sr_bookmark_import.create({
      data: {
        user_id: userId,
        type,
        object_key: objectKey,
        created_at: new Date(),
        status: 1,
        reason: 'PENDING',
        total_count: totalCount,
        batch_count: batchCount
      }
    })
  }

  public async appendImportTaskErrLog(importId: number, errLog: string) {
    this.prismaPg().$executeRaw`UPDATE sr_bookmark_import SET reason = reason || '\n' || ${errLog} WHERE id = ${importId}`
  }

  public async getUserImportTask(userId: number) {
    return await this.prismaPg().sr_bookmark_import.findMany({ where: { user_id: userId } })
  }

  public async getUnfinishedImportTask() {
    return await this.prismaPg().sr_bookmark_import.findMany({ where: { status: 1 } })
  }

  public async updateBookmarkImportTask(importId: number, status: number, reason: string) {
    return await this.prismaPg().sr_bookmark_import.update({
      where: { id: importId },
      data: { status, reason }
    })
  }

  public async getUserImportTaskByType(userId: number, type: string) {
    return await this.prismaPg().sr_bookmark_import.findMany({
      where: {
        user_id: userId,
        type,
        status: {
          in: [0, 1]
        }
      }
    })
  }

  public async getExpiredTrashedBookmark() {
    return await this.prismaPg().sr_user_delete_bookmark.findMany({
      where: { deleted_at: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
    })
  }

  public async batchGetBookmarkComment(commentIds: number[]) {
    return await this.prismaPg().sr_bookmark_comment.findMany({ where: { id: { in: commentIds } } })
  }

  public async batchGetBookmarkTitle(bookmarkIdList: number[]): Promise<bookmarkTitlePO[]> {
    return await this.prismaPg().$queryRaw<bookmarkTitlePO[]>(Prisma.sql`
      SELECT title, u.id as user_bookmark_id 
      FROM sr_bookmark b 
      INNER JOIN sr_user_bookmark u ON b.id = u.bookmark_id
      WHERE u.id IN (${Prisma.join(bookmarkIdList)})`)
  }

  public async getUserBookmarkSummary(bookmarkId: number, userId: number, lang: string) {
    return await this.prismaPg().sr_bookmark_summary.findFirst({
      where: {
        bookmark_id: bookmarkId,
        user_id: userId,
        lang
      }
    })
  }

  public async getBookmarkOutline(bookmarkId: number, userId: number) {
    return await this.prismaPg().sr_bookmark_summary.findFirst({
      where: { bookmark_id: bookmarkId, user_id: userId },
      orderBy: { id: 'desc' }
    })
  }

  public async getBookmarkSummariesRaw(bookmarkId: number, lang: string, userId: number, limit: number) {
    return await this.prismaPg().$queryRaw<bookmarkSummaryPO[]>`
      SELECT * FROM (SELECT * FROM sr_bookmark_summary WHERE user_id = ${userId} AND bookmark_id = ${bookmarkId} AND lang = ${lang} LIMIT ${limit})
      UNION ALL
      SELECT * FROM (SELECT * FROM sr_bookmark_summary WHERE bookmark_id = ${bookmarkId} AND lang = ${lang} LIMIT ${limit})
    `
  }

  public async createBookmarkFetchRetry(bookmarkId: number, userId: number, retryCount?: number) {
    return await this.prismaPg().sr_bookmark_fetch_retry.upsert({
      where: { bookmark_id_user_id: { bookmark_id: bookmarkId, user_id: userId } },
      create: { retry_count: retryCount || 0, bookmark_id: bookmarkId, user_id: userId },
      update: {}
    })
  }

  public async getFilterBookmarkFetchRetries(options: { status: bookmarkFetchRetryStatus }) {
    const res = await this.prismaPg().$queryRaw<{ bookmark_id: number; retry_counts: string; user_ids: string; created_at: string }[]>`
    SELECT  bookmark_id, string_agg(retry_count::text, ',') as retry_counts, string_agg(user_id::text, ',') as user_ids, created_at FROM sr_bookmark_fetch_retry 
      WHERE status = ${options.status}
      GROUP BY bookmark_id`
    return res || []
  }

  public async updateBookmarkFetchRetry(bookmarkId: number, options: { retry_count?: number; last_retry_at?: Date; status?: bookmarkFetchRetryStatus; trace_id?: string }) {
    return await this.prismaPg().sr_bookmark_fetch_retry.updateMany({
      where: { bookmark_id: bookmarkId },
      data: { ...options }
    })
  }

  public async upsertVectorShard(bookmarkId: number, shardIdx: number) {
    return await this.prismaPg().sr_bookmark_vector_shard.upsert({
      where: { bookmark_id: bookmarkId },
      create: { bookmark_id: bookmarkId, bucket_idx: shardIdx, created_at: new Date() },
      update: { created_at: new Date() }
    })
  }

  public async getVectorShard(bookmarkId: number) {
    return await this.prismaPg().sr_bookmark_vector_shard.findFirst({ where: { bookmark_id: bookmarkId } })
  }

  public async getBookmarkVectorShard(userId: number) {
    if (userId < 1) return []

    try {
      return await this.prismaPg().$queryRaw<bookmarkShardPO[]>`SELECT id, vs.bookmark_id, vs.bucket_idx, vs.created_at FROM sr_bookmark_vector_shard vs
      INNER JOIN (SELECT bookmark_id FROM sr_user_bookmark WHERE user_id = ${userId}) ub on vs.bookmark_id = ub.bookmark_id`
    } catch (e) {
      console.log(e, 'getBookmarkVectorShard error')
      return []
    }
  }

  public async getUserBookmarkIds(userId: number) {
    return await this.prismaPg().sr_user_bookmark.findMany({ where: { user_id: userId }, select: { bookmark_id: true } })
  }

  public async getAllBookmarkChanges(userId: number) {
    try {
      const res = await this.prismaPg().$queryRaw<bookmarkChangePO[]>`SELECT sb.target_url, sb.id as bookmark_id, ub.created_at 
      FROM sr_bookmark sb 
      INNER JOIN 
      (SELECT id, bookmark_id, user_id, created_at FROM sr_user_bookmark WHERE user_id = ${userId}) ub 
      ON sb.id = ub.bookmark_id 
      ORDER BY ub.created_at DESC`

      return res
    } catch (e) {
      console.log(e, 'getAllBookmarkChanges error')
      return []
    }
  }

  public async createBookmarkChangeLog(userId: number, url: string, bookmarkId: number, action: 'add' | 'delete' | 'update', time: Date) {
    try {
      return await this.prisma().slax_user_bookmark_change.create({
        data: {
          user_id: userId,
          target_url: url,
          bookmark_id: bookmarkId,
          action,
          created_at: time
        }
      })
    } catch (e) {
      console.log(e, 'createBookmarkChangeLog error')
      return
    }
  }

  public async getPartialBookmarkChanges(userId: number, time: number, limit = 5000) {
    const res = await this.prisma().slax_user_bookmark_change.findMany({
      where: {
        user_id: userId,
        created_at: {
          gt: new Date(time)
        }
      },
      orderBy: {
        created_at: 'asc'
      },
      take: limit
    })

    return res as bookmarkActionChangePO[]
  }

  /**
   * 批量贴标签。删除是软删，所以用户再贴要把 is_deleted 翻回来；
   * AI 贴的遇到已有行（含用户删过的）一律不动，尊重用户的移除。
   */
  public async upsertBookmarkTags(bmId: number, userId: number, tags: { id: number; tag_name: string }[], source: BookmarkTagSource = 'ai') {
    if (tags.length < 1) return 0
    const tagIds = tags.map(t => t.id)
    const tagNames = tags.map(t => t.tag_name)
    const onConflict = source === 'user' ? Prisma.sql`DO UPDATE SET is_deleted = false, source = 'user'` : Prisma.sql`DO NOTHING`

    return await this.prismaPg().$executeRaw`
      INSERT INTO sr_user_bookmark_tag(user_id, bookmark_id, tag_id, tag_name, created_at, source)
      SELECT ${userId}, ${bmId}, tag_id, tag_name, NOW(), ${source}
      FROM UNNEST(${tagIds}::int[], ${tagNames}::text[]) AS t(tag_id, tag_name)
      ON CONFLICT(user_id, bookmark_id, tag_id) ${onConflict};
    `
  }

  /** the live vocabulary rows for these names; misses and hidden words are dropped. AI paths use this, never an upsert */
  public async getUserTagsByNames(userId: number, names: string[]) {
    if (names.length < 1) return []
    return await this.prismaPg().sr_user_tag.findMany({ where: { user_id: userId, display: true, tag_name: { in: names } } })
  }

  /**
   * User path: resolve names to ids in one round trip, creating missing words and showing
   * hidden ones again. `createSource` says what a brand-new word is: a word the user typed is
   * "mine", an imported word is "auto". With revive=false the conflict branch leaves display alone
   * (kept for callers that only need ids; AI paths should use getUserTagsByNames instead).
   */
  public async updateUserTagsDisplay(userId: number, names: string[], revive = false, createSource: UserTagSource = 'mine') {
    if (names.length < 1) return []
    return await this.prismaPg().$queryRaw<{ id: number; tag_name: string; source: string }[]>`
      INSERT INTO sr_user_tag(user_id, tag_name, display, source)
      SELECT ${userId}, tag_name, true, ${createSource}
      FROM UNNEST(${names}::text[]) AS tag_name
      ON CONFLICT(user_id, tag_name) 
      DO UPDATE SET display = CASE WHEN ${revive} THEN true ELSE sr_user_tag.display END
      RETURNING id, tag_name, source;
    `
  }
}

import { Prisma, PrismaClient } from '@prisma/client'
import { MultiLangError } from '../../utils/multiLangError'
import { BookmarkNotFoundError, CreateBookmarkShareUniqueFail, DeleteBookmarkFailError } from '../../const/err'
import { inject, injectable, singleton } from '../../decorators/di'
import { PRISIMA_CLIENT } from '../../const/symbol'
import type { LazyInstance } from '../../decorators/lazy'

export enum queueStatus {
  PENDING = 'pending',
  PARSEING = 'parseing',
  RETRYING = 'retrying',
  FAILED = 'failed',
  PENDING_RETRY = 'pending_retry', // 失败后如果重新发起抓取，状态变为此状态
  SUCCESS = 'success'
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
  constructor(@inject(PRISIMA_CLIENT) private prisma: LazyInstance<PrismaClient>) {}

  public async deleteUserBookmark(bmId: number, userId: number): Promise<MultiLangError | null> {
    try {
      await this.prisma().slax_user_delete_bookmark.delete({ where: { user_id_bookmark_id: { user_id: Number(userId), bookmark_id: Number(bmId) } } })
    } catch (e) {
      const err = e as { code: string; message: string; name: string }
      if (err.code !== 'P2025') {
        console.log(`delete expired trashed bookmark failed: ${err}`)
        return DeleteBookmarkFailError()
      }

      console.log(`delete expired trashed bookmark failed: ${err}`)
    }

    try {
      await this.prisma().slax_user_bookmark_tag.deleteMany({ where: { bookmark_id: Number(bmId), user_id: Number(userId) } })
      await this.prisma().slax_user_bookmark.delete({ where: { user_id_bookmark_id: { bookmark_id: Number(bmId), user_id: Number(userId) } } })
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
        this.prisma().slax_user_delete_bookmark.create({
          data: {
            user_id: userId,
            bookmark_id: bmId,
            deleted_at: date
          }
        })
      )
    } else {
      deleteTasks.push(this.prisma().slax_user_delete_bookmark.delete({ where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } } }))
    }

    deleteTasks.push(
      this.prisma().slax_user_bookmark.update({
        where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
        data: { deleted_at: isDeleted ? date : null, updated_at: date }
      })
    )

    deleteTasks.push(
      this.prisma().slax_user_bookmark_tag.updateMany({
        where: { bookmark_id: bmId, user_id: userId },
        data: { is_deleted: isDeleted }
      })
    )

    await Promise.allSettled(deleteTasks)
  }

  public async deleteBookmarkTry(bmId: number, userId: number): Promise<bookmarkPO | null> {
    try {
      const bookmark = await this.prisma().slax_bookmark.findUnique({ where: { id: bmId } })
      if (!bookmark || bookmark.private_user !== userId) return null
      const res = await this.prisma().slax_bookmark.delete({ where: { id: bmId } })

      return { bookmark_id: res.id, ...res }
    } catch (e) {
      console.log(`delete bookmark failed:`, e)
      return null
    }
  }

  public async getBookmarkById(bmId: number) {
    try {
      return await this.prisma().slax_bookmark.findFirst({ where: { id: bmId } })
    } catch (err) {
      console.log(`get bookmark by id failed: ${err}`)
      throw BookmarkNotFoundError()
    }
  }

  public async getBookmark(targetUrl: string, privateUser: number): Promise<bookmarkPO | null> {
    const res = await this.prisma().slax_bookmark.findFirst({
      where: {
        target_url: targetUrl,
        private_user: privateUser
      }
    })
    if (!res) return null
    return { bookmark_id: res.id, ...res }
  }

  public async getUserBookmark(bmId: number, userId: number) {
    return await this.prisma().slax_user_bookmark.findFirst({ where: { bookmark_id: bmId, user_id: userId } })
  }

  public async getUserBookmarkById(id: number) {
    return await this.prisma().slax_user_bookmark.findFirst({ where: { id } })
  }

  public async getUserBookmarkByUserBmId(userBmId: number) {
    return await this.prisma().slax_user_bookmark.findFirst({ where: { id: userBmId }, include: { bookmark: true } })
  }

  public async getUserBookmarkWithDetail(bmId: number, userId: number) {
    try {
      return await this.prisma().slax_user_bookmark.findFirst({
        where: { bookmark_id: bmId, user_id: userId },
        include: { bookmark: true }
      })
    } catch (err) {
      console.error(`get user bookmark detail failed: ${err}`)
      throw BookmarkNotFoundError()
    }
  }

  public async createBookmark(info: bookmarkPO, status: string) {
    return await this.prisma().slax_bookmark.upsert({
      where: { target_url_private_user: { target_url: info.target_url, private_user: info.private_user || 0 } },
      create: { ...info, created_at: new Date(), updated_at: new Date(), published_at: new Date(), status },
      update: { ...info, updated_at: new Date() }
    })
  }

  public async createBookmarkRelation(userId: number, bmId: number, type: number) {
    return await this.prisma().slax_user_bookmark.upsert({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      create: { user_id: userId, bookmark_id: bmId, created_at: new Date(), updated_at: new Date(), type },
      update: { updated_at: new Date() }
    })
  }

  public async listAllUserBookmarks(userId: number) {
    return await this.prisma().slax_user_bookmark.findMany({ where: { user_id: userId, deleted_at: null } })
  }

  public async listUserStarBookmarksByTargetUser(userId: number, offset: number, limit: number, subscribeEndTime: Date) {
    return await this.prisma().slax_user_bookmark.findMany({
      where: { user_id: userId, deleted_at: null, is_starred: true, updated_at: { lte: subscribeEndTime } },
      skip: offset,
      take: limit,
      include: { bookmark: true },
      orderBy: { updated_at: 'desc' }
    })
  }

  public async listUserBookmarks(userId: number, offset: number, limit: number, filter: string) {
    let where: any = { user_id: userId, deleted_at: null }
    let orderBy: any = { updated_at: 'desc' }

    if (['read', 'unread'].includes(filter)) {
      where.is_read = filter === 'read'
    } else if (['archive', 'later', 'inbox'].includes(filter)) {
      // inbox: 0, archive: 1, later: 2
      const archiveStatus = filter === 'archive' ? 1 : filter === 'later' ? 2 : 0
      where.archive_status = archiveStatus
    } else if (filter === 'starred') {
      where.is_starred = true
    } else if (filter === 'trashed') {
      where.deleted_at = { not: null }
      orderBy = { deleted_at: 'desc' }
    }

    return await this.prisma().slax_user_bookmark.findMany({
      where,
      skip: offset,
      take: limit,
      include: {
        bookmark: true
      },
      orderBy
    })
  }

  public async listUserBookmarksByTagId(userId: number, tagId: number, offset: number, limit: number) {
    return await this.prisma().slax_user_bookmark_tag.findMany({
      where: {
        user_id: userId,
        tag_id: tagId,
        is_deleted: false
      },
      skip: offset,
      take: limit,
      include: {
        user_bookmark: true,
        bookmark: true
      }
    })
  }

  public async updateBookmark(bmId: number, info: bookmarkParsePO) {
    return await this.prisma().slax_bookmark.update({ where: { id: bmId }, data: { updated_at: new Date(), ...info } })
  }

  public async upsertBookmarkSummary(info: bookmarkSummaryPO) {
    const { bookmark_id, lang, user_id, ...infoWithoutIds } = info
    return await this.prisma().slax_bookmark_summary.upsert({
      where: { bookmark_id_lang_user_id: { bookmark_id: bookmark_id, lang: lang, user_id: user_id } },
      create: { ...info, created_at: new Date() },
      update: { ...infoWithoutIds, updated_at: new Date() }
    })
  }

  public async deleteBookmarkSummary(bmId: number, userId: number) {
    return await this.prisma().slax_bookmark_summary.deleteMany({ where: { bookmark_id: bmId, user_id: userId } })
  }

  public async updateBookmarkIsRead(bmId: number, userId: number) {
    await this.prisma().slax_user_bookmark.update({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      data: { is_read: true }
    })
  }

  public async updateBookmarkArchiveStatus(bmId: number, userId: number, status: number) {
    await this.prisma().slax_user_bookmark.update({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      data: { archive_status: status }
    })
  }

  public async updateBookmarkStarStatus(bmId: number, userId: number, status: boolean) {
    return await this.prisma().slax_user_bookmark.update({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      data: { is_starred: status }
    })
  }

  public async updateBookmarkStatus(bmId: number, status: queueStatus) {
    return await this.prisma().slax_bookmark.update({ where: { id: bmId }, data: { status, updated_at: new Date() } })
  }

  public async updateBookmarkAliasTitle(bmId: number, userId: number, alias_title: string) {
    return await this.prisma().slax_user_bookmark.update({
      where: { user_id_bookmark_id: { user_id: userId, bookmark_id: bmId } },
      data: { alias_title }
    })
  }

  public async updateUserBookmarkBookmarkId(id: number, bookmarkId: number) {
    return await this.prisma().slax_user_bookmark.update({ where: { id }, data: { bookmark_id: bookmarkId, updated_at: new Date() } })
  }

  public async getBookmarkShareByBookmarkId(bmId: number, userId: number) {
    return await this.prisma().slax_bookmark_share.findFirst({ where: { bookmark_id: bmId, user_id: userId } })
  }

  public async deleteBookmarkShare(bmId: number, userId: number) {
    try {
      await this.prisma().slax_bookmark_share.delete({ where: { bookmark_id_user_id: { bookmark_id: bmId, user_id: userId } } })
    } catch (err) {
      const error = err as { code: string; message: string; name: string }
      if (error.code === 'P2025') return null
      console.log(`delete bookmark share failed: ${err}`)
      return null
    }
  }

  public async updateBookmarkShareIsEnable(bmId: number, userId: number, isEnable: boolean) {
    return await this.prisma().slax_bookmark_share.update({
      where: { bookmark_id_user_id: { bookmark_id: bmId, user_id: userId } },
      data: { is_enable: isEnable }
    })
  }

  public async getBookmarkShareByShareCode(shareCode: string) {
    return await this.prisma().slax_bookmark_share.findFirst({ where: { share_code: shareCode } })
  }

  public async createBookmarkShare(shareCode: string, userId: number, bmId: number, showCommentLine: boolean, showUserinfo: boolean, allowAction: boolean) {
    try {
      return await this.prisma().slax_bookmark_share.create({
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
      return CreateBookmarkShareUniqueFail()
    }
  }

  public async updateBookmarkShare(bmId: number, userId: number, showCommentLine: boolean, showUserinfo: boolean, allowAction: boolean) {
    return await this.prisma().slax_bookmark_share.update({
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

  public async createUserTag(userId: number, tag: string, systemTag: boolean) {
    if (!tag) return
    return this.prisma().slax_user_tag.upsert({
      where: {
        user_id_tag_name_system_tag: {
          user_id: userId,
          tag_name: tag,
          system_tag: systemTag
        }
      },
      create: {
        user_id: userId,
        tag_name: tag,
        system_tag: systemTag,
        created_at: new Date(),
        display: true
      },
      update: {
        display: true
      }
    })
  }

  public async updateUserTagDisplay(userId: number, tagId: number, display: boolean) {
    return await this.prisma().slax_user_tag.update({
      where: { id: tagId, user_id: userId },
      data: { display: true }
    })
  }

  public async createBookmarkTag(bmId: number, userId: number, tagId: number, tagName: string, systemTag: boolean) {
    return await this.prisma().slax_user_bookmark_tag.upsert({
      where: { bookmark_id_user_id_tag_id: { bookmark_id: bmId, user_id: userId, tag_id: tagId } },
      create: { user_id: userId, bookmark_id: bmId, tag_id: tagId, tag_name: tagName, system_tag: systemTag, created_at: new Date() },
      update: {}
    })
  }

  public async deleteBookmarkTag(bookmarkId: number, userId: number, tagId: number) {
    return await this.prisma().slax_user_bookmark_tag.delete({
      where: { bookmark_id_user_id_tag_id: { bookmark_id: bookmarkId, user_id: userId, tag_id: tagId } }
    })
  }

  public async countBookmarksByTag(userId: number, tagId: number) {
    const [result] = await this.prisma().$queryRaw<[{ exists: boolean }]>`
      SELECT EXISTS (
        SELECT 1 
        FROM slax_user_bookmark_tag 
        WHERE user_id = ${userId} AND tag_id = ${tagId}
      ) as "exists"`
    return result.exists
  }

  public async deleteUserTag(userId: number, tagId: number) {
    return await this.prisma().slax_user_tag.update({ where: { id: tagId, user_id: userId }, data: { display: false } })
  }

  public async getBookmarkTags(userId: number, bookmarkId: number) {
    return await this.prisma().slax_user_bookmark_tag.findMany({ where: { bookmark_id: bookmarkId, user_id: userId } })
  }

  public async getUserTags(userId: number) {
    return await this.prisma().slax_user_tag.findMany({ where: { user_id: userId } })
  }

  public async getUserTagById(userId: number, tagId: number) {
    return await this.prisma().slax_user_tag.findFirst({ where: { id: tagId, user_id: userId } })
  }

  public async updateUserTag(userId: number, tagId: number, tagName: string) {
    return await this.prisma().slax_user_tag.update({ where: { id: tagId, user_id: userId }, data: { tag_name: tagName } })
  }

  public async updateBookmarkTag(userId: number, tagId: number, tagName: string) {
    await this.prisma().slax_user_bookmark_tag.updateMany({ where: { tag_id: tagId, user_id: userId }, data: { tag_name: tagName } })
  }

  public async createBookmarkImportTask(userId: number, type: string, objectKey: string, totalCount: number, batchCount: number) {
    return await this.prisma().slax_bookmark_import.create({
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
    this.prisma().$executeRaw`UPDATE slax_bookmark_import SET reason = CONCAT(reason, '\n', ${errLog}) WHERE id = ${importId}`
  }

  public async getUserImportTask(userId: number) {
    return await this.prisma().slax_bookmark_import.findMany({ where: { user_id: userId } })
  }

  public async getUnfinishedImportTask() {
    return await this.prisma().slax_bookmark_import.findMany({ where: { status: 1 } })
  }

  public async updateBookmarkImportTask(importId: number, status: number, reason: string) {
    return await this.prisma().slax_bookmark_import.update({
      where: { id: importId },
      data: { status, reason }
    })
  }

  public async getUserImportTaskByType(userId: number, type: string) {
    return await this.prisma().slax_bookmark_import.findMany({
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
    return await this.prisma().slax_user_delete_bookmark.findMany({
      where: { deleted_at: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
    })
  }

  public async batchGetBookmarkComment(commentIds: number[]) {
    return await this.prisma().slax_mark_comment.findMany({ where: { id: { in: commentIds } } })
  }

  public async batchGetBookmarkTitle(bookmarkIdList: number[]): Promise<bookmarkTitlePO[]> {
    return await this.prisma().$queryRaw<bookmarkTitlePO[]>`SELECT title, u.id as user_bookmark_id FROM slax_bookmark b 
      INNER JOIN slax_user_bookmark u on b.id = u.bookmark_id
      WHERE u.id in (${Prisma.join(bookmarkIdList)})`
  }

  public async getUserBookmarkSummary(bookmarkId: number, userId: number, lang: string) {
    return await this.prisma().slax_bookmark_summary.findFirst({
      where: {
        bookmark_id: bookmarkId,
        user_id: userId,
        lang
      }
    })
  }

  public async getBookmarkSummariesRaw(bookmarkId: number, lang: string, userId: number, limit: number) {
    return await this.prisma().$queryRaw<bookmarkSummaryPO[]>`
      SELECT * FROM (SELECT * FROM slax_bookmark_summary WHERE user_id = ${userId} AND bookmark_id = ${bookmarkId} AND lang = ${lang} LIMIT ${limit})
      UNION ALL
      SELECT * FROM (SELECT * FROM slax_bookmark_summary WHERE bookmark_id = ${bookmarkId} AND lang = ${lang} LIMIT ${limit})
    `
  }

  public async createBookmarkFetchRetry(bookmarkId: number, userId: number, retryCount?: number) {
    return await this.prisma().slax_bookmark_fetch_retry.upsert({
      where: { bookmark_id_user_id: { bookmark_id: bookmarkId, user_id: userId } },
      create: { retry_count: retryCount || 0, bookmark_id: bookmarkId, user_id: userId },
      update: {}
    })
  }

  public async getFilterBookmarkFetchRetries(options: { status: bookmarkFetchRetryStatus }) {
    const res = await this.prisma().$queryRaw<{ bookmark_id: number; retry_counts: string; user_ids: string; created_at: string }[]>`
    SELECT  bookmark_id, group_concat(retry_count) as retry_counts, group_concat(user_id) as user_ids, created_at FROM slax_bookmark_fetch_retry 
      WHERE status = ${options.status}
      GROUP BY bookmark_id`
    return res || []
  }

  public async updateBookmarkFetchRetry(bookmarkId: number, options: { retry_count?: number; last_retry_at?: Date; status?: bookmarkFetchRetryStatus; trace_id?: string }) {
    return await this.prisma().slax_bookmark_fetch_retry.updateMany({
      where: { bookmark_id: bookmarkId },
      data: { ...options }
    })
  }

  public async upsertVectorShard(bookmarkId: number, shardIdx: number) {
    return await this.prisma().slax_bookmark_vector_shard.upsert({
      where: { bookmark_id: bookmarkId },
      create: { bookmark_id: bookmarkId, bucket_idx: shardIdx, created_at: new Date() },
      update: { created_at: new Date() }
    })
  }

  public async getVectorShard(bookmarkId: number) {
    return await this.prisma().slax_bookmark_vector_shard.findFirst({ where: { bookmark_id: bookmarkId } })
  }

  public async getBookmarkVectorShard(userId: number) {
    if (userId < 1) return []

    try {
      return await this.prisma().$queryRaw<bookmarkShardPO[]>`SELECT id, vs.bookmark_id, vs.bucket_idx, vs.created_at FROM slax_bookmark_vector_shard vs
      INNER JOIN (SELECT bookmark_id FROM slax_user_bookmark WHERE user_id = ${userId}) ub on vs.bookmark_id = ub.bookmark_id`
    } catch (e) {
      console.log(e, 'getBookmarkVectorShard error')
      return []
    }
  }

  public async getUserBookmarkIds(userId: number) {
    return await this.prisma().slax_user_bookmark.findMany({ where: { user_id: userId }, select: { bookmark_id: true } })
  }

  public async getAllBookmarkChanges(userId: number) {
    try {
      const res = await this.prisma().$queryRaw<bookmarkChangePO[]>`SELECT sb.target_url, sb.id as bookmark_id, ub.created_at 
      FROM slax_bookmark sb 
      INNER JOIN 
      (SELECT id, bookmark_id, user_id, created_at FROM slax_user_bookmark WHERE user_id = ${userId}) ub 
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

  public async getPartialBookmarkChanges(userId: number, time: number) {
    const res = await this.prisma().slax_user_bookmark_change.findMany({
      where: {
        user_id: userId,
        created_at: {
          gt: new Date(time)
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return res as bookmarkActionChangePO[]
  }
}

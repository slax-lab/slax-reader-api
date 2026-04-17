import { PRISIMA_HYPERDRIVE_CLIENT } from '../../const/symbol'
import { inject, injectable } from '../../decorators/di'
import { LazyInstance } from '../../decorators/lazy'
import { Prisma, PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'
import {
  OrderedSyncOperation,
  CreateTagData,
  CreateBookmarkData,
  UpdateBookmarkData,
  UpdateTagsData,
  UpdateShareData,
  CreateCommentData,
  DeleteCommentData
} from '../../domain/orchestrator/sync'
import { CommentTooLongError, ErrorMarkTypeError, MarkLineTooLongError, ShareActionNotAllowedError } from '../../const/err'
import { markType } from './dbMark'

export type prismaTx = Omit<HyperdrivePrismaClient<Prisma.PrismaClientOptions>, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
export type executeFunction = (tx: prismaTx, operation: OrderedSyncOperation) => Promise<{ bookmarkId: number; targetUrl: string; userId: number } | null | void>

@injectable()
export class DBSyncBatchOperation {
  constructor(@inject(PRISIMA_HYPERDRIVE_CLIENT) public prismaHyperdrive: LazyInstance<HyperdrivePrismaClient>) {}

  /** execute */
  public async executeOrderedOperations(operations: OrderedSyncOperation[]): Promise<{ bookmarkId: number; targetUrl: string; userId: number }[]> {
    if (operations.length === 0) return []

    const newBookmarks: { bookmarkId: number; targetUrl: string; userId: number }[] = []
    const executeMap: Record<string, executeFunction> = {
      create_tag: this.executeCreateTag,
      create_bookmark: this.executeCreateBookmark,
      update_bookmark: this.executeUpdateBookmark,
      update_tags: this.executeUpdateTags,
      update_share: this.executeUpdateShare,
      delete_bookmark: this.executeDeleteBookmark,
      create_comment: this.executeCreateComment,
      delete_comment: this.executeDeleteComment
    }

    await this.prismaHyperdrive().$transaction(async tx => {
      for (const operation of operations) {
        const result = await executeMap[operation.type].bind(this)(tx, operation)
        if (result) newBookmarks.push(result)
      }
    })

    return newBookmarks
  }

  /** create tag */
  public async executeCreateTag(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'create_tag') return

    const { tagName } = operation.data as CreateTagData
    const tagUuid = operation.tagUuid

    await tx.sr_user_tag.upsert({
      where: { user_id_tag_name: { user_id: operation.userId, tag_name: tagName } },
      create: {
        user_id: operation.userId,
        tag_name: tagName,
        display: true,
        created_at: new Date(),
        uuid: tagUuid
      },
      update: {
        display: true
      }
    })
  }

  /** create bookmark */
  public async executeCreateBookmark(tx: prismaTx, operation: OrderedSyncOperation): Promise<{ bookmarkId: number; targetUrl: string; userId: number } | null> {
    if (operation.type !== 'create_bookmark') return null

    const { targetUrl, title, thumbnail, description, isArchive, isNewBookmark } = operation.data as CreateBookmarkData

    const bookmark = await tx.sr_bookmark.upsert({
      where: { target_url_private_user: { target_url: targetUrl, private_user: 0 } },
      create: {
        target_url: targetUrl,
        title,
        host_url: new URL(targetUrl).origin,
        content_icon: thumbnail || '',
        content_cover: '',
        description: description || '',
        private_user: 0,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
        published_at: new Date()
      },
      update: {
        updated_at: new Date()
      }
    })

    const existingByUuid = await tx.sr_user_bookmark.findUnique({
      where: { uuid: operation.bookmarkUuid }
    })

    if (existingByUuid) {
      await tx.sr_user_bookmark.update({
        where: { uuid: operation.bookmarkUuid },
        data: {
          bookmark_id: bookmark.id,
          deleted_at: null,
          archive_status: isArchive ? 1 : 0,
          updated_at: new Date()
        }
      })
    } else {
      await tx.sr_user_bookmark.upsert({
        where: { user_id_bookmark_id: { user_id: operation.userId, bookmark_id: bookmark.id } },
        create: {
          uuid: operation.bookmarkUuid,
          user_id: operation.userId,
          bookmark_id: bookmark.id,
          type: 0,
          archive_status: isArchive ? 1 : 0,
          deleted_at: null,
          created_at: new Date(),
          updated_at: new Date()
        },
        update: {
          deleted_at: null,
          archive_status: isArchive ? 1 : 0,
          updated_at: new Date()
        }
      })
    }

    if (isNewBookmark) {
      return {
        bookmarkId: bookmark.id,
        targetUrl: targetUrl,
        userId: operation.userId
      }
    }

    return null
  }

  /** update bookmark */
  public async executeUpdateBookmark(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'update_bookmark') return

    const updateData = { ...(operation.data as UpdateBookmarkData), updated_at: new Date() }

    await tx.sr_user_bookmark.update({
      where: { uuid: operation.bookmarkUuid, user_id: operation.userId },
      data: updateData
    })
  }

  /** update bookmark tags */
  public async executeUpdateTags(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'update_tags') return

    const { tagsToAdd, tagsToDelete } = operation.data as UpdateTagsData
    const { userId, bookmarkUuid } = operation

    if (tagsToDelete.length > 0) {
      await tx.$executeRaw`
        UPDATE sr_user_bookmark_tag
        SET is_deleted = true
        WHERE bookmark_id = (SELECT bookmark_id from sr_user_bookmark where uuid = ${bookmarkUuid})
        AND tag_id IN (SELECT id FROM sr_user_tag WHERE uuid in (${Prisma.join(tagsToDelete.map(uuid => Prisma.sql`${uuid}`))})) AND user_id = ${userId}`

      await tx.$executeRaw`
        UPDATE sr_user_tag t
        SET display = false
        WHERE t.uuid IN (${Prisma.join(tagsToDelete.map(uuid => Prisma.sql`${uuid}`))})
          AND NOT EXISTS (
            SELECT 1 
            FROM sr_user_bookmark_tag bt
            WHERE bt.tag_id = t.id 
              AND bt.is_deleted = false
          );`
    }

    if (tagsToAdd.length > 0) {
      await tx.$executeRaw`
        INSERT INTO sr_user_bookmark_tag(user_id, bookmark_id, tag_id, tag_name, is_deleted, created_at)
        SELECT 
          ${userId}, 
          (SELECT bookmark_id FROM sr_user_bookmark WHERE uuid = ${bookmarkUuid} AND user_id = ${userId}),
          ut.id,
          ut.tag_name,
          false,
          ${new Date()}
        FROM sr_user_tag ut
        WHERE ut.user_id = ${userId}
          AND ut.uuid IN (${Prisma.join(tagsToAdd.map(uuid => Prisma.sql`${uuid}`))})
        ON CONFLICT(user_id, bookmark_id, tag_id) 
        DO UPDATE SET is_deleted = false
      `

      await tx.$executeRaw`
        UPDATE sr_user_tag 
        SET display = true
        WHERE uuid IN (${Prisma.join(tagsToAdd.map(uuid => Prisma.sql`${uuid}`))})
          AND user_id = ${userId}
      `
    }
  }

  /** 关闭分享状态，因为开启需要去抢占分享码，故拆分 */
  public async executeUpdateShare(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'update_share') return

    const { isEnable } = operation.data as UpdateShareData

    await tx.$executeRaw`
      UPDATE sr_bookmark_share 
      SET is_enable = ${isEnable}
      WHERE bookmark_id = (
        SELECT bookmark_id FROM sr_user_bookmark 
        WHERE uuid = ${operation.bookmarkUuid} AND user_id = ${operation.userId}
      )
      AND user_id = ${operation.userId}
    `
  }

  /** soft delete bookmark */
  public async executeDeleteBookmark(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'delete_bookmark') return

    await tx.sr_user_bookmark.update({
      where: { uuid: operation.bookmarkUuid, user_id: operation.userId },
      data: { deleted_at: new Date() }
    })
  }

  /** create comment */
  public async executeCreateComment(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'create_comment') return

    const { userBookmarkUuid, type, source, comment, rootUuid, parentUuid, approxSource, content, sourceType, sourceId } = operation.data as CreateCommentData

    if (type === markType.LINE && comment) throw ErrorMarkTypeError()
    if (type === markType.COMMENT && (!comment || comment.length < 1)) throw ErrorMarkTypeError()
    if (type === markType.REPLY && (!comment || comment.length < 1)) throw ErrorMarkTypeError()
    if ([markType.ORIGIN_COMMENT, markType.ORIGIN_LINE].includes(type) && !approxSource) throw ErrorMarkTypeError()
    if (comment && comment.length > 1500) throw CommentTooLongError()

    // 校验 source 长度（非回复类型）
    if (type !== markType.REPLY) {
      try {
        const sourceItems = JSON.parse(source) as Array<{ type: string; start: number; end: number }>
        if (Array.isArray(sourceItems)) {
          let sourceLength = 0
          let sourceImageCount = 0
          sourceItems.forEach(item => {
            if (item.type === 'image') sourceImageCount++
            else sourceLength += (item.end || 0) - (item.start || 0)
          })
          if (sourceLength > 1000 || sourceImageCount > 3) throw MarkLineTooLongError()
        }
      } catch (e) {
        if (e instanceof Error && (e.message.includes('MarkLine') || e.message.includes('MARK_LINE'))) throw e
      }
    }

    // 查找目标书签（sr_user_bookmark）
    const userBookmark = await tx.sr_user_bookmark.findUnique({
      where: { uuid: userBookmarkUuid }
    })
    if (!userBookmark) throw ShareActionNotAllowedError()

    // 权限校验：本人书签直接放行，非本人需检查是否开启分享
    if (userBookmark.user_id !== operation.userId) {
      const share = await tx.sr_bookmark_share.findFirst({
        where: { bookmark_id: userBookmark.bookmark_id, user_id: userBookmark.user_id, is_enable: true }
      })
      if (!share) throw ShareActionNotAllowedError()
    }

    // 通过 UUID 解析 root_id 和 parent_id 对应的整数 ID
    let rootId = 0
    let parentId = 0

    if (rootUuid) {
      const rootComment = await tx.sr_bookmark_comment.findUnique({ where: { uuid: rootUuid } })
      if (rootComment) rootId = rootComment.id
    }

    if (type === markType.REPLY && parentUuid) {
      const parentComment = await tx.sr_bookmark_comment.findUnique({ where: { uuid: parentUuid } })
      if (!parentComment) throw ShareActionNotAllowedError()
      if (parentComment.bookmark_id !== userBookmark.id) throw ShareActionNotAllowedError()
      if (parentComment.is_deleted) throw ShareActionNotAllowedError()
      parentId = parentComment.id
      if (parentComment.root_id > 0) rootId = parentComment.root_id
    }

    const finalSourceType = sourceType || 'bookmark'
    const finalSourceId = sourceId || userBookmark.id.toString()

    const created = await tx.sr_bookmark_comment.create({
      data: {
        uuid: operation.commentUuid,
        user_id: operation.userId,
        bookmark_id: userBookmark.id,
        user_bookmark_uuid: userBookmarkUuid,
        type,
        source,
        comment,
        root_id: rootId,
        parent_id: parentId,
        approx_source: approxSource,
        content,
        source_type: finalSourceType,
        source_id: finalSourceId,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    if ([markType.COMMENT, markType.ORIGIN_COMMENT].includes(type) && rootId === 0) {
      await tx.sr_bookmark_comment.update({
        where: { id: created.id },
        data: { root_id: created.id, updated_at: new Date() }
      })
    }
  }

  /** soft delete comment */
  public async executeDeleteComment(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'delete_comment') return

    const { isDeleted } = operation.data as DeleteCommentData

    const commentRecord = await tx.sr_bookmark_comment.findUnique({
      where: { uuid: operation.commentUuid }
    })
    if (!commentRecord) return

    // 权限校验：评论作者可删除自己的评论，书签拥有者可删除其书签下的任意评论
    if (commentRecord.user_id !== operation.userId) {
      // bookmark_id 存的是 sr_user_bookmark.id，用 id 去查
      const userBookmark = await tx.sr_user_bookmark.findFirst({
        where: { id: commentRecord.bookmark_id, user_id: operation.userId }
      })
      if (!userBookmark) throw ShareActionNotAllowedError()
    }

    await tx.sr_bookmark_comment.update({
      where: { uuid: operation.commentUuid },
      data: { is_deleted: isDeleted, updated_at: new Date() }
    })
  }
}

import { PRISIMA_HYPERDRIVE_CLIENT } from '../../const/symbol'
import { inject, injectable } from '../../decorators/di'
import { LazyInstance } from '../../decorators/lazy'
import { Prisma, PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'
import { OrderedSyncOperation, CreateTagData, CreateBookmarkData, UpdateBookmarkData, UpdateTagsData, UpdateShareData } from '../../domain/orchestrator/sync'

export type prismaTx = Omit<HyperdrivePrismaClient<Prisma.PrismaClientOptions>, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
export type executeFunction = (tx: prismaTx, operation: OrderedSyncOperation) => Promise<{ bookmarkId: number; targetUrl: string; userId: number } | null | void>

@injectable()
export class DBSyncBatchOperation {
  constructor(@inject(PRISIMA_HYPERDRIVE_CLIENT) private prismaHyperdrive: LazyInstance<HyperdrivePrismaClient>) {}

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
      delete_bookmark: this.executeDeleteBookmark
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
  private async executeCreateTag(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
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
  private async executeCreateBookmark(tx: prismaTx, operation: OrderedSyncOperation): Promise<{ bookmarkId: number; targetUrl: string; userId: number } | null> {
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
  private async executeUpdateBookmark(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'update_bookmark') return

    const updateData = { ...(operation.data as UpdateBookmarkData), updated_at: new Date() }

    await tx.sr_user_bookmark.update({
      where: { uuid: operation.bookmarkUuid, user_id: operation.userId },
      data: updateData
    })
  }

  /** update bookmark tags */
  private async executeUpdateTags(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
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
  private async executeUpdateShare(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
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
  private async executeDeleteBookmark(tx: prismaTx, operation: OrderedSyncOperation): Promise<void> {
    if (operation.type !== 'delete_bookmark') return

    await tx.sr_user_bookmark.update({
      where: { uuid: operation.bookmarkUuid, user_id: operation.userId },
      data: { deleted_at: new Date() }
    })
  }
}

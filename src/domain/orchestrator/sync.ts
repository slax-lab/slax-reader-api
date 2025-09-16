import { ErrorParam, SyncTableRuleError, SyncTableTagNameError, UserNotFoundError } from '../../const/err'
import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { UserService } from '../user'
import { SignJWT } from 'jose'
import { DBSyncBatchOperation } from '../../infra/repository/dbSyncBatch'
import { QueueClient, queueRetryParseMessage, callbackType } from '../../infra/queue/queueClient'
import { parserType, URLPolicie } from '../../utils/urlPolicie'

export type SyncExecOperation = 'PUT' | 'PATCH' | 'DELETE'

export interface SyncChangeItem {
  table: string
  id: string
  op: SyncExecOperation
  data: Record<string, string>
  preData?: Record<string, string>
}

export interface SyncChangeUserBookmarkMetadata {
  tags?: string[]
  share?: SyncChangeUserBookmarkShare
  bookmark?: SyncChangeUserBookmark
}

export interface CreateTagData {
  tagName: string
}

export interface CreateBookmarkData {
  targetUrl: string
  title: string
  thumbnail?: string
  description?: string
  isArchive: boolean
  isNewBookmark: boolean
}

export interface UpdateBookmarkData {
  is_read?: boolean
  archive_status?: 0 | 1
  is_starred?: boolean
  alias_title?: string
}

export interface UpdateTagsData {
  tagsToAdd: string[]
  tagsToDelete: string[]
}

export interface UpdateShareData {
  isEnable: boolean
}

type SyncOperation<T extends string, D = undefined, U = string> = {
  userId: number
  type: T
  bookmarkUuid: U
  data: D
}

type TagSyncOperation<T extends string, D = undefined, U = string> = {
  userId: number
  type: T
  tagUuid: U
  data: D
}

export type OrderedSyncOperation =
  | TagSyncOperation<'create_tag', CreateTagData, string>
  | SyncOperation<'create_bookmark', CreateBookmarkData, string>
  | SyncOperation<'update_bookmark', UpdateBookmarkData, string>
  | SyncOperation<'update_tags', UpdateTagsData, string>
  | SyncOperation<'update_share', UpdateShareData, string>
  | SyncOperation<'delete_bookmark', undefined, string>

export interface SyncChangeUserBookmark {
  uuid: string
  title: string
  byline: string
  status: string
  host_url: string
  site_name: string
  target_url: string
  description: string
  content_icon: string
  published_at: string
  content_cover: string
  content_word_count: number
}

export interface SyncChangeUserBookmarkShare {
  is_enable?: boolean
  show_line?: boolean
  allow_line?: boolean
  created_at?: boolean
  share_code?: boolean
  show_comment?: boolean
  show_userinfo?: boolean
}

@injectable()
export class SyncOrchestrator {
  constructor(
    @inject(UserService) private userService: UserService,
    @inject(DBSyncBatchOperation) private dbSyncBatch: DBSyncBatchOperation,
    @inject(QueueClient) private queueClient: QueueClient
  ) {}

  /** sign token */
  public async signToken(ctx: ContextManager) {
    const userInfo = await this.userService.getUserInfo(ctx)
    if (!userInfo.uuid) throw UserNotFoundError()

    const payload = {
      sub: userInfo.uuid,
      aud: 'reader-sync'
    }

    const privateJwk = JSON.parse(ctx.env.POWERSYNC_JWK_PRIVATE_KEY.replace(/\\/g, ''))
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: privateJwk.kid })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(await crypto.subtle.importKey('jwk', privateJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']))

    return { token: jwt, endpoint: ctx.env.POWERSYNC_SG_API_URL }
  }

  /** sync PowerSync changes and execute atomic changes */
  public async syncChanges(ctx: ContextManager, changes: SyncChangeItem[]) {
    const userInfo = await this.userService.getUserInfo(ctx)
    if (!userInfo.uuid) throw UserNotFoundError()

    const userId = ctx.getUserId()
    const orderedOperations: OrderedSyncOperation[] = []

    for (const change of changes) {
      if (change.table === 'sr_user_bookmark') {
        this.processUserBookmarkChange(change, userId, orderedOperations)
      } else if (change.table === 'sr_user_tag' && change.op === 'PUT') {
        this.processUserTagChange(change, userId, orderedOperations)
      } else {
        throw SyncTableRuleError()
      }
    }

    const result = await this.dbSyncBatch.executeOrderedOperations(orderedOperations)
    for (const newBookmark of result) {
      await this.sendRetryParseEvent(ctx, newBookmark)
    }
  }

  /** user bookmark change */
  private processUserBookmarkChange(change: SyncChangeItem, userId: number, operations: OrderedSyncOperation[]) {
    // soft delete bookmark
    if (change.data.hasOwnProperty('deleted_at')) {
      operations.push({
        type: 'delete_bookmark',
        bookmarkUuid: change.id,
        userId,
        data: undefined
      })
      return
    }

    // create new bookmark
    if (change.op === 'PUT' && change.data.hasOwnProperty('metadata')) {
      const bookmarkData = JSON.parse(change.data['metadata'].replaceAll('\\\\', '')) as SyncChangeUserBookmarkMetadata
      if (!bookmarkData.bookmark) throw ErrorParam()
      operations.push({
        type: 'create_bookmark',
        bookmarkUuid: change.id,
        userId,
        data: {
          targetUrl: bookmarkData.bookmark.target_url,
          title: bookmarkData.bookmark.title,
          thumbnail: bookmarkData.bookmark.content_icon,
          description: bookmarkData.bookmark.description,
          isArchive: change.data.archive_status === '1',
          isNewBookmark: true
        }
      })
      return
    }

    // update bookmark field
    const updates: UpdateBookmarkData = {}
    if (change.data.hasOwnProperty('is_read')) {
      updates.is_read = true
    }
    if (change.data.hasOwnProperty('archive_status')) {
      updates.archive_status = parseInt(change.data.archive_status) as 0 | 1
    }
    if (change.data.hasOwnProperty('is_starred')) {
      updates.is_starred = change.data.is_starred === '1'
    }
    if (change.data.hasOwnProperty('alias_title')) {
      updates.alias_title = change.data.alias_title
    }

    if (Object.keys(updates).length > 0) {
      operations.push({
        type: 'update_bookmark',
        bookmarkUuid: change.id,
        userId,
        data: updates
      })
    }

    // update tags
    if (change.data.hasOwnProperty('metadata.tags')) {
      this.processTagsChange(change, userId, operations)
    }

    // update share status
    if (change.data.hasOwnProperty('metadata.share.is_enable')) {
      this.processShareChange(change, userId, operations)
    }
  }

  /** update tags */
  private processTagsChange(change: SyncChangeItem, userId: number, operations: OrderedSyncOperation[]) {
    const tags = JSON.parse(change.data['metadata.tags'].replaceAll('\\\\', '')) as string[]
    const preTags = change.preData?.['metadata.tags'] ? (JSON.parse(change.preData['metadata.tags'].replaceAll('\\\\', '')) as string[]) : []
    const newTags = tags.filter(tag => !preTags.includes(tag))
    const deletedTags = preTags.filter(tag => !tags.includes(tag))

    console.log('newTags', newTags)
    console.log('deletedTags', deletedTags)
    if (newTags.length > 0 || deletedTags.length > 0) {
      operations.push({
        type: 'update_tags',
        bookmarkUuid: change.id,
        userId,
        data: {
          tagsToAdd: newTags,
          tagsToDelete: deletedTags
        }
      })
    }
  }

  /** update share status */
  private processShareChange(change: SyncChangeItem, userId: number, operations: OrderedSyncOperation[]) {
    const share = JSON.parse(change.data['metadata.share.is_enable'].replaceAll('\\\\', ''))

    if (share.is_enable !== undefined) {
      operations.push({
        type: 'update_share',
        bookmarkUuid: change.id,
        userId,
        data: {
          isEnable: share.is_enable
        }
      })
    }
  }

  /** create user tag */
  private processUserTagChange(change: SyncChangeItem, userId: number, operations: OrderedSyncOperation[]) {
    const tagName = change.data['tag_name']
    if (!tagName) throw SyncTableTagNameError()

    operations.push({
      type: 'create_tag',
      userId,
      tagUuid: change.id,
      data: {
        tagName
      }
    })
  }

  /** send retry parse event to queue */
  private async sendRetryParseEvent(ctx: ContextManager, newBookmark: { bookmarkId: number; targetUrl: string; userId: number }) {
    try {
      const police = new URLPolicie(ctx.env, newBookmark.targetUrl)
      let pType = police.getParserType()

      if (pType === parserType.BLOCK_PARSE) return
      pType = pType === parserType.CLIENT_PARSE ? parserType.SERVER_PUPPETEER_PARSE : pType

      const retryMessage: queueRetryParseMessage = {
        targetUrl: newBookmark.targetUrl,
        resource: 'bookmark',
        parserType: pType,
        bookmarkId: newBookmark.bookmarkId,
        callback: callbackType.NOT_CALLBACK,
        ignoreGenerateTag: false,
        retry: {
          retryCount: 0,
          userIds: [newBookmark.userId]
        }
      }

      await this.queueClient.pushRetryMessage(ctx, retryMessage)
    } catch (error) {
      console.error(`Failed to send retry parse event for bookmark ${newBookmark.bookmarkId}:`, error)
    }
  }
}

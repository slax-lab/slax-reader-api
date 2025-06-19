import { container, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { parserType } from '../../utils/urlPolicie'

export enum callbackType {
  NOT_CALLBACK = 0,
  CALLBACK_TELEGRAM = 1,
  CALLBACK_EMAIL = 2
}
export interface parseMessage {
  targetUrl: string
  resource: string
  parserType: parserType
  bookmarkId: number
  callback?: callbackType
  ignoreGenerateTag: boolean
  callbackPayload?: any
  targetTitle?: string
}

export interface importBookmarkMessage {
  type: string
  id: number
  data: any[]
  userId: number
}

export interface queueParseMessage extends parseMessage {
  userId: number
  privateUser: number
}

export interface queueRetryParseMessage extends parseMessage {
  retry: {
    retryCount: number
    userIds: number[]
  }
}

export interface queueThirdPartyMessage extends parseMessage {
  encodeBmId: number
}

export interface receiveParseMessage<T extends parseMessage> {
  id: string
  info: T
}

export interface queueAffiliateMessage {
  invitedUserId: number
  affCode: string
}

export interface queueReplaceMessage {
  bookmarkId: number
}

@injectable()
export class QueueClient {
  constructor(private env: Env) {}

  async pushParseThirdPartyMessage(ctx: ContextManager, taskInfo: queueThirdPartyMessage): Promise<void> {
    if (!taskInfo) return

    try {
      return await this.env.TWITTER_PARSER.send(taskInfo)
    } catch (error) {
      console.error(`push parse third party message failed: ${error}, retry in queue`)
    }
  }

  async pushImportMessage(ctx: ContextManager, taskInfo: importBookmarkMessage): Promise<void> {
    if (!taskInfo) return

    try {
      return await this.env.IMPORT_OTHER.send(taskInfo)
    } catch (error) {
      console.error(`push import message failed: ${error}, retry in queue`)
    }
  }

  async pushRetryMessage(ctx: ContextManager, taskInfo: queueRetryParseMessage): Promise<void> {
    if (!taskInfo) return

    try {
      return await this.env.FETCH_RETRY_PARSER.send(taskInfo)
    } catch (error) {
      console.error(`push retry message failed: ${error}, retry in queue`)
    }
  }
}

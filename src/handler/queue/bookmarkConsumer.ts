import { ContextManager } from '../../utils/context'
import { Consumer } from '../../decorators/queue'
import { inject, injectable } from '../../decorators/di'
import { UrlParserHandler } from '../../domain/orchestrator/urlParser'
import { ImportService } from '../../domain/import'
import { receiveThirdPartyMessage, receiveRetryParseMesaage, receiveQueueParseMessage } from '../../domain/orchestrator/urlParser'
import { importBookmarkMessage, parseMessage, queueThirdPartyMessage } from '../../infra/queue/queueClient'

@injectable()
export class BookmarkConsumer {
  constructor(
    @inject(UrlParserHandler) private urlParserHandler: UrlParserHandler,
    @inject(ImportService) private importService: ImportService
  ) {}
  /**
   * 解析第三方平台URL
   */
  @Consumer({ channel: 'slax-reader-parser-twitter', batch: true })
  @Consumer({ channel: 'slax-reader-parser-twitter-beta', batch: true })
  public async handleParseThirdPartyURL(ctx: ContextManager, info: receiveThirdPartyMessage[]) {
    await this.urlParserHandler.processThirdPartyMessages(ctx, info)
  }

  /**
   * 重试解析URL
   */
  @Consumer({ channel: 'slax-reader-parser-fetch-retry-prod' })
  @Consumer({ channel: 'slax-reader-parser-fetch-retry-beta' })
  public async handleParseRetryURL(ctx: ContextManager, info: receiveRetryParseMesaage) {
    await this.urlParserHandler.processRetryParseMessage(ctx, info)
  }

  /**
   * 导入其他平台书签
   */
  @Consumer({ channel: 'slax-reader-import-other' })
  @Consumer({ channel: 'slax-reader-migrate-from-other' })
  public async handleImportOther(ctx: ContextManager, info: { id: number; info: importBookmarkMessage }) {
    await this.importService.processImportBookmark(ctx, info)
  }

  /**
   * 解析URL
   */
  @Consumer({ channel: 'slax-reader-parser-prod' })
  @Consumer({ channel: 'slax-reader-parser-beta' })
  public async handleParseURL(ctx: ContextManager, taskInfo: receiveQueueParseMessage) {
    console.log(`handleParseURL ${taskInfo.id} ${JSON.stringify(taskInfo.info)}`)
    await this.urlParserHandler.processParseMessage(ctx, taskInfo)
  }
}

import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { ImportService } from '../import'
import { BookmarkService } from '../bookmark'
import type { LazyInstance } from '../../decorators/lazy'
import { KVClient } from '../../infra/repository/KVClient'
import { randomUUID } from 'crypto'
import { importBookmarkMessage } from '../../infra/queue/queueClient'
import { UrlParserHandler } from './urlParser'

@injectable()
export class ImportOrchestrator {
  constructor(
    @inject(ImportService) private importService: ImportService,
    @inject(KVClient) private kvClient: LazyInstance<KVClient>,
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(UrlParserHandler) private urlParserHandler: UrlParserHandler
  ) {}

  // 队列处理消息
  public async processImportBookmark(ctx: ContextManager, message: { id: number; info: importBookmarkMessage }) {
    const bookmarkData = await this.importService.processImportBookmark(ctx, message)
    try {
      console.log(`import bookmark: ${JSON.stringify(bookmarkData)}`)
      const batchMessage = await this.bookmarkService.batchAddUrlBookmark(ctx, bookmarkData)
      for (const item of batchMessage) {
        await this.urlParserHandler.processParseMessage(ctx, {
          id: randomUUID(),
          info: item
        })
      }
    } catch (e) {
      console.error(`import bookmark failed: ${JSON.stringify(e)}`)
    }
    console.log(`import bookmark process: ${message.id} finished`)
    await this.kvClient().kv.put(`import/process/${ctx.getUserId()}/${message.info.id}/${randomUUID()}`, '1')
  }
}

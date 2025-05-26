import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { ImportService } from '../import'
import { BookmarkService } from '../bookmark'
import type { LazyInstance } from '../../decorators/lazy'
import { KVClient } from '../../infra/repository/KVClient'
import { randomUUID } from 'crypto'
import { importBookmarkMessage } from '../../infra/queue/queueClient'
import { UrlParserHandler } from './urlParser'
import { ImportOtherTimeoutError } from '../../const/err'

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
    const processImport = async () => {
      const bookmarkData = await this.importService.processImportBookmark(ctx, message)
      console.log(`import bookmark: ${JSON.stringify(bookmarkData)}`)
      const batchMessage = await this.bookmarkService.batchAddUrlBookmark(ctx, bookmarkData)
      for (const item of batchMessage) {
        await this.urlParserHandler.processParseMessage(ctx, {
          id: randomUUID(),
          info: item
        })
      }
    }

    await Promise.race([
      processImport(),
      new Promise((resolve, reject) => {
        setTimeout(() => reject(ImportOtherTimeoutError()), 120 * 1000)
      })
    ])

    console.log(`import bookmark process: ${message.id} finished`)
    await this.kvClient().kv.put(`import/process/${ctx.getUserId()}/${message.info.id}/${randomUUID()}`, '1')
  }
}

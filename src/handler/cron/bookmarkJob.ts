import { ContextManager } from '../../utils/context'
import { inject, injectable } from '../../decorators/di'
import { Scheduled } from '../../decorators/scheduled'
import { BookmarkService } from '../../domain/bookmark'
import { ImportService } from '../../domain/import'

@injectable()
export class BookmarkJob {
  constructor(
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(ImportService) private importService: ImportService
  ) {}
  /**
   * 检查并获取重试书签
   */
  @Scheduled('*/15 * * * *')
  public async handleBookmarkFetchRetry(ctx: ContextManager) {
    await this.bookmarkService.checkAndFetchRetryBookmarks(ctx)
  }

  /**
   * 清理过期垃圾书签
   */
  @Scheduled('0 */1 * * *')
  public async clearExpiredTrashedBookmark(ctx: ContextManager) {
    await this.bookmarkService.clearExpiredTrashedBookmarkTask(ctx)
  }

  /**
   * 检查导入进度
   */
  @Scheduled('*/5 * * * *')
  public async checkImportProgress(ctx: ContextManager) {
    await this.importService.checkImportTaskProcess(ctx)
  }
}

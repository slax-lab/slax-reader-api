import { container } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { BookmarkJob } from '../../handler/cron/bookmarkJob'

export const handleCronjob = async (event: any, env: Env, exec: ExecutionContext) => {
  const handleBookmarkFetchRetry = async () => {
    const controller = container.resolve(BookmarkJob)
    exec.waitUntil(controller.handleBookmarkFetchRetry(new ContextManager(exec, env)))
  }
  const clearExpiredTrashedBookmark = async () => {
    const controller = container.resolve(BookmarkJob)
    exec.waitUntil(controller.clearExpiredTrashedBookmark(new ContextManager(exec, env)))
  }
  const checkImportProgress = async () => {
    const controller = container.resolve(BookmarkJob)
    exec.waitUntil(controller.checkImportProgress(new ContextManager(exec, env)))
  }

  const cronMap = new Map<string, () => Promise<void>>([
    ['*/15 * * * *', handleBookmarkFetchRetry],
    ['0 */1 * * *', clearExpiredTrashedBookmark],
    ['*/5 * * * *', checkImportProgress]
  ])

  const cron = cronMap.get(event.cron)
  if (!cron) {
    console.log(`${event.scheduledTime} cron ${event.cron} not found`)
    return
  }
  exec.waitUntil(cron())
}

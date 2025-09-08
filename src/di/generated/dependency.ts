import { container, Container } from '../../decorators/di'
import { lazy } from '../../decorators/lazy'
import {
  PRISIMA_CLIENT,
  PRISIMA_FULLTEXT_CLIENT,
  VECTORIZE_CLIENTS,
  DATABASE_REGISTRY,
  CLIENT_REGISTRY,
  BUCKET_REGISTRY,
  MIDDLEWARES,
  CONTROLLERS,
  ROUTER,
  CHAT_COMPLETION,
  PRISIMA_HYPERDRIVE_CLIENT
} from '../../const/symbol'
import { BookmarkRepo } from '../../infra/repository/dbBookmark'
import { BookmarkSearchRepo } from '../../infra/repository/dbBookmarkSearch'
import { VectorizeRepo } from '../../infra/repository/dbVectorize'
import { MarkRepo } from '../../infra/repository/dbMark'
import { UserRepo } from '../../infra/repository/dbUser'
import { NotificationMessage } from '../../infra/message/notification'
import { ReportRepo } from '../../infra/repository/dbReport'
import { BookmarkService } from '../../domain/bookmark'
import { TagService } from '../../domain/tag'
import { MarkService } from '../../domain/mark'
import { ImportService } from '../../domain/import'
import { UrlParserHandler } from '../../domain/orchestrator/urlParser'
import { NotificationService } from '../../domain/notification'
import { ShareService } from '../../domain/share'
import { UserService } from '../../domain/user'
import { AigcService } from '../../domain/aigc'
import { TelegramBotService } from '../../domain/telegram'
import { SearchService } from '../../domain/search'
import { BookmarkOrchestrator } from '../../domain/orchestrator/bookmark'
import { MarkOrchestrator } from '../../domain/orchestrator/mark'
import { ShareOrchestrator } from '../../domain/orchestrator/share'
import { ImportOrchestrator } from '../../domain/orchestrator/import'
import { EmailService } from '../../domain/email'
import { BookmarkJob } from '../../handler/cron/bookmarkJob'
import { BookmarkConsumer } from '../../handler/queue/bookmarkConsumer'
import { QueueClient } from '../../infra/queue/queueClient'
import { BucketClient } from '../../infra/repository/bucketClient'
import { KVClient } from '../../infra/repository/KVClient'
import { AigcController } from '../../handler/http/aigcController'
import { BookmarkController } from '../../handler/http/bookmarkController'
import { CallbackController } from '../../handler/http/callbackController'
import { ImageController } from '../../handler/http/imageController'
import { MarkController } from '../../handler/http/markController'
import { McpServerController } from '../../handler/http/mcpController'
import { ShareController } from '../../handler/http/shareController'
import { SyncController } from '../../handler/http/syncController'
import { TagController } from '../../handler/http/tagController'
import { UserController } from '../../handler/http/userController'
import { DatabaseRegistry } from '../data'

container.register(AigcService, {
  useFactory: container =>
    new AigcService(
      lazy(() => container.resolve(CHAT_COMPLETION)),
      lazy(() => container.resolve(BucketClient)),
      container.resolve(BookmarkRepo)
    )
})

container.register(BookmarkService, {
  useFactory: container =>
    new BookmarkService(
      container.resolve(BookmarkRepo),
      lazy(() => container.resolve(BucketClient)),
      container.resolve(BookmarkSearchRepo),
      container.resolve(VectorizeRepo),
      container.resolve(MarkRepo),
      container.resolve(UserRepo),
      lazy(() => container.resolve(QueueClient)),
      container.resolve(NotificationMessage)
    )
})

container.register(EmailService, {
  useFactory: container => new EmailService(container.resolve(UserRepo))
})

container.register(ImportService, {
  useFactory: container =>
    new ImportService(
      container.resolve(BookmarkRepo),
      lazy(() => container.resolve(QueueClient)),
      lazy(() => container.resolve(KVClient)),
      lazy(() => container.resolve(BucketClient))
    )
})

container.register(MarkService, {
  useFactory: container => new MarkService(container.resolve(BookmarkRepo), container.resolve(MarkRepo), container.resolve(UserRepo))
})

container.register(NotificationService, {
  useFactory: container => new NotificationService(container.resolve(UserRepo), container.resolve(BookmarkRepo), container.resolve(NotificationMessage))
})

container.register(SearchService, {
  useFactory: container => new SearchService(container.resolve(BookmarkRepo), container.resolve(BookmarkSearchRepo), container.resolve(VectorizeRepo))
})

container.register(ShareService, {
  useFactory: container => new ShareService(container.resolve(BookmarkRepo))
})

container.register(TagService, {
  useFactory: container => new TagService(container.resolve(BookmarkRepo))
})

container.register(TelegramBotService, {
  useFactory: container => new TelegramBotService(container.resolve(UserRepo), container.resolve(BookmarkRepo))
})

container.register(UserService, {
  useFactory: container =>
    new UserService(
      container.resolve(UserRepo),
      lazy(() => container.resolve(BucketClient)),
      container.resolve(ReportRepo)
    )
})

container.register(BookmarkOrchestrator, {
  useFactory: container => new BookmarkOrchestrator(container.resolve(BookmarkService), container.resolve(TagService), container.resolve(MarkService))
})

container.register(ImportOrchestrator, {
  useFactory: container =>
    new ImportOrchestrator(
      container.resolve(ImportService),
      lazy(() => container.resolve(KVClient)),
      container.resolve(BookmarkService),
      container.resolve(UrlParserHandler)
    )
})

container.register(MarkOrchestrator, {
  useFactory: container => new MarkOrchestrator(container.resolve(MarkService), container.resolve(NotificationService))
})

container.register(ShareOrchestrator, {
  useFactory: container =>
    new ShareOrchestrator(
      container.resolve(ShareService),
      container.resolve(UserService),
      container.resolve(TagService),
      container.resolve(MarkService),
      container.resolve(BookmarkService)
    )
})

container.register(UrlParserHandler, {
  useFactory: container =>
    new UrlParserHandler(
      container.resolve(BookmarkService),
      lazy(() => container.resolve(BucketClient)),
      container.resolve(AigcService),
      container.resolve(TelegramBotService),
      container.resolve(SearchService),
      lazy(() => container.resolve(QueueClient)),
      container.resolve(TagService)
    )
})

container.register(BookmarkJob, {
  useFactory: container => new BookmarkJob(container.resolve(BookmarkService), container.resolve(ImportService))
})

container.register(BookmarkConsumer, {
  useFactory: container => new BookmarkConsumer(container.resolve(UrlParserHandler), container.resolve(ImportOrchestrator))
})

container.register(NotificationMessage, {
  useFactory: container => new NotificationMessage(container.resolve(UserRepo))
})

container.register(QueueClient, {
  useClass: QueueClient
})

container.register(BucketClient, {
  useClass: BucketClient
})

container.register(BookmarkRepo, {
  useFactory: container =>
    new BookmarkRepo(
      lazy(() => container.resolve(PRISIMA_CLIENT)),
      lazy(() => container.resolve(PRISIMA_HYPERDRIVE_CLIENT))
    )
})

container.register(BookmarkSearchRepo, {
  useFactory: container => new BookmarkSearchRepo(lazy(() => container.resolve(PRISIMA_FULLTEXT_CLIENT)))
})

container.register(MarkRepo, {
  useFactory: container =>
    new MarkRepo(
      lazy(() => container.resolve(PRISIMA_CLIENT)),
      lazy(() => container.resolve(PRISIMA_HYPERDRIVE_CLIENT))
    )
})

container.register(ReportRepo, {
  useFactory: container =>
    new ReportRepo(
      lazy(() => container.resolve(PRISIMA_CLIENT)),
      lazy(() => container.resolve(PRISIMA_HYPERDRIVE_CLIENT))
    )
})

container.register(UserRepo, {
  useFactory: container =>
    new UserRepo(
      lazy(() => container.resolve(PRISIMA_CLIENT)),
      lazy(() => container.resolve(PRISIMA_HYPERDRIVE_CLIENT))
    )
})

container.register(VectorizeRepo, {
  useFactory: container => new VectorizeRepo(lazy(() => container.resolve(VECTORIZE_CLIENTS)))
})

container.register(KVClient, {
  useClass: KVClient
})

container.register(AigcController, {
  useFactory: container => new AigcController(container.resolve(AigcService), container.resolve(UserService), container.resolve(BookmarkService))
})

container.register(BookmarkController, {
  useFactory: container =>
    new BookmarkController(
      container.resolve(BookmarkService),
      container.resolve(BookmarkOrchestrator),
      container.resolve(ImportService),
      container.resolve(SearchService),
      container.resolve(TagService),
      container.resolve(UrlParserHandler)
    )
})

container.register(CallbackController, {
  useFactory: container => new CallbackController(container.resolve(TelegramBotService), container.resolve(BookmarkService), container.resolve(UrlParserHandler))
})

container.register(ImageController, {
  useFactory: container => new ImageController(lazy(() => container.resolve(BucketClient)))
})

container.register(MarkController, {
  useFactory: container => new MarkController(container.resolve(MarkService), container.resolve(MarkOrchestrator))
})

container.register(McpServerController, {
  useFactory: () => new McpServerController()
})

container.register(ShareController, {
  useFactory: container => new ShareController(container.resolve(ShareService), container.resolve(ShareOrchestrator))
})

container.register(SyncController, {
  useFactory: () => new SyncController()
})

container.register(TagController, {
  useFactory: container => new TagController(container.resolve(TagService))
})

container.register(UserController, {
  useFactory: container => new UserController(container.resolve(UserService), container.resolve(BookmarkService), container.resolve(NotificationService))
})

container.register(DatabaseRegistry, {
  useFactory: container => new DatabaseRegistry()
})

export function initializeInfrastructure(env: Env, targetContainer: Container) {
  container.resolve(DatabaseRegistry).register(env, targetContainer)
}

export function initializeCore() {
  return {
    container
  }
}

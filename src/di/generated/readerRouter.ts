import { Router } from 'itty-router'
import { auth } from '../../middleware/auth'
import { cors } from '../../middleware/cors'
import { ContextManager } from '../../utils/context'
import { container } from '../../decorators/di'
import { NotFound, Successed } from '../../utils/responseUtils'
import { AigcController } from '../../handler/http/aigcController'
import { BookmarkController } from '../../handler/http/bookmarkController'
import { CallbackController } from '../../handler/http/callbackController'
import { ImageController } from '../../handler/http/imageController'
import { MarkController } from '../../handler/http/markController'
import { ShareController } from '../../handler/http/shareController'
import { TagController } from '../../handler/http/tagController'
import { UserController } from '../../handler/http/userController'

const router = Router()

router.all('*', cors)
router.all('*', auth)

router.post('/v1/aigc/summaries', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(AigcController)
  return await controller.handleSummariesRequest(ctx, req)
})
router.post('/v1/aigc/chat', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(AigcController)
  return await controller.handleCompletionsRequest(ctx, req)
})
router.post('/v1/bookmark/add', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserAddBookmarkRequest(ctx, req)
})
router.post('/v1/bookmark/add_url', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserAddUrlBookmarkRequest(ctx, req)
})
router.post('/v1/bookmark/del', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserDeleteBookmarkRequest(ctx, req)
})
router.post('/v1/bookmark/trash', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserTrashBookmarkRequest(ctx, req)
})
router.post('/v1/bookmark/trash_revert', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserTrashRevertBookmarkRequest(ctx, req)
})
router.get('/v1/bookmark/list', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserGetBookmarksRequest(ctx, req)
})
router.get('/v1/bookmark/detail', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserGetBookmarkDetailRequest(ctx, req)
})
router.post('/v1/bookmark/exists', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkExistsRequest(ctx, req)
})
router.post('/v1/bookmark/archive', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkArchiveRequest(ctx, req)
})
router.post('/v1/bookmark/star', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkStarRequest(ctx, req)
})
router.post('/v1/bookmark/alias_title', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkAliasTitleRequest(ctx, req)
})
router.post('/v1/bookmark/import', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserImportBookmarkRequest(ctx, req)
})
router.get('/v1/bookmark/import_status', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserImportBookmarkStatusRequest(ctx, req)
})
router.get('/v1/bookmark/summaries', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkSummariesRequest(ctx, req)
})
router.post('/v1/bookmark/search', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkSearchRequest(ctx, req)
})
router.post('/v1/bookmark/add_tag', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkAddTagRequest(ctx, req)
})
router.post('/v1/bookmark/del_tag', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(BookmarkController)
  return await controller.handleUserBookmarkDelTagRequest(ctx, req)
})
router.all('/callback/telegram', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(CallbackController)
  return await controller.handlerTelegramCallback(ctx, req)
})
router.get('/static/image', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(ImageController)
  return await controller.forwardImage(ctx, req)
})
router.post('/v1/mark/create', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(MarkController)
  return await controller.createMark(ctx, req)
})
router.post('/v1/mark/delete', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(MarkController)
  return await controller.deleteMark(ctx, req)
})
router.get('/v1/mark/list', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(MarkController)
  return await controller.getMarkList(ctx, req)
})
router.get('/v1/share/detail', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(ShareController)
  return await controller.getShare(ctx, req)
})
router.post('/v1/share/update', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(ShareController)
  return await controller.updateShare(ctx, req)
})
router.post('/v1/share/delete', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(ShareController)
  return await controller.deleteShare(ctx, req)
})
router.get('/v1/share/exists', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(ShareController)
  return await controller.existsShare(ctx, req)
})
router.get('/v1/share/mark_list', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(ShareController)
  return await controller.getMarkList(ctx, req)
})
router.get('/v1/tag/list', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(TagController)
  return await controller.handleListTagsRequest(ctx, req)
})
router.post('/v1/tag/update', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(TagController)
  return await controller.handleUpdateTagRequest(ctx, req)
})
router.post('/v1/tag/create', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(TagController)
  return await controller.handleCreateTagRequest(ctx, req)
})
router.post('/v1/user/login', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserLoginRequest(ctx, req)
})
router.get('/v1/user/me', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserDetailRequest(ctx, req)
})
router.post('/v1/user/refresh', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleRefreshTokenRequest(ctx, req)
})
router.post('/v1/user/bind_link', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserBindLinkRequest(ctx, req)
})
router.post('/v1/user/report', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserReportRequest(ctx, req)
})
router.post('/v1/user/setting', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserSettingRequest(ctx, req)
})
router.post('/v1/user/setting/enable', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleEnableUserSettingRequest(ctx, req)
})
router.post('/v1/user/setting/disable', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleDisableUserSettingRequest(ctx, req)
})
router.get('/v1/user/userinfo', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserInfoRequest(ctx, req)
})
router.post('/v1/user/subscribe/pushapi', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserSubscribePushApiRequest(ctx, req)
})
router.get('/v1/user/messages', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserMessagesRequest(ctx, req)
})
router.get('/v1/user/unread_count', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserUnreadCountRequest(ctx, req)
})
router.get('/v1/user/notifications', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserNotificationListRequest(ctx, req)
})
router.post('/v1/user/read_notifications', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserReadAllNotificationRequest(ctx, req)
})
router.post('/v1/user/read_notification', async (req: Request, ctx: ContextManager) => {
  const controller = container.resolve(UserController)
  return await controller.handleUserReadNotificationRequest(ctx, req)
})

router.get('/ping', () => Successed('pong'))
router.all('*', () => NotFound('Resource not found'))

export { router }

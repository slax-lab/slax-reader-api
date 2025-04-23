import { SlaxWebSocketServer } from './websocket'
import { ContextManager } from '../../utils/context'
import { Hashid } from '../../utils/hashids'
import { PushPayload, webPush } from '../../utils/webpush/push'
import { noticeType, userNoticePO } from '../repository/dbUser'
import { inject, injectable } from '../../decorators/di'
import { UserRepo } from '../repository/dbUser'
import type { PushSubscription } from '../../utils/webpush/webpush'
import { bookmarkActionChangePO } from '../repository/dbBookmark'

@injectable()
export class NotificationMessage {
  constructor(@inject(UserRepo) private userRepo: UserRepo) {}

  /**
   * 推送红点数量提醒，不包含具体内容
   * @param ctx
   * @param env
   * @param userId
   */
  public async sendReminders(env: Env, payload: { id: number; data: string; unreadCount: number }) {
    const { region, uuid } = JSON.parse(payload.data)
    const doId = env.WEBSOCKET_SERVER.idFromName('global')
    const dObj = env.WEBSOCKET_SERVER.get(doId, { locationHint: region })
    const res = await dObj.sendReminder(uuid, payload.unreadCount)
    if (!res) {
      await this.removeUserNoticeDevice(env, payload.id)
    }
  }

  // 使用DO对象发送红点数量提醒
  public async sendReminderWithDO(userId: number, token: string, dObj: DurableObjectStub<SlaxWebSocketServer>) {
    const res = await this.userRepo.getUserUnreadCount(userId)
    const unreadCount = res?.[0]?.notification_count || 0
    return await dObj.sendReminder(token, unreadCount)
  }

  // 删除用户通知设备
  public async removeUserNoticeDevice(env: Env, id: number) {
    return await this.userRepo.removeUserPushDevice(id)
  }

  /**
   * 发送通知
   * @param env
   * @param userId
   * @param type
   * @param data
   */
  public async sendNotification(env: Env, deviceId: number, deviceData: PushSubscription, payload: userNoticePO) {
    let url = ''
    if (payload.source === 'share') {
      const { comment_id } = JSON.parse(payload.details)
      const hashIds = new Hashid(env, payload.user_id)
      const notificationId = !!payload.id ? hashIds.encodeId(payload.id) : 0
      const highlightId = hashIds.encodeId(comment_id)
      url = `${env.FRONT_END_URL}/s/${JSON.parse(payload.details).share_code}?highlight=${highlightId}&notification_id=${notificationId}`
    }

    const pushPayload: PushPayload = {
      title: payload.title,
      body: payload.body,
      icon: 'https://r-beta.slax.com/icon.png',
      data: {
        url
      }
    }
    const res = await webPush(env, pushPayload, deviceData)
    if (!res) {
      await this.removeUserNoticeDevice(env, deviceId)
    }
  }

  // 批量发送通知
  public async batchSendNotification(env: Env, payloads: userNoticePO[]) {
    console.log(`than send ${payloads.length} notifications`)
    for (const item of payloads) {
      await this.sendNotificationToUser(env, item)
    }
  }

  // 发送通知
  public async sendNotificationToUser(env: Env, payload: userNoticePO) {
    // 获取全部的在线设备列表
    const devices = await this.userRepo.getUserOnlineDevice(payload.user_id)
    console.log('device.length', devices.length)
    const res = await this.userRepo.getUserUnreadCount(payload.user_id)
    const unreadCount = res?.[0]?.notification_count || 0
    const pushPromise = []
    for (const item of devices) {
      try {
        switch (item.type) {
          case noticeType.BROWSER:
            pushPromise.push(this.sendNotification(env, item.id, JSON.parse(item.data), payload))
            break
          case noticeType.APPLE:
            // TODO
            break
          case noticeType.TELEGRAM:
            // TODO
            break
          case noticeType.WEBSOCKET:
            pushPromise.push(this.sendReminders(env, { id: item.id, data: item.data, unreadCount: unreadCount }))
            break
        }
      } catch (e) {
        console.error(`send notification to user ${payload.user_id} failed: ${e}`)
      }
    }
    await Promise.all(pushPromise)
  }

  // 下发新的红点数据
  public async sendUnreaderReminder(ctx: ContextManager) {
    const pushPromise = []
    const [devices, unreadCount] = await Promise.all([this.userRepo.getUserOnlineDevice(ctx.getUserId()), this.userRepo.getUserUnreadCount(ctx.getUserId())])
    for (const item of devices) {
      if (item.type === noticeType.WEBSOCKET) {
        pushPromise.push(this.sendReminders(ctx.env, { id: item.id, data: item.data, unreadCount: unreadCount[0].notification_count }))
      }
    }
    await Promise.all(pushPromise)
  }

  // 下发新的书签收藏记录更新数据
  public async sendBookmarkChange(env: Env, payload: bookmarkActionChangePO) {
    const doId = env.WEBSOCKET_SERVER.idFromName('global')
    const dObj = env.WEBSOCKET_SERVER.get(doId)
    await dObj.sendBookmarkChange(payload)
  }
}

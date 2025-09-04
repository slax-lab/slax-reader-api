import { ErrorParam, UnknownBindUserError, UserNotFoundError } from '../../const/err'
import { inject, singleton } from '../../decorators/di'
import { PRISIMA_HYPERDRIVE_CLIENT } from '../../const/symbol'
import type { LazyInstance } from '../../decorators/lazy'
import { PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'

export interface userInfoPO {
  id?: number
  email: string
  name: string
  picture: string
  given_name: string
  family_name: string
  lang: string
  country: string
  city: string
  region: string
  timezone: string
  latitude: number
  longitude: number
  last_login_at: Date
  last_login_ip: string
  created_at: Date
  account: string
  ai_lang: string
  invite_code?: string

  last_read_at?: Date
}

export enum platformBindType {
  TELEGRAM = 'telegram',
  WECHAT = 'wechat',
  QQ = 'qq',
  EMAIL = 'email'
}

export enum noticeType {
  WEBSOCKET = 'websocket',
  APPLE = 'apple',
  BROWSER = 'browser',
  TELEGRAM = 'telegram'
}

export interface platformBind {
  user_id: number
  platform: platformBindType
  platform_id: string
  user_name: string
  created_at: Date
}

export interface userNoticePO {
  id?: number
  user_id: number
  type: string
  source: string
  title: string
  body: string
  details: string
  is_read: boolean
  created_at: Date
}

@singleton()
export class UserRepo {
  constructor(@inject(PRISIMA_HYPERDRIVE_CLIENT) private prismaPg: LazyInstance<HyperdrivePrismaClient>) {}

  public async getInfoByEmail(email: string): Promise<userInfoPO | null> {
    if (!email) return null
    let res = await this.prismaPg().s_user.findFirst({ where: { email: email } })
    if (!res) return null
    return res as userInfoPO
  }

  public async getInfoByUserId(id: number): Promise<userInfoPO> {
    if (!id) throw UserNotFoundError()
    return this.getInfo({ id: Number(id) })
  }

  async getUserInfoList(userIds: number[]) {
    if (!userIds || userIds.length === 0) return []
    return await this.prismaPg().s_user.findMany({ where: { id: { in: userIds } } })
  }

  async getInfo(condition: any): Promise<userInfoPO> {
    if (!condition) throw ErrorParam()
    let res = await this.prismaPg().s_user.findFirst({ where: condition })
    if (!res) throw UserNotFoundError()
    return res as userInfoPO
  }

  public async registerUser(info: userInfoPO): Promise<userInfoPO> {
    if (!info || !info.email) throw ErrorParam()

    // lang只在注册的时候处理
    const { lang, ...restUserInfo } = info
    return (await this.prismaPg().s_user.upsert({
      create: { ...info, created_at: new Date(), last_login_at: new Date() },
      update: { ...restUserInfo, last_login_at: new Date() },
      where: {
        email: info.email
      }
    })) as userInfoPO
  }

  public async updateUserName(userId: number, account: string): Promise<userInfoPO> {
    if (!userId || !account) throw ErrorParam()
    const res = await this.prismaPg().s_user.update({
      data: { account },
      where: { id: userId }
    })
    if (!res) throw UserNotFoundError()
    return res as userInfoPO
  }

  public async updateUserLang(userId: number, lang: string): Promise<userInfoPO> {
    if (!userId || !lang) throw ErrorParam()
    const res = await this.prismaPg().s_user.update({
      data: { lang },
      where: { id: userId }
    })
    if (!res) throw UserNotFoundError()
    return res as userInfoPO
  }

  public async updateUserAiLang(userId: number, lang: string): Promise<userInfoPO> {
    if (!userId || !lang) throw ErrorParam()
    const res = await this.prismaPg().s_user.update({
      data: { ai_lang: lang },
      where: { id: userId }
    })
    if (!res) throw UserNotFoundError()
    return res as userInfoPO
  }

  public async getUserByPlatform(platform: string, platformId: string): Promise<platformBind> {
    const bind = await this.prismaPg().s_platform_bind.findFirst({ where: { platform: platform, platform_id: platformId } })
    if (!bind) throw UnknownBindUserError()
    return {
      user_id: bind.user_id,
      platform: bind.platform as platformBindType,
      platform_id: bind.platform_id,
      user_name: bind.user_name,
      created_at: bind.created_at
    }
  }

  public async userBindPlatform(userId: number, platform: platformBindType, platformId: string, username: string): Promise<null> {
    if (!userId || !platform || !platformId) throw ErrorParam()
    await this.prismaPg().s_platform_bind.upsert({
      create: { user_id: userId, platform: platform, platform_id: platformId, user_name: username, created_at: new Date() },
      update: { user_id: userId, platform: platform, platform_id: platformId, user_name: username },
      where: {
        user_id_platform: { user_id: userId, platform: platform }
      }
    })
    return null
  }

  public async getUserBindPlatform(userId: number) {
    return await this.prismaPg().s_platform_bind.findMany({ where: { user_id: userId } })
  }

  public async unbindPlatform(userId: number, platform: platformBindType) {
    return await this.prismaPg().s_platform_bind.deleteMany({ where: { user_id: userId, platform: platform } })
  }

  public async updateInviteCode(userId: number, inviteCode: string) {
    return await this.prismaPg().s_user.update({ data: { invite_code: inviteCode }, where: { id: userId } })
  }

  public async addUserPushDevice(userId: number, type: noticeType, data: string) {
    return await this.prismaPg().s_user_notice_device.create({
      data: { user_id: userId, type: type.toString(), data }
    })
  }

  public async getUserOnlineDevice(userId: number) {
    return await this.prismaPg().s_user_notice_device.findMany({ where: { user_id: userId } })
  }

  public async removeUserPushDevice(id: number) {
    return await this.prismaPg().s_user_notice_device.delete({ where: { id } })
  }

  public async getUserUnreadCount(userId: number) {
    return await this.prismaPg().$queryRaw<
      {
        notification_count: number
      }[]
    >`SELECT (SELECT count(1) FROM s_user_notification WHERE user_id = u.id AND (u.last_read_at IS NULL OR created_at > u.last_read_at) AND is_read = false) as notification_count FROM s_user u WHERE id = ${userId};`
  }

  public async getUserNotificationList(userId: number, page: number, pageSize: number) {
    return await this.prismaPg().s_user_notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  }

  public async addUserNotice(po: userNoticePO): Promise<userNoticePO> {
    return await this.prismaPg().s_user_notification.create({
      data: po
    })
  }

  public async updateUserReadAt(userId: number) {
    return await this.prismaPg().s_user.update({ data: { last_read_at: new Date() }, where: { id: userId } })
  }

  public async updateUserNotificationRead(userId: number, id: number) {
    return await this.prismaPg().s_user_notification.update({ data: { is_read: true }, where: { id, user_id: userId } })
  }
}

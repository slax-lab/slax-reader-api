import { ContextManager } from '../utils/context'
import { Auth } from '../utils/jwt'
import { NeedCreateUsernameError, RegisterUserError, SaveReportError, UnauthorizedError, UserNotFoundError } from '../const/err'
import { platformBindType, userInfoPO } from '../infra/repository/dbUser'
import { Hashid } from '../utils/hashids'
import { reportType } from '../infra/repository/dbReport'
import { RequestUtils } from '../utils/requestUtils'
import { SlaxAuth } from '../utils/auth'
import { hashMD5, hashSHA256 } from '../utils/strings'
import { inject, injectable } from '../decorators/di'
import type { LazyInstance } from '../decorators/lazy'
import { UserRepo } from '../infra/repository/dbUser'
import { BucketClient } from '../infra/repository/bucketClient'
import { ReportRepo } from '../infra/repository/dbReport'

export interface userShareCollectInfo {
  show_name: string
  price: number
  currency: string
  collection_code: string
  status: number
}

export interface userInfoResp {
  userId: number
  email: string
  lang: string
  name: string
  picture: string
  timezone: string
}

export interface reportInfoReq {
  user_id: number
  content: string
  type: reportType
  bookmark_id?: number
  share_code?: string
}

export interface userBindPlatformItem {
  platform: string
  user_name: string
  created_at: Date
}

export interface userInfo {
  account: string
  email: string
  lang: string
  ai_lang: string
  timezone: string
  avatar: string
  name: string
  id: number
  uuid: string

  platform: userBindPlatformItem[]
}

export interface userStripeConnectInfo {
  account_id: string
  stripe_status: string
  status: string
  charges_enabled: boolean
  payout_enabled: boolean
  business_profile: any
  stripe_capabilities: any
}

export interface userShareCollectInfo {
  show_name: string
  price: number
  currency: string
  collection_code: string
  status: number
  show_marks: boolean
  allow_marks: boolean
  show_profile: boolean
  service_charge_percent: number
}

export interface userLoginReq {
  code: string
  redirect_uri: string
  platform: '' | 'web' | 'ios' | 'android' | 'macOS' | 'windows'
  type: '' | 'google' | 'apple'
  given_name?: string
  family_name?: string
  aff_code?: string
  siteverify_code?: string
}

export interface userLoginResp {
  token: string
  user_id: string
}

@injectable()
export class UserService {
  constructor(
    @inject(UserRepo) private userRepo: UserRepo,
    @inject(BucketClient) private bucketClient: LazyInstance<BucketClient>,
    @inject(ReportRepo) private reportRepo: ReportRepo
  ) {}

  /**
   * 登录接口
   * @param ctx
   * @param env
   * @param code
   * @param redirect_uri
   * @param platform
   * @param request
   * @returns
   */
  public async userLogin(ctx: ContextManager, request: Request): Promise<userLoginResp> {
    const req = await RequestUtils.json<userLoginReq>(request)
    const authRes = await new SlaxAuth(ctx.env).login(req)

    // get user info by email
    const findRes = await this.userRepo.getInfoByEmail(authRes.email)
    if (findRes instanceof Error) {
      console.error(`get user info error: ${findRes}`)
      throw RegisterUserError()
    }

    let userInfo = (!!findRes ? findRes : {}) as userInfoPO
    // const isFirstRegister = !findRes || !findRes.id

    userInfo = UserService.getUserReuqestInfo(request, userInfo)

    // 从google获取用户信息
    const { email, name, picture, given_name, family_name } = authRes
    Object.assign(userInfo, { email, name, picture, given_name, family_name })

    // 如果有头像，保存一下
    const avatar = await this.bucketClient().putRemoteIfKeyExists(picture, 'image/avartar')
    if (avatar) userInfo.picture = `${ctx.env.IMAGE_PREFIX}${avatar.key}`

    // save or update user info
    const regRes = await this.userRepo.registerUser(userInfo)

    const regInfo = regRes as userInfoPO
    if (!regInfo || !regInfo.id) {
      console.log('register user failed:', regInfo)
      throw RegisterUserError()
    }

    // sign token
    const signUserId = new Hashid(ctx.env).encodeId(regInfo.id)
    const token = await new Auth(ctx.env).sign({ id: String(signUserId), lang: regInfo.lang, email: regInfo.email })

    // 发放邀请奖励
    //   if (isFirstRegister && req.aff_code) {
    //     const turnstileToken = req.siteverify_code
    //     const secretKey = `${env.TURNSTILE_SECRET_KEY}`
    //     const siteverifyUrl = `${env.TURNSTILE_SITEVERIFY_URL}`
    //     const resp = (await fetch(siteverifyUrl, {
    //       method: 'POST',
    //       body: JSON.stringify({
    //         secret: secretKey,
    //         response: turnstileToken
    //       })
    //     })) as Response

    //     if (!resp.ok) {
    //       return RegisterUserError()
    //     }

    //     const data = (await resp.json()) as { success: boolean }
    //     if (!data.success) {
    //       return RegisterUserError()
    //     }
    //     await new QueueClient(env).pushInviteMessage({
    //       affCode: req.aff_code,
    //       invitedUserId: regInfo.id
    //     })
    //   }

    // await new KVClient(env.KV).delete.USER_INFO(regInfo.id)

    return {
      token,
      user_id: signUserId.toString()
    }
  }

  /**
   * 用户信息接口
   * @param ctx
   * @param env
   * @param userId
   * @returns
   */
  public async userDetail(ctx: ContextManager): Promise<userInfoResp> {
    if (!ctx.getUserId()) throw UnauthorizedError()
    const userRes = await this.userRepo.getInfoByUserId(ctx.getUserId())
    if (!userRes) throw UnauthorizedError()

    return {
      userId: ctx.hashIds.encodeId(ctx.getUserId()),
      email: userRes.email,
      lang: !!userRes.lang ? userRes.lang.slice(0, 2) : 'en',
      name: userRes.name,
      picture: userRes.picture || '',
      timezone: userRes.timezone || ''
    }
  }

  /**
   * 刷新token接口
   * @param ctx
   * @param env
   * @param userId
   * @returns
   */
  refreshToken = async (ctx: ContextManager): Promise<string> => {
    const info = await this.userRepo.getInfoByUserId(ctx.getUserId())
    const userToken = new Hashid(ctx.env).encodeId(ctx.getUserId())
    return await new Auth(ctx.env).sign({ id: String(userToken), lang: info.lang, email: info.email })
  }

  /**
   * 保存反馈
   * @param ctx
   * @param env
   * @param req
   * @returns
   */
  public async saveReport(ctx: ContextManager, req: reportInfoReq): Promise<undefined> {
    const res = await this.reportRepo.saveReport(req)
    if (!res) throw SaveReportError()

    // const user = await this.userRepo.getInfoByUserId(req.user_id)

    // const content = i18n('zh').reportPushTemplate({
    //   type: req.type === reportType.LIKE ? '👍🏻' : '👎🏻',
    //   id: res.id,
    //   name: user.name,
    //   country: user.country,
    //   content: req.content
    // })
  }

  /**
   * 获取用户设置信息接口
   * @param ctx
   * @param env
   * @returns
   */
  public async getUserInfo(ctx: ContextManager): Promise<userInfo> {
    const [user, bindList] = await Promise.all([this.userRepo.getInfoByUserId(ctx.getUserId()), this.userRepo.getUserBindPlatform(ctx.getUserId())])

    return {
      uuid: user.uuid,
      name: user.name,
      account: user.account,
      email: user.email,
      lang: !!user.lang ? user.lang.slice(0, 2) : 'en',
      ai_lang: !!user.ai_lang ? user.ai_lang : user.lang?.slice(0, 2) || 'en',
      timezone: user.timezone,
      avatar: user.picture,
      id: ctx.hashIds.encodeId(ctx.getUserId()),
      platform: bindList.map(item => {
        return {
          platform: item.platform,
          user_name: item.user_name,
          created_at: item.created_at
        }
      })
    }
  }

  /**
   * 保存用户设置
   * @param ctx
   * @param env
   * @param data
   * @returns
   */
  public async saveUserSetting(ctx: ContextManager, data: { key: string; value: string }): Promise<undefined> {
    if (data.key === 'account') {
      // 判断唯一、长度、是不是特定字符
      await this.userRepo.getInfo({ account: data.value })
      await this.userRepo.updateUserName(ctx.getUserId(), data.value)
    } else if (data.key === 'lang') {
      await this.userRepo.updateUserLang(ctx.getUserId(), data.value)
    } else if (data.key === 'ai_lang') {
      await this.userRepo.updateUserAiLang(ctx.getUserId(), data.value)
    }
    return
  }

  /**
   * 用户设置开关
   * @param ctx
   * @param env
   * @param setting
   * @param enable
   * @returns
   */
  public async enableUserSetting(ctx: ContextManager, setting: string, enable: boolean): Promise<string | userShareCollectInfo> {
    // const user = await this.userRepo.getInfoByUserId(ctx.getUserId())

    if (setting === 'mail_collect' && !enable) {
      await this.userRepo.unbindPlatform(ctx.getUserId(), platformBindType.EMAIL)
    }
    if (setting === 'mail_collect' && enable) {
      const user = await this.userRepo.getInfoByUserId(ctx.getUserId())
      if (!user) throw UserNotFoundError()
      if (!user.account) throw NeedCreateUsernameError()

      await this.userRepo.userBindPlatform(ctx.getUserId(), platformBindType.EMAIL, user.account, `${user.account}@reader.slax.com`)
    }
    if (setting === 'affiliates' && enable) {
      const user = await this.userRepo.getInfoByUserId(ctx.getUserId())
      if (!user) throw UserNotFoundError()
      if (user.invite_code) return 'ok'
      if (!user.id) throw UserNotFoundError()
      const code = await hashMD5(user.id?.toString())
      await this.userRepo.updateInviteCode(ctx.getUserId(), code)
    }
    return 'ok'
  }

  public static getUserReuqestInfo = (request: Request, userInfo: userInfoPO) => {
    // 获取真实的请求IP
    if (request.headers.has('x-real-ip')) {
      userInfo.last_login_ip = request.headers.get('x-real-ip') || ''
    }
    // 从header头中获取语言信息
    if (request.headers.has('accept-language')) {
      const lang = request.headers.get('accept-language')?.split(',')
      userInfo.lang = lang && lang.length > 1 ? lang[1] : 'en'
    }
    // 从Cloudflare中获取相关国家、IP等信息
    if (request.cf) {
      const { city, country, region, latitude, longitude, timezone } = request.cf
      Object.assign(userInfo, {
        city: city ?? '',
        country,
        region: region ?? '',
        latitude: Number(latitude ?? 0),
        longitude: Number(longitude ?? 0),
        timezone
      })
    }
    return userInfo
  }

  public async getUserBriefInfo(isShowUserInfo: boolean, userId: number): Promise<{ nick_name: string; avatar: string }> {
    if (!isShowUserInfo) return { nick_name: '', avatar: '' }

    const user = await this.userRepo.getInfo({ id: userId })
    if (!user) return { nick_name: '', avatar: '' }

    return { nick_name: user.name, avatar: user.picture }
  }

  /** 获取绑定Telegram链接 */
  public async getBindTelegramLink(ctx: ContextManager): Promise<string> {
    const userId = ctx.getUserId()
    const url = new URL(`https://t.me/${ctx.env.SLAX_READER_BOT_NAME}`)
    const token = `${ctx.getEncodeUserId()}-${(await hashSHA256(String(userId + ctx.env.IMAGER_CHECK_DIGST_SALT))).substring(0, 50)}`
    url.searchParams.set('start', token)
    return url.toString()
  }
}

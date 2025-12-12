import { RegisterUserError, UnverifiedEmailError } from '../const/err'
import { userLoginReq } from '../domain/user'
import { AppleAuth } from './authLogin/authApple'
import { GoogleAuth } from './authLogin/authGoogle'

export interface SlaxAuthResult {
  iss: string
  sub: string
  azp: string
  aud: string
  iat: string
  exp: string
  email: string
  email_verified: string
  name?: string
  picture: string
  given_name?: string
  family_name?: string
  locale: string
}

export class SlaxAuth {
  constructor(private env: Env) {}

  async login(req: userLoginReq): Promise<SlaxAuthResult> {
    // 兼容操作
    if (!req.type) req.type = 'google'
    if (!req.platform) req.platform = 'web'

    switch (req.type) {
      case 'google':
        return await this.loginWithGoogle(req)
      case 'apple':
        return await this.loginWithApple(req)
    }
    console.log(`auth ${req.type} result failed, unknow type ${req.type}`)
    throw RegisterUserError()
  }

  public async loginWithGoogle(req: userLoginReq): Promise<SlaxAuthResult> {
    const googleAuth = new GoogleAuth(this.env, req.platform)

    if (req.platform === 'web') {
      const tokenInfo = await googleAuth.getToken(req.code, req.redirect_uri)
      req.code = tokenInfo.id_token
    }

    return await googleAuth.verifyGoogleToken(req.code)
  }

  public async loginWithApple(req: userLoginReq): Promise<SlaxAuthResult> {
    const res = await new AppleAuth(this.env).loginWithApple(req.code, req.id_token || '', req.redirect_uri)
    console.log('loginWithApple result:', res)

    const userName = !!req.family_name ? `${req.given_name} ${req.family_name}` : undefined
    const givenName = req.given_name || undefined
    const familyName = req.family_name || undefined

    return {
      iss: res.iss,
      sub: res.sub,
      aud: res.aud,
      iat: res.iat,
      exp: res.exp,
      azp: '',
      email: res.email,
      email_verified: 'true',
      name: userName,
      picture: '',
      given_name: givenName,
      family_name: familyName,
      locale: 'en'
    }
  }
}

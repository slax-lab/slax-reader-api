import { RegisterUserError, UnverifiedEmailError } from '../const/err'
import { userLoginReq } from '../domain/user'
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
    }
    console.log(`auth ${req.type} result failed, unknow type ${req.type}`)
    throw RegisterUserError()
  }

  private async loginWithGoogle(req: userLoginReq): Promise<SlaxAuthResult> {
    return new GoogleAuth(this.env, req.platform).loginWithGoogle(req.code, req.redirect_uri)
  }
}

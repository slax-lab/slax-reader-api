import { GoogleSSOError, GoogleSSORespError, GoogleSSOAudError } from '../../const/err'

interface tokenInfo {
  iss: string
  sub: string
  azp: string
  aud: string
  iat: string
  exp: string
  email: string
  email_verified: string
  name: string
  picture: string
  given_name: string
  family_name: string
  locale: string
}

interface codeInfo {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token: string
  error?: string
  error_description?: string
}

class GoogleAuth {
  private authPrefix: string
  private clientId: string
  private clientSecret: string

  private static readonly GOOGLE_AUTH_PREFIX = 'https://oauth2.googleapis.com'

  constructor(env: Env, platform: string) {
    switch (platform) {
      case 'ios':
        this.clientId = env.GOOGLE_IOS_CLIENT_ID_TEXT
        this.clientSecret = ''
        break
      case 'android':
        this.clientId = env.GOOGLE_CLIENT_ID_TEXT
        this.clientSecret = env.GOOGLE_CLIENT_SECRET_TEXT
      case 'web':
        this.clientId = env.GOOGLE_CLIENT_ID_TEXT
        this.clientSecret = env.GOOGLE_CLIENT_SECRET_TEXT
      default:
        this.clientId = env.GOOGLE_CLIENT_ID_TEXT
        this.clientSecret = env.GOOGLE_CLIENT_SECRET_TEXT
    }
    this.authPrefix = env.GOOGLE_AUTH_PREFIX.length > 0 ? env.GOOGLE_AUTH_PREFIX : GoogleAuth.GOOGLE_AUTH_PREFIX
  }

  verifyGoogleToken = async (idToken: string): Promise<tokenInfo> => {
    // verify google token
    const verifyUrl = new URL(`${this.authPrefix}/tokeninfo`)
    verifyUrl.searchParams.append('id_token', encodeURI(idToken))
    const response = (await fetch(verifyUrl.toString())) as Response
    if (!response || !response.ok) {
      console.error(`verifyGoogleToken error: ${await response.text()}`)
      throw GoogleSSOError()
    }

    let data: tokenInfo
    try {
      data = await response.json<tokenInfo>()
    } catch (e) {
      console.error(`verifyGoogleToken error: ${e}`)
      throw GoogleSSORespError()
    }

    if (data.aud !== this.clientId) {
      throw GoogleSSOAudError()
    }

    return data
  }

  async getToken(code: string, redirect_uri: string): Promise<codeInfo> {
    const url = `${this.authPrefix}/token`
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    const values = new URLSearchParams({
      client_id: this.clientId,
      code: encodeURI(code),
      grant_type: 'authorization_code',
      client_secret: this.clientSecret,
      redirect_uri: redirect_uri
    })

    try {
      const res = (await fetch(url, {
        method: 'POST',
        headers,
        body: values.toString()
      })) as Response

      const result = await res.json<codeInfo>()
      if (!result) {
        throw GoogleSSOAudError()
      }
      if (result.error) {
        throw GoogleSSOAudError()
      }
      return result
    } catch (err) {
      console.error(`getToken error: ${err}`)
      throw GoogleSSOError()
    }
  }

  async loginWithGoogle(code: string, redirect_uri: string): Promise<tokenInfo> {
    const token = await this.getToken(code, redirect_uri)
    return await this.verifyGoogleToken(token.id_token)
  }
}

export { GoogleAuth }

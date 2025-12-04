import { RequestAppleAuthFail } from '../../const/err'
import { decodeJwt, importPKCS8, SignJWT } from 'jose'

export interface AppleIdTokenType {
  iss: string
  sub: string
  aud: string
  exp: string
  iat: string
  nonce: string
  nonce_supported: boolean
  email: string
  email_verified: 'true' | 'false' | boolean
  is_private_email: 'true' | 'false' | boolean
  // 0 （或Unsupported ）、 1 （或Unknown ）、 2 （或Likely Real ）
  real_user_status?: number
}

export interface AppleAuthorizationTokenResponseType {
  access_token: string
  token_type: 'Bearer'
  expires_in: 300
  refresh_token: string
  id_token: string
}

export interface ApplePublicResp {
  keys: AppleKey[]
}

export interface AppleKey {
  kty: string
  kid: string
  use: string
  alg: string
  n: string
  e: string
}

export class AppleAuth {
  private kv: KVNamespace
  private keyId: string
  private clientId: string
  private teamId: string
  private privateKey: string

  static algorithm = 'ES256'
  static clientSecretKey = 'apple_client_secret'
  static applePublicKey = 'apple_public_key'
  static ENDPOINT_URL = 'https://appleid.apple.com'

  constructor(env: Env) {
    this.kv = env.KV
    this.keyId = env.APPLE_SIGN_KEY_ID
    this.privateKey = env.APPLE_SIGN_AUTH_KEY
    this.clientId = env.APPLE_SIGN_CLIENT_ID
    this.teamId = env.APPLE_SIGN_TEAM_ID
    this.privateKey = this.privateKey
      .replace(/\\n/g, '')
      .replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
      .replace(/(.{64})/g, '$1\n')
  }

  private base64UrlToUint8Array(base64Url: string): Uint8Array {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
    const base64 = (base64Url + padding).replace(/\-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private async exportApplePublicKey(data: ApplePublicResp): Promise<ArrayBuffer | JsonWebKey> {
    const modulus = this.base64UrlToUint8Array(data.keys[0].n)
    const exponent = this.base64UrlToUint8Array(data.keys[0].e)
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'RSA',
        n: btoa(String.fromCharCode(...modulus)),
        e: btoa(String.fromCharCode(...exponent)),
        alg: 'RS256',
        ext: true
      },
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: { name: 'SHA-256' }
      },
      true,
      ['verify']
    )
    return await crypto.subtle.exportKey('jwk', publicKey)
  }

  private async getApplePublicKeyFromApple(): Promise<ApplePublicResp> {
    const url = new URL(AppleAuth.ENDPOINT_URL)
    url.pathname = '/auth/keys'

    const resp = (await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })) as Response
    if (!resp.ok) throw RequestAppleAuthFail()

    const data = await resp.json<ApplePublicResp>()
    if (!data.keys) throw RequestAppleAuthFail()

    return data
  }

  private async getApplePublicKey(): Promise<string> {
    const key = await this.kv.get(AppleAuth.applePublicKey)
    if (key) return key

    const data = await this.getApplePublicKeyFromApple()

    const keyString = await this.exportApplePublicKey(data)
    const saveKeyString = JSON.stringify(keyString)
    await this.kv.put(AppleAuth.applePublicKey, saveKeyString, { expirationTtl: 86400 * 30 })

    return saveKeyString
  }

  //  get client secret
  private async getClientSecret(): Promise<string> {
    const header = { alg: AppleAuth.algorithm, kid: this.keyId }
    const privateKey = await importPKCS8(this.privateKey, 'ES256')

    return await new SignJWT()
      .setProtectedHeader(header)
      .setIssuer(this.teamId)
      .setExpirationTime('170days')
      .setIssuedAt()
      .setSubject(this.clientId)
      .setAudience(AppleAuth.ENDPOINT_URL)
      .sign(privateKey)
  }

  private async getAuthorizationToken(code: string, clientSecret: string, redirectUri?: string): Promise<AppleAuthorizationTokenResponseType> {
    const url = new URL(AppleAuth.ENDPOINT_URL)
    url.pathname = '/auth/token'

    const params = new URLSearchParams()
    params.append('client_id', this.clientId)
    params.append('client_secret', clientSecret)
    params.append('code', code)
    params.append('grant_type', 'authorization_code')
    params.append('redirect_uri', redirectUri || 'https://reader.slax.com/callback/apple')

    const resp = (await fetch(url.toString(), {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })) as Response

    if (!resp.ok) {
      console.error('getAuthorizationToken error:', await resp.text())
      throw RequestAppleAuthFail()
    }

    return await resp.json<AppleAuthorizationTokenResponseType>()
  }

  private async verifyIdToken(idToken: string): Promise<AppleIdTokenType> {
    try {
      return decodeJwt<AppleIdTokenType>(idToken)
    } catch (e) {
      console.error('verifyIdToken error:', e)
      throw RequestAppleAuthFail()
    }
  }

  //  Sign in with Apple
  async loginWithApple(code: string, redirectUri?: string): Promise<AppleIdTokenType> {
    try {
      const clientRes = await this.getClientSecret()

      const tokenResp = await this.getAuthorizationToken(code, clientRes, redirectUri)

      const authResp = await this.verifyIdToken(tokenResp.id_token)

      return authResp as AppleIdTokenType
    } catch (err) {
      console.error('loginWithApple error:', err)
      throw RequestAppleAuthFail()
    }
  }
}

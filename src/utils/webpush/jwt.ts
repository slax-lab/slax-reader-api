import { base64UrlEncode } from './utils'
import type { JwtData } from './types'

// https://web.dev/push-notifications-web-push-protocol/#web-push-and-signed-jwts
export const createJwt = async (jwk: JsonWebKey, jwtData: JwtData) => {
  const jwtInfo = {
    typ: 'JWT',
    alg: 'ES256'
  }

  const base64JwtInfo = base64UrlEncode(JSON.stringify(jwtInfo))
  const base64JwtData = base64UrlEncode(JSON.stringify(jwtData))
  const unsignedToken = `${base64JwtInfo}.${base64JwtData}`

  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  const signature = await crypto.subtle
    .sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, privateKey, new TextEncoder().encode(unsignedToken))
    .then(token => base64UrlEncode(token))

  return `${base64JwtInfo}.${base64JwtData}.${signature}`
}

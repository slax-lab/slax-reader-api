import { PushSubscription } from './types'
import { buildRequest } from './webpush'

export interface PushPayload {
  title: string
  body: string
  icon: string
  data: object
}

export const webPush = async (env: Env, payload: PushPayload, subscription: PushSubscription) => {
  const jwk = JSON.parse(env.PUSH_API_JWK_KEY.replace(/\\/g, ''))
  const ttl = 20 * 60 * 60
  const host = new URL(subscription.endpoint).origin

  const pushRequest = await buildRequest(
    {
      jwk,
      ttl,
      jwt: {
        aud: host,
        exp: Math.floor(Date.now() / 1000) + ttl,
        sub: 'help@slax.com'
      },
      payload: JSON.stringify(payload)
    },
    subscription
  )

  const response = await fetch(pushRequest)
  if (!response.ok) {
    const body = await response.text()
    console.log(`received http code ${response.status}: `, body)
    return false
  } else {
    // console.log('push success', await response.text())
  }
  return true
}

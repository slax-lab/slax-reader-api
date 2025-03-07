export interface JwtData {
  /**
   * The aud value is the "audience", i.e. who the JWT is for. For web push the audience is the push service, so we set it to the origin of the push service.
   */
  aud: string
  /**
   * The exp value is the expiration of the JWT, this prevent snoopers from being able to re-use a JWT if they intercept it. The expiration is a timestamp in seconds and must be no longer 24 hours.
   */
  exp: number
  /**
   * The sub value needs to be either a URL or a mailto email address. This is so that if a push service needed to reach out to sender, it can find contact information from the JWT. (This is why the web-push library needed an email address).
   */
  sub: string
}

export interface PushOptions {
  jwk: JsonWebKey
  jwt: JwtData
  payload: string
  ttl: number
  topic?: string
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
}

export interface PushSubscriptionKey {
  p256dh: string
  auth: string
}

export interface PushSubscription {
  /**
   * The endpoint is the push services URL. To trigger a push message, make a POST request to this URL.
   */
  endpoint: string
  /**
   * The keys object contains the values used to encrypt message data sent with a push message.
   */
  keys: PushSubscriptionKey
}

import { Redis } from '@upstash/redis/cloudflare'
import { singleton } from '../../decorators/di'

class RedisOperation<T> {
  constructor(
    private readonly client: Redis,
    private readonly key: string
  ) {}

  async get(): Promise<T | null> {
    const value = await this.client.get(this.key)
    if (!value) return null

    try {
      return typeof value === 'string' ? (JSON.parse(value) as T) : (value as unknown as T)
    } catch {
      return value as unknown as T
    }
  }

  async set(value: T): Promise<void> {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
    await this.client.set(this.key, stringValue)
  }

  async setWithExpire(value: T, seconds: number): Promise<void> {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
    await this.client.set(this.key, stringValue, { ex: seconds })
  }

  async incr(): Promise<number> {
    return this.client.incr(this.key)
  }

  async incrBy(value: number): Promise<number> {
    return this.client.incrby(this.key, value)
  }

  async incrWithExpire(seconds: number): Promise<number> {
    const value = await this.incr()
    await this.expire(seconds)
    return value
  }

  async incrWithExpireAt(seconds: number): Promise<number> {
    const value = await this.incr()
    await this.expireat(seconds)
    return value
  }

  async delete(): Promise<void> {
    await this.client.del(this.key)
  }

  async exists(): Promise<number> {
    return this.client.exists(this.key)
  }

  async expireat(seconds: number): Promise<void> {
    await this.client.expireat(this.key, seconds)
  }

  async expire(seconds: number): Promise<void> {
    await this.client.expire(this.key, seconds)
  }
}

@singleton()
export class RedisClient {
  private client: Redis

  constructor(env: Env) {
    this.client = Redis.fromEnv(env)
  }

  key<T>(key: string): RedisOperation<T> {
    return new RedisOperation<T>(this.client, key)
  }

  emailVerifyCode(email: string) {
    return this.key<string>(`email_verify_code:${email}`)
  }

  emailLastSendTime(email: string) {
    return this.key<number>(`email_last_send_time:${email}`)
  }

  emailDailyCount(email: string) {
    return this.key<number>(`email_daily_count:${email}`)
  }

  emailRateLimit(email: string) {
    return this.key<number>(`email_rate_limit:${email}`)
  }

  userProfile(userId: string) {
    return this.key<Record<string, any>>(`user_profile:${userId}`)
  }

  userRefine(userId: number) {
    return this.key<Record<string, any>>(`user_refine:${userId}`)
  }

  userVoiceTranscription(userId: number) {
    return this.key<Record<string, any>>(`user_voice_transcription:${userId}`)
  }

  userVoiceTranscriptionUUID(userId: number, uuid: string) {
    return this.key<Record<string, any>>(`user_voice_transcription_uuid:${userId}:${uuid}`)
  }
}

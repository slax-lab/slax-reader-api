import Hashids from 'hashids'

export class Hashid {
  private hashids: Hashids

  constructor(env: Env, userId?: number) {
    this.hashids = new Hashids(env.HASH_IDS_SALT + String(userId || 0))
  }

  public encodeId(id: number): number {
    const hash = this.hashids.encode(id)
    return this.stringToNumber(hash)
  }

  public decodeId(hash: number): number {
    const decoded = this.hashids.decode(this.numberToString(hash))
    return Number(decoded[0]) || 0
  }

  private stringToNumber(str: string): number {
    let result = 0
    const len = str.length
    for (let i = 0; i < len; i++) {
      result = (result << 8) + str.charCodeAt(i)
    }
    return result
  }

  private numberToString(num: number): string {
    if (num === 0) return ''

    const chars: number[] = []
    while (num > 0) {
      chars.push(num % 256)
      num = Math.floor(num / 256)
    }

    return String.fromCharCode(...chars.reverse())
  }

  private readonly chatset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

  public generateTimeCode() {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime()
    const minutesSinceStartOfYear = Math.floor((now.getTime() - startOfYear) / (1000 * 60))

    let code = ''
    let remaining = minutesSinceStartOfYear
    for (let i = 0; i < 3; i++) {
      code = this.chatset[remaining % 62] + code
      remaining = Math.floor(remaining / 62)
    }

    return code
  }
}

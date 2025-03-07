import { R2Bucket } from '@cloudflare/workers-types'
import { hashSHA256 } from '../../utils/strings'
import { injectable, singleton } from '../../decorators/di'

@injectable()
export class BucketClient {
  public R2Bucket: R2Bucket

  constructor(private env: Env) {
    this.R2Bucket = env.OSS
  }

  public async putIfKeyExists(key?: string, val?: any): Promise<R2Object | null> {
    if (!key || !val) return null
    return this.R2Bucket.put(key, val)
  }

  public async putRemoteIfKeyExists(url: string, path: string, key?: string): Promise<R2Object | null> {
    if (this.env.RUN_ENV !== 'prod' || !url) return null
    if (!key) key = await hashSHA256(url)
    const resp = (await fetch(url)) as Response
    if (!resp.ok) return null
    const imageMime = resp.headers.get('Content-Type') || 'image/jpeg'
    return this.R2Bucket.put(`${path}/${key}`, resp.body, {
      httpMetadata: { contentType: imageMime }
    })
  }

  public deleteIfKeyExists(key: string): Promise<void> {
    if (!key) return Promise.resolve()
    return this.R2Bucket.delete(key)
  }

  public getIfKeyExists(key: string): Promise<R2Object | null> {
    if (!key) return Promise.resolve(null)
    return this.R2Bucket.get(key)
  }
}

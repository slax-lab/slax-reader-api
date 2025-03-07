import { ContextManager } from '../../utils/context'
import { hashMD5, hashSHA256 } from '../../utils/strings'
import { getImageProxyHeaders } from '../../utils/imager'
import { RequestUtils } from '../../utils/requestUtils'
import { Failed, NotFound, responseImage, responseRedirect } from '../../utils/responseUtils'
import { Controller } from '../../decorators/controller'
import { Get } from '../../decorators/route'
import { inject } from '../../decorators/di'
import { BucketClient } from '../../infra/repository/bucketClient'
import { LazyInstance } from '../../decorators/lazy'

@Controller('/static')
export class ImageController {
  constructor(@inject(BucketClient) private bucketClient: LazyInstance<BucketClient>) {}

  @Get('/image')
  public async forwardImage(ctx: ContextManager, request: Request) {
    const req = await RequestUtils.query<{ u: string; r: string; d: string }>(request)
    if (!req || !req.u || !req.d) return Failed(NotFound('action not found'))

    const checkDigest = (await hashMD5(req.u + req.r + ctx.env.IMAGER_CHECK_DIGST_SALT)) == req.d
    const referer = true
    const responseCache = referer && checkDigest

    let fileKey = `image/${await hashSHA256(req.u)}`
    if (!checkDigest || !referer) fileKey = 'notfound.png'

    // R2数据包含两种
    // 1. 真实的图片数据
    // 2. 空的占位符，标记图片大于2M且不是微信图床
    const obj = await ctx.env.OSS.get(fileKey)
    if (obj?.customMetadata?.large) {
      return responseRedirect(req.u)
    } else if (obj) return responseImage(obj.body, obj.httpMetadata?.contentType || 'image/jpeg', responseCache)

    req.u = decodeURIComponent(req.u)
    const headers = getImageProxyHeaders(req.u, req.r, request.headers)

    const imageResp = (await fetch(req.u, {
      method: request.method,
      headers
    })) as Response

    const imageMime = imageResp.headers.get('Content-Type') || 'image/jpeg'
    const imageLength = parseInt(imageResp.headers.get('Content-Length') || '0')

    if (!imageResp || !imageResp.ok || imageResp.body == null) {
      // 读出body内容
      console.log(`fetch image ${req.u} faild, resp: ${await imageResp.text()}, status: ${imageResp.status}`)
      imageResp?.body?.cancel()
      return responseRedirect(ctx.env.IMAGE_PREFIX + 'notfound.png')
    }
    // 如果图片超大，直接302到原图
    // 公众号除外，他有源站判断，需要代理流量
    if (imageLength > 1024 * 1024 * 3) {
      if (imageResp.url.startsWith('https://mmbiz.qpic.cn')) {
        return responseImage(imageResp.body, imageMime)
      } else {
        imageResp?.body?.cancel()
        ctx.execution.waitUntil(this.bucketClient().R2Bucket.put(fileKey, '1', { customMetadata: { large: '1' } }))
        return responseRedirect(req.u)
      }
    }

    const [stream1, stream2] = imageResp.body.tee()

    const fixedLengthStream = new FixedLengthStream(imageLength)
    stream2.pipeThrough(fixedLengthStream)
    ctx.execution.waitUntil(
      this.bucketClient()
        .R2Bucket.put(fileKey, fixedLengthStream.readable, {
          httpMetadata: { contentType: imageMime }
        })
        .catch(error => console.error(`Error storing in R2: ${error}`))
    )

    return responseImage(stream1, imageMime, responseCache)
  }
}

import { browserParams, fetchResponse, fetchResult } from '../../utils/browser'

export class FetchError extends Error {
  code: number

  constructor(
    code: number,
    public message: string
  ) {
    super(message)
    this.code = code
  }
}

export class SlaxFetch {
  private static userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  private static acceptLang = 'zh-CN,zh;q=0.9'
  private static acceptEncoding = 'br, gzip'
  private static acceptContentType = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'

  constructor(private env: Env) {}

  async http(url: string, timezone: string, lang = 'zh'): Promise<fetchResult | Error> {
    try {
      const resp = (await fetch(url, {
        method: 'GET',
        headers: {
          // TODO 先写死中文，后续想办法获取到用户的UA lang再去实时传
          'Accept-Language': SlaxFetch.acceptLang,
          Accept: SlaxFetch.acceptContentType,
          'Accept-Encoding': SlaxFetch.acceptEncoding,
          'Cache-Control': 'no-cache',
          Referer: new URL(url).origin,
          DNT: '1'
        },
        cf: {
          resolveOverride: 'proxy-hk.slax.dev'
        }
      })) as Response
      if (!resp.ok) {
        return new FetchError(resp.status, `fetch ${url} failed, response is not ok: ${resp.status}, response: ${await resp.text()}`)
      }
      return { url: resp.url, content: await resp.text() }
    } catch (error) {
      return new FetchError(500, `http fetch ${url} failed, error: ${error}`)
    }
  }

  async headless(url: string, timezone: string, lang = 'zh'): Promise<fetchResult | Error> {
    try {
      const obj = this.env.SLAX_BROWSER
      const browser = obj.get(obj.idFromName('global'), {
        locationHint: 'apac'
      })

      const body: browserParams = {
        url,
        ublock: true,
        width: 1280,
        height: 1960,
        scale: 1,
        timezone,
        requestInterception: !url.includes('mp.weixin.qq.com')
      }
      const init: RequestInit = {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          Accept: SlaxFetch.acceptContentType,
          'User-Agent': SlaxFetch.userAgent,
          'Accept-Language': SlaxFetch.acceptLang,
          'Accept-Encoding': SlaxFetch.acceptEncoding
        }
      }

      const resp = await browser.fetch('http://view', init)

      if (!resp || !resp.ok) {
        const body = await resp.text()
        return new FetchError(resp.status, `fetch ${url} failed, response is not ok: ${body.slice(0, 100)}, status: ${resp.status}`)
      }

      return (await resp.json<fetchResponse>()).data
    } catch (error) {
      return new FetchError(500, `headless fetch ${url} failed, error: ${error}`)
    }
  }
}

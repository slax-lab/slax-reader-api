import puppeteer, { Browser, connect, HTTPRequest, HTTPResponse, Page } from '@cloudflare/puppeteer'
import { DurableObject } from 'cloudflare:workers'
import { RequestUtils } from './requestUtils'
import { Failed, Successed } from './responseUtils'

export interface fetchResult {
  content: string
  title?: string
  url: string
}

export interface fetchResponse {
  status: number
  message: string
  data: fetchResult
}

export interface browserParams {
  url: string
  ublock: boolean
  width: number
  height: number
  scale: number
  timezone: string
  requestInterception?: boolean
}

export class SlaxBrowser extends DurableObject {
  static readonly destroy_delay = 60 * 1000

  private bins: Fetcher
  private browser?: Browser
  private storage: DurableObjectStorage

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.bins = env.BROWSER
    this.storage = state.storage
  }

  private async resetDestroyAlarm() {
    const alarmTime = Date.now() + SlaxBrowser.destroy_delay
    await this.storage.setAlarm(alarmTime)
  }

  private async getBrowser() {
    if (!!this.browser) {
      await this.resetDestroyAlarm()
      return this.browser
    }

    const sessions = await puppeteer.sessions(this.bins)
    if (sessions.length > 0) {
      this.browser = await connect(this.bins, sessions[0].sessionId)
    } else {
      this.browser = await puppeteer.launch(this.bins, { keep_alive: 120000 })
    }
    if (!this.browser) {
      console.error(`Browser DO: get browser failed, sessions: ${JSON.stringify(sessions)}`)
    } else {
      await this.resetDestroyAlarm()
    }

    return this.browser
  }

  private getDelayPromise<T>(time: number, res: T) {
    return new Promise<T>(resolve =>
      setTimeout(() => {
        resolve(res)
      }, time)
    )
  }

  private async getBrowserTry(limitTimes?: number) {
    const date1 = new Date()

    const tasks: Promise<Browser | null>[] = [this.getBrowser()]

    if (limitTimes && limitTimes > 0) {
      tasks.push(this.getDelayPromise<null>(limitTimes, null))
    }

    const res = await Promise.race(tasks)

    const date2 = new Date()
    console.log('Browser DO: get browser cost time:', date2.getTime() - date1.getTime())

    return res
  }

  async pageSettings(page: Page, req: browserParams, header: Headers) {
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(15000)

    let pagePromise = [
      // 禁用CSP
      page.setBypassCSP(true),
      // 禁用缓存
      page.setCacheEnabled(true),
      // 启用JS
      page.setJavaScriptEnabled(true)
    ]

    // 拦截请求
    if (req.requestInterception && !!req.requestInterception) {
      pagePromise.push(page.setRequestInterception(true))
    }

    if (req.width && req.height) {
      pagePromise.push(page.setViewport({ width: req.width, height: req.height, deviceScaleFactor: req.scale }))
    }
    if (header.get('User-Agent')) {
      pagePromise.push(page.setUserAgent(header.get('User-Agent') || ''))
    }
    if (header.get('Accept')) {
      pagePromise.push(page.setExtraHTTPHeaders({ Accept: header.get('Accept') || '' }))
    }
    if (header.get('Accept-Language')) {
      pagePromise.push(page.setExtraHTTPHeaders({ 'Accept-Language': header.get('Accept-Language') || '' }))
    }
    if (header.get('Accept-Encoding')) {
      pagePromise.push(page.setExtraHTTPHeaders({ 'Accept-Encoding': header.get('Accept-Encoding') || '' }))
    }
    await Promise.allSettled(pagePromise)
  }

  async pageScroll(page: Page, limitTimes: number = 5000) {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    let totalTime = 0
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let totalHeight = 0
        const distance = 500
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight || totalTime > limitTimes) {
            clearInterval(timer)
            resolve()
          }

          totalTime += 100
        }, 100)
      })
    })

    await sleep(500)
  }

  async fetchFunction(request: Request): Promise<Response> {
    console.log(`Browser DO: Query Browser For Request: ${request.url}`)

    const page = await (await this.getBrowserTry(7000))?.newPage()
    if (!page || page instanceof Error) {
      console.error(`Browser DO: get page failed, err: ${page}`)
      return Failed(Error(`Browser DO: get page failed, err: ${page}`))
    }

    console.log(`Browser DO: get page success, start setting page`)

    const header = request.headers
    const req = await RequestUtils.json<browserParams>(request)

    // 设置页面参数
    await this.pageSettings(page, req, header)

    // 拦截请求
    page.on('request', (event: HTTPRequest) => {
      // 'Document' | 'Stylesheet' | 'Image'
      // 'Media' | 'Font' | 'Script'
      // 'TextTrack' | 'XHR' | 'Fetch'
      // 'EventSource' | 'WebSocket' | 'Manifest'
      // 'SignedExchange' | 'Ping' | 'CSPViolationReport'
      // 'Preflight' | 'Other'
      const resourceType = event.resourceType()
      if (['document', 'script'].includes(resourceType)) {
        event.continue()
      } else {
        event.abort()
      }
    })

    // 不需要等待完全加载，等待body加载完成即可
    let response: HTTPResponse | null = null
    try {
      console.log('Browser DO: fetching:', req.url)
      response = await page.goto(req.url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      })
    } catch (e) {
      const err = e as Error
      if (!err.name.includes('Timeout') && !err.message.includes('Timeout')) {
        console.log(`Browser DO: fetch failed, err: ${err.message}`)
        return Failed(err, 500)
      }
    }

    if (!response || !response.ok()) {
      console.log(`Browser DO: fetch failed, response: ${response?.status()}`)
      return Failed({ content: await response?.text() }, response?.status())
    }

    console.log('start scroll:', req.url)

    const date1 = new Date()

    try {
      const scrollTime = 5000
      await Promise.race([this.pageScroll(page, scrollTime), this.getDelayPromise<null>(scrollTime + 1000, null)])

      const limitTimes = 3000
      console.log('scroll done waiting for network idle:', req.url)
      await Promise.race([
        page.waitForNetworkIdle({
          timeout: limitTimes,
          idleTime: 500
        }),
        page.waitForFunction(() => document.readyState === 'complete', { timeout: limitTimes }),
        this.getDelayPromise<null>(limitTimes, null)
      ])
    } catch (e) {
      console.log('Additional load time exceeded or error:', e, req.url)
    }

    const date2 = new Date()
    console.log('totally scroll cost time:', date2.getTime() - date1.getTime())

    const [contentResult, titleResult, urlResult] = await Promise.allSettled([page.content(), page.title(), page.url()])

    const content = contentResult.status === 'fulfilled' ? contentResult.value : ''
    const title = titleResult.status === 'fulfilled' ? titleResult.value : ''
    const url = urlResult.status === 'fulfilled' ? urlResult.value : req.url

    console.log(`fetch ${req.url} done`)

    await page.close()

    return Successed({ content, title, url })
  }

  async fetch(request: Request): Promise<Response> {
    try {
      return await this.fetchFunction(request)
    } catch (e) {
      console.log(`Browser DO: fetch failed, err: ${e}`)
      return Failed(Error(`Browser DO: fetch failed, err: ${e}`))
    }
  }

  async alarm() {
    try {
      if (this.browser) {
        await this.browser.close()
        this.browser = undefined
      }
    } catch (error) {
      console.error('Error in alarm method:', error)
    }
  }
}

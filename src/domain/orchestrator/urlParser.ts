import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { BookmarkService } from '../bookmark'
import { callbackType, parseMessage, QueueClient, queueParseMessage, queueRetryParseMessage, queueThirdPartyMessage, receiveParseMessage } from '../../infra/queue/queueClient'
import { parserType } from '../../utils/urlPolicie'
import { fetchResult } from '../../utils/browser'
import { FetchError, SlaxFetch } from '../../infra/external/remoteFetcher'
import { queueStatus, bookmarkFetchRetryStatus } from '../../infra/repository/dbBookmark'
import { MultiLangError } from '../../utils/multiLangError'
import { ContentParser } from '../../utils/parser'
import { Imager } from '../../utils/imager'
import { BucketClient } from '../../infra/repository/bucketClient'
import { TelegramBotService } from '../telegram'
import type { LazyInstance } from '../../decorators/lazy'
import type { bookmarkParsePO } from '../../infra/repository/dbBookmark'
import { HtmlBuilder } from '../../utils/htmlBuilder'
import { parseHTML } from 'linkedom'
import { Apify } from '../../infra/external/apify'
import { AigcService } from '../aigc'
import { SearchService } from '../search'

export type PostHandler = (meta: { parseRes: { title: string; textContent: string } }) => Promise<void>
export type receiveQueueParseMessage = receiveParseMessage<queueParseMessage>
export type receiveRetryParseMesaage = receiveParseMessage<queueRetryParseMessage>
export type receiveThirdPartyMessage = receiveParseMessage<queueThirdPartyMessage>

@injectable()
export class UrlParserHandler {
  constructor(
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(BucketClient) private bucketClient: LazyInstance<BucketClient>,
    @inject(AigcService) private aigcService: AigcService,
    @inject(TelegramBotService) private telegramBotService: TelegramBotService,
    @inject(SearchService) private searchService: SearchService,
    @inject(QueueClient) private queueClient: LazyInstance<QueueClient>
  ) {}

  private static async fetchContent(env: Env, message: parseMessage): Promise<fetchResult | Error> {
    const startTime = Date.now()
    const fetcher = new SlaxFetch(env)
    try {
      switch (message.parserType) {
        case parserType.SERVER_PUPPETEER_PARSE:
          return await fetcher.headless(message.targetUrl, 'Asia/Hong_Kong')
        case parserType.SERVER_FETCH_PARSE:
          return await fetcher.http(message.targetUrl, 'Asia/Hong_Kong')
        case parserType.CLIENT_PARSE:
          return { content: message.resource, url: message.targetUrl, title: '' }
        default:
          return new Error('unknown parser type')
      }
    } catch (e) {
      return e instanceof Error ? e : new Error(`fetch failed`)
    } finally {
      console.log(`fetch ${message.targetUrl} done, cost: ${Date.now() - startTime}ms`)
    }
  }

  private async handleError(err: Error, bookmarkId: number, info: Partial<parseMessage>) {
    console.log(`fetch bm ${bookmarkId} failed: ${JSON.stringify(info)}: ${err.message}`)

    if (err instanceof FetchError) {
      await this.bookmarkService.updateBookmarkStatus(bookmarkId, queueStatus.RETRYING)
      return err
    }

    const bookmark = await this.bookmarkService.getBookmarkById(bookmarkId)
    if (!bookmark || bookmark instanceof MultiLangError || bookmark.status === queueStatus.SUCCESS) {
      console.log('no need to update bookmark status:', bookmark)
      return err
    }

    await this.bookmarkService.updateBookmarkStatus(bookmarkId, queueStatus.FAILED)
    return err
  }

  private async saveBookmark(
    messageId: string,
    bookmarkId: number,
    parseRes: { title: string; textContent: string; contentDocument: Document; excerpt?: string; byline?: string; siteName?: string; publishedTime?: Date }
  ) {
    const newBookmark: bookmarkParsePO = {
      title: parseRes.title,
      description: parseRes.excerpt,
      content_word_count: parseRes.textContent.length,
      content_key: `html/parse/${messageId}.${Date.now()}.html`,
      content_md_key: `text/parse/${messageId}.${Date.now()}.txt`,
      status: queueStatus.SUCCESS,
      byline: parseRes.byline ?? '',
      site_name: parseRes.siteName ?? '',
      published_at: parseRes.publishedTime ?? new Date()
    }

    await Promise.allSettled([
      this.bucketClient().putIfKeyExists(newBookmark.content_md_key, parseRes.textContent),
      this.bucketClient().putIfKeyExists(newBookmark.content_key, parseRes.contentDocument.documentElement.outerHTML),
      this.bookmarkService.updateBookmark(bookmarkId, newBookmark)
    ])

    return newBookmark
  }

  async parseUrl(ctx: ContextManager, messageId: string, message: parseMessage, postHandlers: PostHandler[]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { resource, ...taskInfo } = message
    const bookmarkId = taskInfo.bookmarkId

    try {
      if (message.parserType === parserType.SERVER_PUPPETEER_PARSE) {
        const res = await this.bookmarkService.getBookmarkTitleAndTextContentTry(bookmarkId)
        if (res) {
          await Promise.allSettled(postHandlers.map(handler => handler({ parseRes: { title: res.title, textContent: res.textContent } })))
          return
        }
      }
    } catch (err) {
      console.log(`parse ${messageId} with cache failed: ${err}`)
    }

    const fetchRes = await UrlParserHandler.fetchContent(ctx.env, message)
    if (fetchRes instanceof Error) return this.handleError(fetchRes, bookmarkId, taskInfo)

    const uUrl = new URL(fetchRes.url)
    const parseRes = await ContentParser.parse({ url: uUrl, content: fetchRes.content, title: fetchRes.title })
    if (parseRes instanceof Error) return this.handleError(parseRes, bookmarkId, taskInfo)

    let uploadRes = await new Imager(ctx.env).batchReplaceImage(uUrl, parseRes.contentDocument)
    if (uploadRes instanceof Error) return this.handleError(uploadRes, bookmarkId, taskInfo)

    try {
      await this.saveBookmark(messageId, bookmarkId, parseRes)
      await Promise.allSettled(postHandlers.map(handler => handler({ parseRes: { title: parseRes.title, textContent: parseRes.textContent } })))
    } catch (err) {
      console.log(`parse ${messageId} failed: ${err}`)
      return err
    }

    console.log(`parse ${message.targetUrl} done.`)
  }

  private async parseTweet(env: Env, message: receiveThirdPartyMessage, tweetInfo: TweetItem) {
    const content = HtmlBuilder.buildTweet(tweetInfo)
    const { document } = parseHTML(content)
    await new Imager(env).batchReplaceImage(new URL(tweetInfo.url), document)

    const parseRes = {
      title: `Tweet by ${tweetInfo.user.name} (${tweetInfo.id})`,
      textContent: tweetInfo.full_text,
      contentDocument: document,
      excerpt: tweetInfo.full_text.substring(0, 20),
      byline: tweetInfo.user.name,
      siteName: 'Twitter',
      publishedTime: new Date(tweetInfo.created_at)
    }

    try {
      await this.saveBookmark(message.id, message.info.bookmarkId, parseRes)
      if (message.info.callback === callbackType.CALLBACK_TELEGRAM) {
        await this.telegramBotService.callback(message.info.encodeBmId, message.info.callbackPayload)
      }
    } catch (err) {
      console.log(`parse tweet ${message.id} ${message.info.targetUrl} failed: ${err}`)
    }
  }

  async handleCallbackTask(ctx: ContextManager, info: { callback?: callbackType; bookmarkId: number; callbackPayload: any }): Promise<PostHandler> {
    return async () => {
      if (info.callback === callbackType.CALLBACK_TELEGRAM) {
        await this.telegramBotService.initTelegramBot(ctx.env)
        await this.telegramBotService.callback(ctx.hashIds.encodeId(info.bookmarkId), info.callbackPayload)
      }
    }
  }

  async handleTagTask(ctx: ContextManager, info: { bookmarkId: number; ignoreGenerateTag: boolean; userIds: number[] }): Promise<PostHandler> {
    return async meta => {
      if (info.ignoreGenerateTag || !info.userIds || info.userIds.length === 0) {
        return
      }

      const tags = await this.aigcService.generateTags(ctx, meta.parseRes.title || '', meta.parseRes.textContent)
      await Promise.all(info.userIds.map(userId => this.bookmarkService.tagBookmark(ctx, userId, info.bookmarkId, tags)))
    }
  }

  async handleSearchTask(ctx: ContextManager, info: { bookmarkId: number }): Promise<PostHandler> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return async ({ parseRes }) => {
      await this.searchService.addSearchRecordByBmId(ctx, info.bookmarkId)
    }
  }

  async processParseMessage(ctx: ContextManager, message: receiveQueueParseMessage) {
    const { id, info } = message
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { resource, ...logInfo } = info
    console.log(`processing message: ${id}, messageInfo: ${JSON.stringify(logInfo)}`)

    if (!info) return
    // 默认情况下是根据url police策略去决定
    // 如果targetUrl是twitter的，则特殊处理
    // 如果非prod环境、或者是客户端传递了完整内容，则直接解析
    const regexp = new RegExp('http[s]://(x|twitter).com/.*/status/[0-9]+')
    if (regexp.test(info.targetUrl)) {
      message.info.resource = ''
      const info = {
        ...message.info,
        encodeBmId: ctx.hashIds.encodeId(message.info.bookmarkId)
      } as queueThirdPartyMessage

      return await this.queueClient().pushParseThirdPartyMessage(ctx, info)
    } else if (ctx.env.RUN_ENV !== 'prod') {
      message.info.parserType = parserType.CLIENT_PARSE
    } else if (message.info.resource !== '') {
      message.info.parserType = parserType.CLIENT_PARSE
    }

    await this.processParseTask(ctx, message)
  }

  async processParseTask(ctx: ContextManager, taskInfo: receiveQueueParseMessage) {
    const { id, info } = taskInfo

    try {
      const callbacks: PostHandler[] = [
        await this.handleCallbackTask(ctx, {
          callback: info.callback || callbackType.NOT_CALLBACK,
          bookmarkId: info.bookmarkId,
          callbackPayload: info.callbackPayload
        }),
        await this.handleTagTask(ctx, { bookmarkId: info.bookmarkId, ignoreGenerateTag: info.ignoreGenerateTag, userIds: [info.userId] }),
        await this.handleSearchTask(ctx, { bookmarkId: info.bookmarkId })
      ]

      await this.parseUrl(ctx, id, info, callbacks)
    } catch (err) {
      if (err instanceof FetchError) {
        await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, [info.userId], {
          status: bookmarkFetchRetryStatus.PENDING,
          retryCount: err.code >= 400 && err.code < 500 ? 1 : 0
        })
      } else {
        await this.bookmarkService.checkAndFillPublicBookmarkData(ctx, info.bookmarkId, info.targetUrl)
      }
      console.error(`process message ${id} failed: ${err}`)
    }
  }

  async processRetryParseMessage(ctx: ContextManager, message: receiveRetryParseMesaage) {
    const { id, info } = message
    console.log(`processing retry message: ${id}, messageInfo: ${JSON.stringify(info)}`)

    const retryCount = info.retry.retryCount + 1
    try {
      await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, info.retry.userIds || [], {
        status: bookmarkFetchRetryStatus.PARSING,
        retryCount
      })

      const callbacks: PostHandler[] = [
        await this.handleCallbackTask(ctx, {
          callback: info.callback || callbackType.NOT_CALLBACK,
          bookmarkId: info.bookmarkId,
          callbackPayload: info.callbackPayload
        }),
        await this.handleTagTask(ctx, { bookmarkId: info.bookmarkId, ignoreGenerateTag: info.ignoreGenerateTag, userIds: info.retry.userIds || [] })
      ]

      await this.parseUrl(ctx, id, info, callbacks)
    } catch (err) {
      if (err instanceof FetchError) {
        await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, info.retry.userIds || [], {
          status: info.retry.retryCount >= 3 ? bookmarkFetchRetryStatus.FAILED : bookmarkFetchRetryStatus.PENDING
        })
      } else {
        await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, info.retry.userIds || [], {
          status: bookmarkFetchRetryStatus.FAILED
        })
      }
      console.error(`process message ${id} failed: ${err}`)
    }
  }

  async processThirdPartyMessages(ctx: ContextManager, messages: receiveThirdPartyMessage[]) {
    if (messages.length < 1) return

    const res = await Promise.allSettled(
      messages.map(async message => {
        try {
          const res = await this.bookmarkService.getBookmarkTitleAndTextContentTry(message.info.bookmarkId)
          if (!res) return message.info.targetUrl

          if (message.info.callback === callbackType.CALLBACK_TELEGRAM) {
            await this.telegramBotService.callback(message.info.encodeBmId, message.info.callbackPayload)
          }
        } catch (err) {
          console.log(`parse ${message.id} ${message.info.targetUrl} cache failed: ${err}`)
          return message.info.targetUrl
        }
        return null
      })
    )

    const urlList = res.map(item => (item.status === 'fulfilled' ? item.value : null)).filter(url => url !== null)
    if (urlList.length === 0) return

    const resp = await Apify.fetchApifyTwitterUrlScraper(ctx.env, urlList)
    if (resp instanceof MultiLangError) {
      console.error(`fetch three party failed: ${resp.message}`)
      return
    }

    const queuePromise = []
    for (const item of resp) {
      if (item.error) {
        console.error(`fetch url ${item.url} three party failed: ${item.error}`)
        continue
      }
      const target = messages.find(m => {
        const tUrl = m.info.targetUrl.split('/')
        const msgUrlId = tUrl[tUrl.length - 1]
        return msgUrlId === item.id
      })
      if (!target) {
        console.error(`fetch url ${item.url} three party failed: target not found`)
        continue
      }
      queuePromise.push(this.parseTweet(ctx.env, target, item))
    }

    if (queuePromise.length < 1) return

    try {
      await Promise.allSettled(queuePromise)
    } catch (err) {
      console.error(`process three party failed: ${err}`)
    }
  }
}

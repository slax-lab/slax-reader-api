import { inject, injectable } from '../../decorators/di'
import { ContextManager } from '../../utils/context'
import { BookmarkService } from '../bookmark'
import { callbackType, parseMessage, QueueClient, queueParseMessage, queueRetryParseMessage, queueThirdPartyMessage, receiveParseMessage } from '../../infra/queue/queueClient'
import { parserType } from '../../utils/urlPolicie'
import { fetchResult } from '../../utils/browser'
import { SlaxFetch } from '../../infra/external/remoteFetcher'
import { queueStatus, bookmarkFetchRetryStatus } from '../../infra/repository/dbBookmark'
import { ContentParser } from '../../utils/parser'
import { Imager } from '../../utils/imager'
import { BucketClient } from '../../infra/repository/bucketClient'
import { TelegramBotService } from '../telegram'
import type { LazyInstance } from '../../decorators/lazy'
import type { bookmarkParsePO } from '../../infra/repository/dbBookmark'
import { HtmlBuilder } from '../../utils/htmlBuilder'
import { parseHTML } from 'linkedom'
import { AigcService } from '../aigc'
import { SearchService } from '../search'
import { TweetInfo } from '../../const/struct'
import { TwitterApi } from '../../infra/external/twitterapi'
import { Hashid } from '../../utils/hashids'
import { TagService } from '../tag'

export type PostHandler = (meta: { parseRes: { title: string; textContent: string; byline?: string } }) => Promise<void>
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
    @inject(QueueClient) private queueClient: LazyInstance<QueueClient>,
    @inject(TagService) private tagService: TagService
  ) {}

  public static async fetchContent(env: Env, message: parseMessage): Promise<fetchResult> {
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
          throw new Error('unknown parser type')
      }
    } catch (e) {
      throw e
    } finally {
      console.log(`fetch ${message.targetUrl} done, cost: ${Date.now() - startTime}ms`)
    }
  }

  public async saveBookmark(
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

  public async parseUrl(ctx: ContextManager, messageId: string, message: parseMessage, postHandlers: PostHandler[]) {
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

    const uUrl = new URL(fetchRes.url)
    const parseRes = await ContentParser.parse({ url: uUrl, content: fetchRes.content, title: fetchRes.title })

    await new Imager(ctx.env).batchReplaceImage(uUrl, parseRes.contentDocument)

    try {
      await this.saveBookmark(messageId, bookmarkId, parseRes)
      await Promise.allSettled(postHandlers.map(handler => handler({ parseRes: { title: parseRes.title, textContent: parseRes.textContent, byline: parseRes.byline || '' } })))
    } catch (err) {
      console.log(`parse ${messageId} failed: ${err}`)
      throw err
    } finally {
      console.log(`parse ${message.targetUrl} done.`)
    }
  }

  public async parseTweet(env: Env, message: receiveThirdPartyMessage, tweetInfo: TweetInfo) {
    const content = HtmlBuilder.buildTweet(tweetInfo)
    const { document } = parseHTML(content)
    await new Imager(env).batchReplaceImage(new URL(tweetInfo.url), document)

    const parseRes = {
      title: `Tweet by ${tweetInfo.author.name} (${tweetInfo.id})`,
      textContent: tweetInfo.text,
      contentDocument: document,
      excerpt: tweetInfo.text.substring(0, 20),
      byline: tweetInfo.author.name,
      siteName: 'Twitter',
      publishedTime: new Date(tweetInfo.createdAt)
    }

    try {
      await this.saveBookmark(message.id, message.info.bookmarkId, parseRes)
      if (message.info.callback === callbackType.CALLBACK_TELEGRAM) {
        const hashids = new Hashid(env, message.info.userId)
        const encodeBmId = hashids.encodeId(message.info.bookmarkId)
        await this.telegramBotService.callback(encodeBmId, message.info.callbackPayload)
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
      // get user setting tags list
      const userTags = (await this.tagService.listUserTags(ctx)).map(item => item.name)
      const { overview, tags } = await this.aigcService.generateOverviewTags(ctx, meta.parseRes.title || '', meta.parseRes.textContent, meta.parseRes.byline || '', userTags)

      await Promise.all(info.userIds.map(userId => this.bookmarkService.createBookmarkOverview(userId, info.bookmarkId, overview)))

      const filteredTags = tags.filter(tag => userTags.includes(tag))

      await Promise.all(info.userIds.map(userId => this.bookmarkService.tagBookmark(ctx, userId, info.bookmarkId, filteredTags)))
    }
  }

  async handleSearchTask(ctx: ContextManager, info: { bookmarkId: number }): Promise<PostHandler> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return async ({ parseRes }) => {
      try {
        console.log(`add search record, bookmarkId: ${info.bookmarkId}`)
        await this.searchService.addSearchRecordByBmId(ctx, info.bookmarkId)
      } catch (e) {
        console.error(`add search record failed: ${e}`)
      }
    }
  }

  async processParseMessage(ctx: ContextManager, message: receiveQueueParseMessage): Promise<{ success: boolean; bookmarkId: number }> {
    const { id, info } = message
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { resource, ...logInfo } = info
    console.log(`processing message: ${id}, messageInfo: ${JSON.stringify(logInfo)}`)

    if (!info) return { success: false, bookmarkId: message.info.bookmarkId }

    message.info.parserType = parserType.SERVER_FETCH_PARSE

    const processFunc = async () => {
      const regexp = new RegExp('http[s]://(x|twitter).com/.*/status/[0-9]+')
      if (regexp.test(info.targetUrl)) {
        message.info.resource = ''
        const info = {
          ...message.info,
          encodeBmId: ctx.hashIds.encodeId(message.info.bookmarkId)
        } as queueThirdPartyMessage

        return await this.processThirdPartyMessages(ctx, [{ id, info }])
      } else if (message.info.resource !== '') {
        message.info.parserType = parserType.CLIENT_PARSE
      }

      await this.processParseTask(ctx, message)
    }

    try {
      await Promise.race([
        processFunc(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Parse timeout')), 120 * 1000)
        })
      ])
      return { success: true, bookmarkId: message.info.bookmarkId }
    } catch (err) {
      console.error(`processParseMessage ${id} failed: ${err}`)
      await this.bookmarkService.updateBookmarkStatus(info.bookmarkId, queueStatus.FAILED)
      return { success: false, bookmarkId: message.info.bookmarkId }
    }
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
      await this.bookmarkService.updateBookmarkStatus(info.bookmarkId, queueStatus.PENDING_RETRY)
      await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, [info.userId], {
        status: bookmarkFetchRetryStatus.PENDING,
        retryCount: 1
      })
      console.error(`process message ${id} failed: ${err}`)
    }
  }

  async processRetryParseMessage(ctx: ContextManager, message: receiveRetryParseMesaage) {
    const { id, info } = message
    console.log(`processing retry message: ${id}, messageInfo: ${JSON.stringify(info)}`)

    await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, info.retry.userIds || [], {
      status: bookmarkFetchRetryStatus.PARSING,
      retryCount: info.retry.retryCount + 1
    })

    const retryFunc = async () => {
      const callbacks: PostHandler[] = [
        await this.handleCallbackTask(ctx, {
          callback: info.callback || callbackType.NOT_CALLBACK,
          bookmarkId: info.bookmarkId,
          callbackPayload: info.callbackPayload
        }),
        await this.handleTagTask(ctx, { bookmarkId: info.bookmarkId, ignoreGenerateTag: info.ignoreGenerateTag, userIds: info.retry.userIds || [] })
      ]

      await this.parseUrl(ctx, id, info, callbacks)
    }

    try {
      await Promise.race([
        retryFunc(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Retry timeout')), 120 * 1000)
        })
      ])

      const bookmark = await this.bookmarkService.getBookmarkById(info.bookmarkId)
      if (bookmark && bookmark.status === queueStatus.SUCCESS) {
        await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, info.retry.userIds || [], {
          status: bookmarkFetchRetryStatus.SUCCESS
        })
      }
    } catch (err) {
      console.error(`process retry message ${id} failed: ${err}`)
      await this.bookmarkService.updateBookmarkStatus(info.bookmarkId, queueStatus.FAILED)
      await this.bookmarkService.updateBookmarkParseQueueRetry(info.bookmarkId, info.retry.userIds || [], {
        status: bookmarkFetchRetryStatus.FAILED
      })
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
            const hashids = new Hashid(ctx.env, message.info.userId)
            const encodeBmId = hashids.encodeId(message.info.bookmarkId)
            await this.telegramBotService.callback(encodeBmId, message.info.callbackPayload)
          }
        } catch (err) {
          console.log(`parse ${message.id} ${message.info.targetUrl} cache failed: ${err}`)
          return message.info.targetUrl
        }
        return null
      })
    )

    const regexp = /.*\/.*\/status\/([0-9]*)\??/

    const tweetIds = res
      .map(item => (item.status === 'fulfilled' ? item.value : null))
      .map(url => {
        const match = url?.match(regexp)
        return (match && match[1]) || ''
      })
      .filter(id => id !== '')

    if (tweetIds.length === 0) return

    let resp
    try {
      resp = await TwitterApi.fetchApifyTwitterUrlScraper(ctx.env, tweetIds)
    } catch (e) {
      console.error(`fetch three party failed: ${e}`)
    }

    const queuePromise = []
    for (const item of resp!) {
      const target = messages.find(m => {
        const match = m.info.targetUrl.match(regexp)
        return match && match[1] === item.id
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

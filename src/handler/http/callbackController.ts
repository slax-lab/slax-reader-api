import { ContextManager } from '../../utils/context'
import { TelegramBotService } from '../../domain/telegram'
import { Controller } from '../../decorators/controller'
import { All } from '../../decorators/route'
import { inject } from '../../decorators/di'
import { Context, webhookCallback } from 'grammy'
import { BookmarkService } from '../../domain/bookmark'
import { callbackType } from '../../infra/queue/queueClient'
import { Hashid } from '../../utils/hashids'
import { UrlParserHandler } from '../../domain/orchestrator/urlParser'

@Controller('/callback')
export class CallbackController {
  constructor(
    @inject(TelegramBotService) private telegramBotService: TelegramBotService,
    @inject(BookmarkService) private bookmarkService: BookmarkService,
    @inject(UrlParserHandler) private urlParserHandler: UrlParserHandler
  ) {}

  /**
   * 处理Telegram回调
   */
  @All('/telegram')
  public async handlerTelegramCallback(ctxManager: ContextManager, req: Request) {
    const tgSvc = this.telegramBotService
    const bot = await tgSvc.initTelegramBot(ctxManager.env)

    // 处理内容消息
    const handleMessageText = async (ctx: Context) => {
      // 判断内容是否为URL、是否绑定Telegram
      const res = await tgSvc.replyText(ctx)
      if (!res) return
      // 处理CTX并异步添加标签
      ctxManager.setHashIds(new Hashid(ctxManager.env, res.userId))
      const enUserId = ctxManager.hashIds.encodeId(res.userId)
      ctxManager.setUserInfo(res.userId, enUserId, '', '')
      const addRes = await this.bookmarkService.addUrlBookmark(ctxManager, { target_url: res.url, tags: [] }, callbackType.CALLBACK_TELEGRAM, {
        chat_id: res.chatId,
        origin_message_id: res.msgId
      })
      // 处理回执
      if (typeof addRes === 'number') {
        await tgSvc.sendProcessSuccess(ctx, addRes, { chat_id: res.chatId, origin_message_id: res.msgId })
      } else if (typeof addRes === 'object') {
        ctxManager.execution.waitUntil(this.urlParserHandler.processParseMessage(ctxManager, addRes))
      }
    }

    // 处理回调
    const handleCallbackQuery = async (ctx: Context) => {
      const action = ctx.callbackQuery?.data
      if (!action || !ctx.chatId || !ctx.msgId) return ctx.answerCallbackQuery()

      const parts = action.split('-')
      const command = parts[0]

      if (command === 'bookmark_list') {
        // callback data 格式: bookmark_list-{tagId}
        const tagId = parseInt(parts[1])
        await tgSvc.showPage(ctx, ctx.chatId, ctx.msgId, 1, 10, tagId)
      } else if (command === 'prev' || command === 'next') {
        // callback data 格式: prev-{tagId}-{page} 或 next-{tagId}-{page}
        const tagId = parseInt(parts[1])
        const page = parseInt(parts[2])
        await tgSvc.showPage(ctx, ctx.chatId, ctx.msgId, page, 10, tagId)
      }

      await ctx.answerCallbackQuery()
    }

    bot.use(tgSvc.checkFromId.bind(tgSvc))
    bot.command('start', tgSvc.commandStart.bind(tgSvc))
    bot.command('help', tgSvc.commandHelp.bind(tgSvc))
    bot.command('me', tgSvc.commandMe.bind(tgSvc))
    bot.command('list', tgSvc.commandList.bind(tgSvc))
    bot.command('topics', tgSvc.commandTopics.bind(tgSvc))
    bot.reaction('🔥', tgSvc.replyReaction.bind(tgSvc))
    bot.on('message_reaction', tgSvc.replyReaction.bind(tgSvc))
    bot.on('message:text', handleMessageText)
    bot.on('message', tgSvc.notSupportType.bind(tgSvc))
    bot.on('callback_query:data', handleCallbackQuery)
    ctxManager.execution.waitUntil(webhookCallback(bot, 'cloudflare-mod')(req))
    return new Response('ok')
  }
}

const templates = {
  commentToYouTitle: {
    zh: '💬 {user_name} 留下了评论',
    en: '💬 {user_name} commented on you'
  },
  replyToYouTitle: {
    zh: '📝 {user_name} 发表了看法',
    en: '📝 {user_name} express an opinion'
  },
  welcomeUser: {
    zh: '🎉 欢迎 {user_name} 加入 Slax Reader！',
    en: '🎉 Welcome {user_name} to join Slax Reader!'
  },
  hasNewCollectionSubscriber: {
    zh: '🎉 {user_name} 订阅了你的星标合集“{collection_name}”',
    en: '🎉 {user_name} is now following "{collection_name}"'
  },
  cancelCollectionSubscribe: {
    zh: '{user_name} 停止订阅你的星标合集“{collection_name}”了',
    en: '{user_name} is no longer following "{collection_name}"'
  },
  stripeAccountStatusChange: {
    zh: '你的 Stripe 账户状态发生了变化，请及时处理',
    en: 'There has been a change in your Stripe account status. Please take action promptly'
  },
  collectionHasNewContent: {
    zh: '📚 你订阅的“{collection_name}”有新内容了',
    en: '📚 New in "{collection_name}"'
  },
  collectionHasPriceChange: {
    zh: '💫 你订阅的星标合集“{collection_name}”降价了',
    en: '💫 Good news! "{collection_name}" is now available at ${new_price}'
  },
  collectionHasPriceChangeFree: {
    zh: '🎉 你订阅的星标合集“{collection_name}”免费了',
    en: '🎉 "{collection_name}" is now free! Enjoy unlimited access'
  },
  telegramStartGuide: {
    zh: '',
    en: '👋🏻 Hi! Welcome to the Slax Reader Telegram Bot. Send me a link, and I’ll save it for you to read later!'
  },
  telegramHelpGuide: {
    zh: '',
    en: '👋🏻 Hi! Welcome to the Slax Reader Telegram Bot. Send me a link, and I’ll save it for you to read later!'
  },
  telegramBindSuccess: {
    zh: '',
    en: '🎉 The account binding is successful, you can send the link to help you analyze it'
  },
  telegramBindGuide: {
    zh: '',
    en: '👋🏻 Hi~ You have not yet bound it. Please click <a href="{base_front_end_url}">the link</a> or bind it in your personal centre and then continue to use it.'
  },
  telegramNotSupportType: {
    zh: '',
    en: '🚫 Sorry, this type is not yet supported. We will add support for it as soon as possible.'
  },
  telegramNotTelegramId: {
    zh: '',
    en: '🚫 Not Telegram ID'
  },
  telegramBlockedUrl: {
    zh: '',
    en: '🚫 URL Blocked'
  },
  telegramBookmarkError: {
    zh: '',
    en: '🚫 Bookmark Error'
  },
  telegramUserInfo: {
    zh: '',
    en: '👤 User Info\nChatId: {chat_id}\nMsgId: {msg_id}\nUsername: {username}\nFirst Name: {first_name}\nLast Name: {last_name}\nLanguage Code: {language_code}\nPlatform Id: {platform_id}\nSlax Name: {slax_name}'
  },
  telegramCallbackSuccess: {
    zh: '',
    en: '🎉 Link saved successfully! Click {click} to view it, or use the /list command to see all your saved links.'
  },
  reportPushTemplate: {
    zh: `收到了一个{type}, [点击查看具体内容](https://reader.slax.com/report/{id}) \n> userName: {name} \n> country: {country} \n> content: {content}`,
    en: ''
  }
} as const

type ValueOf<T> = T[keyof T]

type ParseTemplate<T extends string> = T extends `${infer _}{${infer Param}}${infer Rest}` ? Param | ParseTemplate<Rest> : never

type TemplateParams<T> = T extends Record<string, infer S> ? (S extends string ? ParseTemplate<S> : never) : never

type TemplateName = keyof typeof templates
type ParamsOf<T extends TemplateName> = Record<TemplateParams<ValueOf<(typeof templates)[T]>>, string>

class I18nTemplate {
  constructor(private lang: 'zh' | 'en') {}

  get proxy(): { [K in TemplateName]: (params: ParamsOf<K>) => string } {
    return new Proxy({} as any, {
      get: (_, key: TemplateName) => (params: ParamsOf<typeof key>) => {
        const template = templates[key][this.lang]
        return template.replace(/\{(\w+)\}/g, (_, key) => params[key as keyof typeof params] || '')
      }
    })
  }
}

const t = (lang: 'zh' | 'en') => new I18nTemplate(lang).proxy

export const i18n = (lang: string) => {
  lang = lang.substring(0, 2)
  return t(lang as 'zh' | 'en')
}

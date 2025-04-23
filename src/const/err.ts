import { MultiLangError, Language } from '../utils/multiLangError'

export enum ErrorName {
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SERVER_ERROR = 'SERVER_ERROR',
  GOOGLE_SSO_ERROR = 'GOOGLE_SSO_ERROR',
  GOOGLE_SSO_RESP_ERROR = 'GOOGLE_SSO_RESP_ERROR',
  GOOGLE_SSO_AUD_ERROR = 'GOOGLE_SSO_AUD_ERROR',
  REGISTER_USER_ERROR = 'REGISTER_USER_ERROR',
  ERROR_PARAM = 'ERROR_PARAM',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  DELETE_BOOKMARK_FAIL = 'DELETE_BOOKMARK_FAIL',
  TRASH_BOOKMARK_FAIL = 'TRASH_BOOKMARK_FAIL',
  TRASH_REVERT_BOOKMARK_FAIL = 'TRASH_REVERT_BOOKMARK_FAIL',
  BOOKMARK_NOT_FOUND = 'BOOKMARK_NOT_FOUND',
  BOOKMARK_CONTENT_NOT_FOUND = 'BOOKMARK_CONTENT_NOT_FOUND',
  BLOCK_TARGET_URL = 'BLOCK_TARGET_URL',
  CREATE_BOOKMARK_FAIL = 'CREATE_BOOKMARK_FAIL',
  USER_ID_WRONG = 'USER_ID_WRONG',
  DECODE_ID_ERROR = 'DECODE_ID_ERROR',
  FAIL_TO_SUMMARY = 'FAIL_TO_SUMMARY',
  SAVE_REPORT_ERROR = 'SAVE_REPORT_ERROR',
  UNKNOWN_BIND_USER_ERROR = 'UNKNOWN_BIND_USER_ERROR',
  EXISTS_USER_NAME_ERROR = 'EXISTS_USER_NAME_ERROR',
  NEED_CREATE_ACCOUNT_NAME = 'NEED_CREATE_ACCOUNT_USERNAME',
  REUQEST_APPLE_AUTH_FAIL = 'REUQEST_APPLE_AUTH_FAIL',
  UNVERIFIED_EMAIL = 'UNVERIFIED_EMAIL',
  FETCH_THREE_PRATRY_ERROR = 'FETCH_THREE_PRATRY_ERROR',
  STRIPE_SIGN_CHECK_FAIL = 'STRIPE_SIGN_CHECK_FAIL',
  SAVE_STRIPE_EVENT_FAIL = 'SAVE_STRIPE_EVENT_FAIL',
  UNKNOWN_STRIPE_PRICE_ID = 'UNKNOWN_STRIPE_PRICE_ID',
  SUBSCRIPTION_NOT_EXPIRED = 'SUBSCRIPTION_NOT_EXPIRED',
  INTERNET_SEARCH_FAIL = 'INTERNET_SEARCH_FAIL',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',
  AI_ERROR = 'AI_ERROR',
  NOT_SUBSCRIPTION = 'NOT_SUBSCRIPTION',
  AI_CONTENT_HARMFUL = 'AI_CONTENT_HARMFUL',
  CREATE_BOOKMARK_SHARE_UNIQUE_FAIL = 'CREATE_BOOKMARK_SHARE_UNIQUE_FAIL',
  SHARE_DISABLED = 'SHARE_DISABLED',
  SHARE_CODE_NOT_FOUND = 'SHARE_CODE_NOT_FOUND',
  SHARE_ACTION_NOT_ALLOWED = 'SHARE_ACTION_NOT_ALLOWED',
  ERROR_MARK_TYPE = 'ERROR_MARK_TYPE',
  MARK_LINE_TOO_LONG = 'MARK_LINE_TOO_LONG',
  ERROR_MARK_COMMENT_TYPE = 'ERROR_MARK_COMMENT_TYPE',
  READABILITY_PARSE_ERROR = 'READABILITY_PARSE_ERROR',
  COMMENT_TOO_LONG = 'COMMENT_TOO_LONG',
  IMPORT_TASK_EXISTS = 'IMPORT_TASK_EXISTS',
  SUMMARY_UPDATE_REACH_LIMITED = 'SUMMARY_UPDATE_REACH_LIMITED',
  VECTORIZE_FAILED = 'VECTORIZE_FAILED',
  EMAIL_VERIFY_CODE_EXISTS = 'EMAIL_VERIFY_CODE_EXISTS',
  EMAIL_DAILY_LIMIT = 'EMAIL_DAILY_LIMIT',
  EMAIL_VERIFY_CODE_ERROR = 'EMAIL_VERIFY_CODE_ERROR',
  EMAIL_VERIFY_CODE_RATE_LIMIT = 'EMAIL_VERIFY_CODE_RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NOT_ALLOWED_EMAIL = 'NOT_ALLOWED_EMAIL',
  ERROR_CONNECTION_PARAM = 'ERROR_CONNECTION_PARAM',
  SHARE_COLLECTION_NOT_FOUND = 'SHARE_COLLECTION_NOT_FOUND',
  SHARE_COLLECTION_NOT_SUPPORT_PRICE_CHANGE = 'SHARE_COLLECTION_NOT_SUPPORT_PRICE_CHANGE',
  SHARE_COLLECTION_ALREADY_SUBSCRIBED = 'SHARE_COLLECTION_ALREADY_SUBSCRIBED',
  SHARE_COLLECTION_NOT_SUBSCRIBED = 'SHARE_COLLECTION_NOT_SUBSCRIBED',
  SHARE_COLLECTION_EXPIRED = 'SHARE_COLLECTION_EXPIRED',
  SHARE_COLLECTION_UPDATE_PRICE_FAIL = 'SHARE_COLLECTION_UPDATE_PRICE_FAIL',
  SHARE_COLLECTION_NOT_ALLOWED = 'SHARE_COLLECTION_NOT_ALLOWED',
  STRIPE_CANCEL_SUBSCRIPTION_ERROR = 'STRIPE_CANCEL_SUBSCRIPTION_ERROR',
  RECOVER_SUBSCRIBE_ERROR = 'RECOVER_SUBSCRIBE_ERROR',
  SHARE_COLLECTION_CANT_UPDATE_FREE = 'SHARE_COLLECTION_CANT_UPDATE_FREE',
  NOT_HAVE_STRIPE_ACCOUNT_ERROR = 'NOT_HAVE_STRIPE_ACCOUNT_ERROR',
  BOOKMARK_CHANGES_SYNC_TOO_OLD = 'BOOKMARK_CHANGES_SYNC_TOO_OLD'
}

const translations: { [key in Language]: Partial<Record<ErrorName, string>> } = {
  zh: {
    [ErrorName.NOT_FOUND]: '资源未找到',
    [ErrorName.UNAUTHORIZED]: '未授权访问',
    [ErrorName.SERVER_ERROR]: '服务器内部错误',
    [ErrorName.GOOGLE_SSO_ERROR]: 'Google SSO错误',
    [ErrorName.GOOGLE_SSO_RESP_ERROR]: 'Google SSO响应错误',
    [ErrorName.GOOGLE_SSO_AUD_ERROR]: '无效的Google SSO受众',
    [ErrorName.REGISTER_USER_ERROR]: '注册用户失败',
    [ErrorName.ERROR_PARAM]: '无效参数',
    [ErrorName.USER_NOT_FOUND]: '用户未找到',
    [ErrorName.DELETE_BOOKMARK_FAIL]: '删除书签失败',
    [ErrorName.TRASH_BOOKMARK_FAIL]: '移入垃圾篓失败',
    [ErrorName.TRASH_REVERT_BOOKMARK_FAIL]: '移出垃圾篓失败',
    [ErrorName.BOOKMARK_NOT_FOUND]: '书签未找到',
    [ErrorName.BLOCK_TARGET_URL]: '目标网址被阻止',
    [ErrorName.CREATE_BOOKMARK_FAIL]: '创建书签失败',
    [ErrorName.USER_ID_WRONG]: '用户id错误',
    [ErrorName.DECODE_ID_ERROR]: '解码id错误',
    [ErrorName.FAIL_TO_SUMMARY]: '生成摘要失败',
    [ErrorName.EXISTS_USER_NAME_ERROR]: '用户名已存在',
    [ErrorName.SUMMARY_UPDATE_REACH_LIMITED]: '总结刷新次数达到限制',
    [ErrorName.VECTORIZE_FAILED]: '转换向量失败',
    [ErrorName.EMAIL_DAILY_LIMIT]: '今日发送邮件次数达到限制, 请明天再试吧',
    [ErrorName.EMAIL_VERIFY_CODE_EXISTS]: '重复发送验证码, 请30秒后重试',
    [ErrorName.EMAIL_VERIFY_CODE_ERROR]: '验证码错误',
    [ErrorName.EMAIL_VERIFY_CODE_RATE_LIMIT]: '验证码错误次数过多, 请稍后再试',
    [ErrorName.QUOTA_EXCEEDED]: '配额已满',
    [ErrorName.SHARE_COLLECTION_NOT_FOUND]: '分享的collection未找到',
    [ErrorName.ERROR_CONNECTION_PARAM]: '错误的连接参数',
    [ErrorName.NOT_ALLOWED_EMAIL]: '非白名单邮箱，请检查',
    [ErrorName.SHARE_COLLECTION_ALREADY_SUBSCRIBED]: '已订阅',
    [ErrorName.SHARE_COLLECTION_NOT_SUBSCRIBED]: '未订阅',
    [ErrorName.SHARE_COLLECTION_EXPIRED]: '订阅的Collection已过期，请检查',
    [ErrorName.SHARE_COLLECTION_UPDATE_PRICE_FAIL]: '更新分享的collection价格失败',
    [ErrorName.SHARE_COLLECTION_NOT_ALLOWED]: '分享的collection不允许评论',
    [ErrorName.STRIPE_CANCEL_SUBSCRIPTION_ERROR]: '取消订阅失败',
    [ErrorName.RECOVER_SUBSCRIBE_ERROR]: '重新订阅功能正在开发中，敬请期待',
    [ErrorName.SHARE_COLLECTION_CANT_UPDATE_FREE]: '分享的collection不能免费转付费',
    [ErrorName.NOT_HAVE_STRIPE_ACCOUNT_ERROR]: '没有stripe账户',
    [ErrorName.BOOKMARK_CHANGES_SYNC_TOO_OLD]: '书签更改同步过旧'
  },
  en: {
    [ErrorName.NOT_FOUND]: 'Resource not found',
    [ErrorName.UNAUTHORIZED]: 'Unauthorized access',
    [ErrorName.SERVER_ERROR]: 'Internal server error',
    [ErrorName.GOOGLE_SSO_ERROR]: 'Google SSO error',
    [ErrorName.GOOGLE_SSO_RESP_ERROR]: 'Google SSO response error',
    [ErrorName.GOOGLE_SSO_AUD_ERROR]: 'Invalid Google SSO audience',
    [ErrorName.REGISTER_USER_ERROR]: 'Register user failed',
    [ErrorName.ERROR_PARAM]: 'Invalid parameter',
    [ErrorName.USER_NOT_FOUND]: 'User not found',
    [ErrorName.DELETE_BOOKMARK_FAIL]: 'Delete bookmark failed',
    [ErrorName.TRASH_BOOKMARK_FAIL]: 'Trash bookmark failed',
    [ErrorName.TRASH_REVERT_BOOKMARK_FAIL]: 'Revert bookmark failed',
    [ErrorName.BOOKMARK_NOT_FOUND]: 'Bookmark not found',
    [ErrorName.BLOCK_TARGET_URL]: 'Blocked target url',
    [ErrorName.CREATE_BOOKMARK_FAIL]: 'Create bookmark failed',
    [ErrorName.USER_ID_WRONG]: 'User id wrong',
    [ErrorName.DECODE_ID_ERROR]: 'Decode id error',
    [ErrorName.FAIL_TO_SUMMARY]: 'Failed to summary',
    [ErrorName.SAVE_REPORT_ERROR]: 'Save report error',
    [ErrorName.UNKNOWN_BIND_USER_ERROR]: 'Unknown bind user error',
    [ErrorName.EXISTS_USER_NAME_ERROR]: 'User name exists',
    [ErrorName.NEED_CREATE_ACCOUNT_NAME]: 'Need create account username',
    [ErrorName.SUBSCRIPTION_NOT_EXPIRED]: 'You have a subscription not expired',
    [ErrorName.INTERNET_SEARCH_FAIL]: 'Internet search fail',
    [ErrorName.AI_RATE_LIMIT]: 'AI rate limit',
    [ErrorName.AI_ERROR]: `The AI provider has made a mistake. Don't worry, it's switching to the backup provider. \n`,
    [ErrorName.NOT_SUBSCRIPTION]: 'Not subscription',
    [ErrorName.AI_CONTENT_HARMFUL]: `Apologies, your message can't be processed due to potentially harmful content in the chat history or article. `,
    [ErrorName.CREATE_BOOKMARK_SHARE_UNIQUE_FAIL]: 'Create bookmark share unique fail',
    [ErrorName.SHARE_DISABLED]: 'Share disabled',
    [ErrorName.SHARE_CODE_NOT_FOUND]: 'Share code not found',
    [ErrorName.SHARE_ACTION_NOT_ALLOWED]: 'Share action not allowed',
    [ErrorName.ERROR_MARK_TYPE]: 'Error mark type',
    [ErrorName.MARK_LINE_TOO_LONG]: 'Mark line too long',
    [ErrorName.ERROR_MARK_COMMENT_TYPE]: 'Error mark comment type',
    [ErrorName.READABILITY_PARSE_ERROR]: 'Readability parse error',
    [ErrorName.COMMENT_TOO_LONG]: 'Comment too long',
    [ErrorName.IMPORT_TASK_EXISTS]: 'Import task exists, please wait for the task to complete',
    [ErrorName.SUMMARY_UPDATE_REACH_LIMITED]: 'Summary refresh counts reach limited',
    [ErrorName.VECTORIZE_FAILED]: 'Vectorize failed',
    [ErrorName.EMAIL_DAILY_LIMIT]: 'Today email send counts reach limited, please try again tomorrow',
    [ErrorName.EMAIL_VERIFY_CODE_EXISTS]: 'Repeat send verify code, please try again after 30 seconds',
    [ErrorName.EMAIL_VERIFY_CODE_ERROR]: 'Verify code error',
    [ErrorName.EMAIL_VERIFY_CODE_RATE_LIMIT]: 'Verify code error counts too much, please try again later',
    [ErrorName.QUOTA_EXCEEDED]: 'Quota exceeded',
    [ErrorName.ERROR_CONNECTION_PARAM]: 'Error connection param',
    [ErrorName.NOT_ALLOWED_EMAIL]: 'Not allowed email, please check',
    [ErrorName.SHARE_COLLECTION_NOT_FOUND]: 'Share collection not found',
    [ErrorName.SHARE_COLLECTION_NOT_SUPPORT_PRICE_CHANGE]: 'Share collection not support free change to paid or paid change to free',
    [ErrorName.SHARE_COLLECTION_ALREADY_SUBSCRIBED]: 'Already subscribed',
    [ErrorName.SHARE_COLLECTION_NOT_SUBSCRIBED]: 'Not subscribed',
    [ErrorName.SHARE_COLLECTION_EXPIRED]: 'Subscription expired, please check',
    [ErrorName.SHARE_COLLECTION_UPDATE_PRICE_FAIL]: 'Update share collection price failed',
    [ErrorName.SHARE_COLLECTION_NOT_ALLOWED]: 'Share collection not allowed',
    [ErrorName.STRIPE_CANCEL_SUBSCRIPTION_ERROR]: 'Cancel subscription failed',
    [ErrorName.RECOVER_SUBSCRIBE_ERROR]: "We're working on resubscribe feature.",
    [ErrorName.SHARE_COLLECTION_CANT_UPDATE_FREE]: 'Share collection cant update to free',
    [ErrorName.NOT_HAVE_STRIPE_ACCOUNT_ERROR]: 'No stripe account',
    [ErrorName.BOOKMARK_CHANGES_SYNC_TOO_OLD]: 'Bookmark changes sync too old'
  },
  es: {
    [ErrorName.NOT_FOUND]: 'Recurso no encontrado',
    [ErrorName.UNAUTHORIZED]: 'Acceso no autorizado',
    [ErrorName.SERVER_ERROR]: 'Error interno del servidor',
    [ErrorName.GOOGLE_SSO_ERROR]: 'Error de Google SSO'
  }
}

const loadErrorMessages = (name: ErrorName): { [lang in Language]?: string } => {
  const messages: { [lang in Language]?: string } = {}
  for (const lang in translations) {
    if (translations.hasOwnProperty(lang)) {
      const translation = translations[lang as Language]
      if (translation && translation[name]) {
        messages[lang as Language] = translation[name]
      }
    }
  }
  return messages
}

export const NewError = (name: ErrorName, code: number): MultiLangError => {
  const messages = loadErrorMessages(name)
  return new MultiLangError(name, code, messages)
}

export const NotFoundError = (): MultiLangError => NewError(ErrorName.NOT_FOUND, 404)
export const UnauthorizedError = (): MultiLangError => NewError(ErrorName.UNAUTHORIZED, 401)
export const ServerError = (): MultiLangError => NewError(ErrorName.SERVER_ERROR, 500)
export const GoogleSSOError = (): MultiLangError => NewError(ErrorName.GOOGLE_SSO_ERROR, 500)
export const GoogleSSORespError = (): MultiLangError => NewError(ErrorName.GOOGLE_SSO_RESP_ERROR, 500)
export const GoogleSSOAudError = (): MultiLangError => NewError(ErrorName.GOOGLE_SSO_AUD_ERROR, 500)
export const RegisterUserError = (): MultiLangError => NewError(ErrorName.REGISTER_USER_ERROR, 500)
export const ErrorParam = (): MultiLangError => NewError(ErrorName.ERROR_PARAM, 400)
export const UserNotFoundError = (): MultiLangError => NewError(ErrorName.USER_NOT_FOUND, 404)
export const DeleteBookmarkFailError = (): MultiLangError => NewError(ErrorName.DELETE_BOOKMARK_FAIL, 400)
export const TrashBookmarkFailError = (): MultiLangError => NewError(ErrorName.TRASH_BOOKMARK_FAIL, 400)
export const TrashRevertBookmarkFailError = (): MultiLangError => NewError(ErrorName.TRASH_REVERT_BOOKMARK_FAIL, 400)
export const BookmarkNotFoundError = (): MultiLangError => NewError(ErrorName.BOOKMARK_NOT_FOUND, 404)
export const BookmarkContentNotFoundError = (): MultiLangError => NewError(ErrorName.BOOKMARK_CONTENT_NOT_FOUND, 404)
export const BlockTargetUrlError = (): MultiLangError => NewError(ErrorName.BLOCK_TARGET_URL, 400)
export const CreateBookmarkFailError = (): MultiLangError => NewError(ErrorName.CREATE_BOOKMARK_FAIL, 500)
export const UserIdWrongError = (): MultiLangError => NewError(ErrorName.USER_ID_WRONG, 500)
export const DecodeIdError = (): MultiLangError => NewError(ErrorName.DECODE_ID_ERROR, 500)
export const FailToSummaryError = (): MultiLangError => NewError(ErrorName.FAIL_TO_SUMMARY, 500)
export const SaveReportError = (): MultiLangError => NewError(ErrorName.SAVE_REPORT_ERROR, 500)
export const UnknownBindUserError = (): MultiLangError => NewError(ErrorName.UNKNOWN_BIND_USER_ERROR, 400)
export const ExistsUserNameError = (): MultiLangError => NewError(ErrorName.EXISTS_USER_NAME_ERROR, 400)
export const NeedCreateUsernameError = (): MultiLangError => NewError(ErrorName.NEED_CREATE_ACCOUNT_NAME, 400)
export const RequestAppleAuthFail = (): MultiLangError => NewError(ErrorName.REUQEST_APPLE_AUTH_FAIL, 500)
export const UnverifiedEmailError = (): MultiLangError => NewError(ErrorName.UNVERIFIED_EMAIL, 400)
export const FetchThreePartyError = (): MultiLangError => NewError(ErrorName.FETCH_THREE_PRATRY_ERROR, 500)
export const StripeSignCheckFail = (): MultiLangError => NewError(ErrorName.STRIPE_SIGN_CHECK_FAIL, 400)
export const SaveStripeEventFail = (): MultiLangError => NewError(ErrorName.SAVE_STRIPE_EVENT_FAIL, 500)
export const UnknownStripePriceId = (): MultiLangError => NewError(ErrorName.UNKNOWN_STRIPE_PRICE_ID, 400)
export const SubscriptionNotExpired = (): MultiLangError => NewError(ErrorName.SUBSCRIPTION_NOT_EXPIRED, 400)
export const InternetSearchFail = (): MultiLangError => NewError(ErrorName.INTERNET_SEARCH_FAIL, 500)
export const AIRateLimitError = (): MultiLangError => NewError(ErrorName.AI_RATE_LIMIT, 429)
export const AIError = (): MultiLangError => NewError(ErrorName.AI_ERROR, 500)
export const NotSubscriptionError = (): MultiLangError => NewError(ErrorName.NOT_SUBSCRIPTION, 403)
export const AIContentHarmful = (): MultiLangError => NewError(ErrorName.AI_CONTENT_HARMFUL, 400)
export const CreateBookmarkShareUniqueFail = (): MultiLangError => NewError(ErrorName.CREATE_BOOKMARK_SHARE_UNIQUE_FAIL, 400)
export const ShareDisabledError = (): MultiLangError => NewError(ErrorName.SHARE_DISABLED, 400)
export const ShareCodeNotFoundError = (): MultiLangError => NewError(ErrorName.SHARE_CODE_NOT_FOUND, 400)
export const ShareActionNotAllowedError = (): MultiLangError => NewError(ErrorName.SHARE_ACTION_NOT_ALLOWED, 400)
export const ErrorMarkTypeError = (): MultiLangError => NewError(ErrorName.ERROR_MARK_TYPE, 400)
export const MarkLineTooLongError = (): MultiLangError => NewError(ErrorName.MARK_LINE_TOO_LONG, 400)
export const ErrorMarkCommentTypeError = (): MultiLangError => NewError(ErrorName.ERROR_MARK_COMMENT_TYPE, 400)
export const ReadabilityParseError = (): MultiLangError => NewError(ErrorName.READABILITY_PARSE_ERROR, 500)
export const CommentTooLongError = (): MultiLangError => NewError(ErrorName.COMMENT_TOO_LONG, 400)
export const ImportTaskExistsError = (): MultiLangError => NewError(ErrorName.IMPORT_TASK_EXISTS, 400)
export const SummaryUpdateReachLimitError = (): MultiLangError => NewError(ErrorName.SUMMARY_UPDATE_REACH_LIMITED, 400)
export const VectorizeFailedError = (): MultiLangError => NewError(ErrorName.VECTORIZE_FAILED, 500)
export const EmailDailyLimitError = (): MultiLangError => NewError(ErrorName.EMAIL_DAILY_LIMIT, 400)
export const EmailVerifyCodeExistsError = (): MultiLangError => NewError(ErrorName.EMAIL_VERIFY_CODE_EXISTS, 400)
export const EmailVerifyCodeError = (): MultiLangError => NewError(ErrorName.EMAIL_VERIFY_CODE_ERROR, 400)
export const EmailVerifyCodeRateLimitError = (): MultiLangError => NewError(ErrorName.EMAIL_VERIFY_CODE_RATE_LIMIT, 400)
export const QuotaExceededError = (): MultiLangError => NewError(ErrorName.QUOTA_EXCEEDED, 418)
export const ErrorConnectionParam = (): MultiLangError => NewError(ErrorName.ERROR_CONNECTION_PARAM, 400)
export const ShareCollectionNotFoundError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_NOT_FOUND, 404)
export const ShareCollectionNotSupportPriceChangeError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_NOT_SUPPORT_PRICE_CHANGE, 400)
export const ShareCollectionAlreadySubscribedError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_ALREADY_SUBSCRIBED, 400)
export const ShareCollectionNotSubscribedError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_NOT_SUBSCRIBED, 400)
export const ShareCollectionExpiredError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_EXPIRED, 400)
export const ShareCollectionUpdatePriceFailError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_UPDATE_PRICE_FAIL, 400)
export const ShareCollectionNotAllowedError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_NOT_ALLOWED, 400)
export const NotAllowedEmailError = (): MultiLangError => NewError(ErrorName.NOT_ALLOWED_EMAIL, 400)
export const StripeCancelSubscriptionError = (): MultiLangError => NewError(ErrorName.STRIPE_CANCEL_SUBSCRIPTION_ERROR, 400)
export const RecoverSubscribeError = (): MultiLangError => NewError(ErrorName.RECOVER_SUBSCRIBE_ERROR, 400)
export const ShareCollectionCantUpdateFreeError = (): MultiLangError => NewError(ErrorName.SHARE_COLLECTION_CANT_UPDATE_FREE, 400)
export const NotHaveStripeAccountError = (): MultiLangError => NewError(ErrorName.NOT_HAVE_STRIPE_ACCOUNT_ERROR, 400)
export const BookmarkChangesSyncTooOldError = (): MultiLangError => NewError(ErrorName.BOOKMARK_CHANGES_SYNC_TOO_OLD, 501)

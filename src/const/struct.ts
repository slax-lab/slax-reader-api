interface User {
  created_at: string // 用户创建账户的日期和时间
  default_profile_image: boolean // 是否使用默认的个人资料图片
  description: string // 用户个人简介
  fast_followers_count: number // 快速跟随者的数量（可能特定于某种功能）
  favourites_count: number // 用户点赞的推文总数
  followers_count: number // 关注用户的人数
  friends_count: number // 用户关注的人数
  has_custom_timelines: boolean // 是否启用了自定义时间线
  is_translator: boolean // 用户是否是翻译者
  listed_count: number // 用户被列入的列表数
  location: string // 用户的位置信息
  media_count: number // 用户发布的媒体数量
  name: string // 用户的显示名称
  normal_followers_count: number // 普通关注者的数量
  possibly_sensitive: boolean // 用户账户是否可能包含敏感内容
  profile_banner_url: string // 用户的个人资料横幅图片URL
  profile_image_url_https: string // 用户的个人资料图片URL
  screen_name: string // 用户的用户名（@username）
  statuses_count: number // 用户发布的推文数量
  translator_type: string // 翻译者类型（如果适用）
  url: string // 用户个人资料中的URL
  verified: boolean // 用户是否经过验证
  withheld_in_countries: string[] // 被限制的国家列表
  id_str: string // 用户的ID（字符串格式）
}

interface Url {
  url: string // 短URL
  expanded_url: string // 展开后的完整URL
  display_url: string // 显示的URL（可能经过缩短）
}

interface Media {
  media_url: string // 媒体文件的URL
  video_url?: string // （可选）视频文件的URL
  type: string // 媒体类型（例如 "photo", "video"）
}

interface UserMention {
  id_str: string // 被提及用户的ID（字符串格式）
  name: string // 被提及用户的显示名称
  screen_name: string // 被提及用户的用户名
  profile?: string // （可选）被提及用户的个人资料链接
}

interface TweetItem {
  user: User // 发推文的用户信息
  id: string // 推文的ID
  conversation_id: string // 推文所属会话的ID
  full_text: string // 推文的完整文本
  reply_count: number // 回复的数量
  retweet_count: number // 转推的数量
  favorite_count: number // 点赞的数量
  hashtags: string[] // 推文中的话题标签
  symbols: string[] // 推文中的金融符号
  user_mentions: UserMention[] // 推文中提及的用户列表
  urls: Url[] // 推文中的URL列表
  media: Media[] // 推文中包含的媒体列表
  url: string // 推文的URL
  created_at: string // 推文发布的日期和时间
  '#sort_index': string // 推文的排序索引
  view_count: number // 推文的查看次数
  quote_count: number // 推文的引用次数
  is_quote_tweet: boolean // 是否是引用推文
  is_retweet: boolean // 是否是转推
  is_pinned: boolean // 是否被置顶
  is_truncated: boolean // 推文内容是否被截断
  startUrl: string // 推文的起始URL
  error?: string // （可选）如果有错误，记录错误信息
  replying_to_tweet?: string // （可选）回复的推文的URL
}
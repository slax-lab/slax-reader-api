interface TwitterAPIResponse {
  tweets: TweetInfo[]
  status: string
  msg: string
  code: number
}

interface TweetInfo {
  type: string
  id: string
  url: string
  twitterUrl: string
  text: string
  source: string
  retweetCount: number
  replyCount: number
  likeCount: number
  quoteCount: number
  viewCount: number
  createdAt: string
  lang: string
  bookmarkCount: number
  isReply: boolean
  inReplyToId: string
  conversationId: string
  inReplyToUserId: string
  inReplyToUsername: string
  isPinned: boolean
  author: Author
  extendedEntities: ExtendedEntities
  card: Record<string, any>
  place: Record<string, any>
  entities: TweetEntities
  isRetweet: boolean
  isQuote: boolean
  isConversationControlled: boolean
  quoted_tweet: TweetInfo | null
  retweeted_tweet: TweetInfo | null
}

interface Author {
  type: string
  userName: string
  url: string
  twitterUrl: string
  id: string
  name: string
  isVerified: boolean
  isBlueVerified: boolean
  profilePicture: string
  coverPicture: string
  description: string
  location: string
  followers: number
  following: number
  status: string
  canDm: boolean
  canMediaTag: boolean
  createdAt: string
  entities: AuthorEntities
  fastFollowersCount: number
  favouritesCount: number
  hasCustomTimelines: boolean
  isTranslator: boolean
  mediaCount: number
  statusesCount: number
  withheldInCountries: any[]
  affiliatesHighlightedLabel: Record<string, any>
  possiblySensitive: boolean
  pinnedTweetIds: string[]
  profile_bio: ProfileBio
  isAutomated: boolean
  automatedBy: any
}

interface AuthorEntities {
  description: {
    urls: UrlEntity[]
    user_mentions: UserMention[]
  }
}

interface ProfileBio {
  description: string
  entities: {
    description: {
      urls: UrlEntity[]
      user_mentions: UserMention[]
    }
  }
  withheld_in_countries: any[]
}

interface UrlEntity {
  display_url: string
  expanded_url: string
  indices: number[]
  url: string
}

interface UserMention {
  id_str: string
  indices: number[]
  name: string
  screen_name: string
}

interface TweetEntities {
  urls: UrlEntity[]
}

interface ExtendedEntities {
  media: MediaEntity[]
}

interface MediaEntity {
  allow_download_status: {
    allow_download: boolean
  }
  display_url: string
  expanded_url: string
  ext_media_availability: {
    status: string
  }
  features: MediaFeatures
  id_str: string
  indices: number[]
  media_key: string
  media_results: MediaResults
  media_url_https: string
  original_info: OriginalInfo
  sizes: MediaSizes
  type: string
  url: string
}

interface MediaFeatures {
  large: MediaFaceRecognition
  orig: MediaFaceRecognition
}

interface MediaFaceRecognition {
  faces?: Face[]
}

interface Face {
  h: number
  w: number
  x: number
  y: number
}

interface MediaResults {
  id: string
  result: {
    __typename: string
    id: string
    media_key: string
  }
}

interface OriginalInfo {
  focus_rects: FocusRect[]
  height: number
  width: number
}

interface FocusRect {
  h: number
  w: number
  x: number
  y: number
}

interface MediaSizes {
  large: {
    h: number
    w: number
  }
}

export type { TwitterAPIResponse, TweetInfo, Author, MediaEntity, ExtendedEntities, TweetEntities, AuthorEntities, UrlEntity, UserMention }

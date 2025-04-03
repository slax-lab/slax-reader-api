import { InternetSearchFail } from '../../const/err'

interface SearchResult {
  title: string
  link: string
  displayLink: string
  snippet: string
}

interface SearchResponse {
  items: SearchResult[]
}

export class GoogleSearch {
  private cx: string
  private key: string
  private searchApi: string

  private static readonly GOOGLE_SEARCH_API = 'https://www.googleapis.com/customsearch/v1'
  private static readonly SEARCH_RESULT_ICON_PREFIX = 'https://www.google.com/s2/favicons?domain='

  constructor(env: Env) {
    this.cx = env.GOOGLE_SEARCH_ENAGINE_ID
    this.key = env.GOOGLE_SEARCH_KEY
    this.searchApi = env.SEARCH_GOOGLE_API.length > 0 ? env.SEARCH_GOOGLE_API : GoogleSearch.GOOGLE_SEARCH_API
  }

  async search(params: string) {
    try {
      const queryUrl = new URL(this.searchApi)
      queryUrl.searchParams.append('q', params)
      queryUrl.searchParams.append('cx', this.cx)
      queryUrl.searchParams.append('key', this.key)
      const resp = (await fetch(queryUrl.toString())) as Response
      if (!resp || !resp.ok) return InternetSearchFail()

      const res = await resp.json<SearchResponse>()
      return res.items.slice(0, 6).map(item => {
        return {
          title: item.title,
          url: item.link,
          icon: `${GoogleSearch.SEARCH_RESULT_ICON_PREFIX}${item.displayLink}`,
          content: item.snippet
        }
      })
    } catch (error) {
      console.log(`google search error: ${error}`)
      return InternetSearchFail()
    }
  }
}

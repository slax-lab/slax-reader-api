import { FetchThreePartyError } from '../../const/err'

export class Apify {
  public static async fetchApifyTwitterUrlScraper(env: Env, urls: string[]): Promise<TweetItem[]> {
    const url = new URL('https://api.apify.com/v2/acts/quacker~twitter-url-scraper/run-sync-get-dataset-items')
    url.searchParams.append('token', env.APIFY_API_TOKEN)

    const params = {
      addUserInfo: true,
      tweetsDesired: 1,
      startUrls: urls.map(url => ({ url }))
    }

    const resp = (await fetch(url.toString(), {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json'
      }
    })) as Response

    if (!resp.ok) {
      console.error(`fetch ${url} failed, response is not ok: ${await resp.text()}`)
      throw FetchThreePartyError()
    }

    return await resp.json<TweetItem[]>()
  }
}

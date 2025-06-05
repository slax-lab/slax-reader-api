import { FetchThreePartyError } from '../../const/err'
import { TweetInfo, TwitterAPIResponse } from '../../const/struct'

export class TwitterApi {
  public static async fetchApifyTwitterUrlScraper(env: Env, tweetIds: string[]): Promise<TweetInfo[]> {
    const url = new URL('https://api.twitterapi.io/twitter/tweets')
    url.searchParams.append('tweet_ids', tweetIds.join(','))

    const resp = (await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.APIFY_API_TOKEN
      }
    })) as Response

    if (!resp.ok) {
      console.error(`fetch ${url} failed, response is not ok: ${await resp.text()}`)
      throw FetchThreePartyError()
    }

    const data = await resp.json<TwitterAPIResponse>()
    if (data.status !== 'success') {
      console.error(`fetch ${url} failed, response is not ok: ${data.msg}`)
      throw FetchThreePartyError()
    }

    return data.tweets
  }
}

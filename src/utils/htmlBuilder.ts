export interface SlaxTopic {
  nickName: string
  avatar: string
  title: string
  desc: string
  imgs: string[]
}

export class HtmlBuilder {
  public static buildTweet(item: TweetItem): string {
    if (item.error) return ``

    const tweetStyle = item.media.map(media => {
      if (media.type === 'photo') {
        return `<img src="${media.media_url}" alt="Tweet Media">`
      }
      if (media.type === 'video') {
        return `<video controls="controls" poster="${media.media_url}" ><source src="${media.video_url}"> Your device is not support.</video>`
      }
      return ''
    })

    return `<div class="tweet">
              <tweet-header
                  data-avatar="${item.user.profile_image_url_https}" 
                  data-href="https://x.com/${item.user.screen_name}"
                  data-name="${item.user.name}"
                  data-screen-name="${item.user.screen_name}"
                  data-description="${item.user.description}"
                  data-location="${item.user.location}"
                  data-website="${item.user.url}"
                  data-created-at="${item.user.created_at}"
                  data-followers="${item.user.followers_count}"
                  data-followings="${item.user.friends_count}"
              ></tweet-header>
              <div class="tweet-content">${(item.full_text || '').trim()}</div>
              <div class="tweet-media">${tweetStyle.join('\n')}</div>
              <tweet-footer
                  data-reply-count="${item.reply_count}"
                  data-retweet-count="${item.retweet_count}"
                  data-favorite-count="${item.favorite_count}">
              </tweet-footer>
          </div>`
  }

  public static buildVideo(document: Document, url: string, poster: string) {
    const video = document.createElement('video')
    video.setAttribute('src', url)
    video.setAttribute('poster', poster)
    return video
  }

  public static buildSlaxTopic(document: Document, slaxTopic: SlaxTopic) {
    const fragment = document.createDocumentFragment()
    const slaxTopicDom = document.createElement('slax-photo-swipe-topic')

    slaxTopicDom.innerHTML = `
      <div class="topic-container">
        <div class="photo-section">
          <div class="swiper">
            ${slaxTopic.imgs
              .map(
                img => `
              <div class="swiper-slide">
                <img src="${img}">
              </div>
            `
              )
              .join('')}
          </div>
        </div>
        <div class="text-section">
          <div class="author">
            <img src="${slaxTopic.avatar}">
            <span class="nickname">${slaxTopic.nickName}</span>
          </div>
          <div class="title">${slaxTopic.title}</div>
          <div class="desc">${slaxTopic.desc}</div>
        </div>
      </div>
    `

    fragment.appendChild(slaxTopicDom)
    return fragment.firstElementChild as HTMLElement
  }

  public static buildVerifyCodeEmail(targetEmail: string, code: string) {
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
  <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Slax Note Login Verify Code</title>
  </head>
  <body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2F2F2F;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
              <td align="center">
                  <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
                      <tr>
                          <td bgcolor="white" style="padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                  <!-- Logo -->
                                  <tr>
                                      <td align="center" style="padding-bottom: 30px;">
                                          <img src="https://note.slax.com/images/logo.png" alt="Slax Note Logo" width="80" style="display: block;" />
                                      </td>
                                  </tr>
                                  
                                  <tr>
                                      <td>
                                          <p>你的登录验证码：</p>
                                      </td>
                                  </tr>
                                  
                                  <tr>
                                      <td>
                                          <div style="font-size: 32px; font-weight: bold; text-align: center; margin: 30px 0; letter-spacing: 2px;">${code}</div>
                                      </td>
                                  </tr>
  
                                  <tr>
                                      <td>
                                          <p>${targetEmail}，您好！</p>
                                          <p>您近期曾尝试从新设备、新浏览器或新地点登陆。请使用以上代码完成登陆。验证码十分钟有效。</p>
                                          <p>如果发起人不是您本人，请忽略该邮件。</p>
                                          <p>谢谢！<br/>Slax Note 团队</p>
                                      </td>
                                  </tr>
                              </table>
                          </td>
                      </tr>
                      
                      <!-- 页脚 -->
                      <tr>
                          <td style="padding-top: 40px; text-align: center; font-size: 14px; color: #666;">
                              需要帮助吗？ <a href="https://t.me/+p0WuhBYOpQ5iODll" style="color: #0078F2; text-decoration: none;">官方用户群</a>
                          </td>
                      </tr>
                  </table>
              </td>
          </tr>
      </table>
  </body>
  </html>`
  }
}

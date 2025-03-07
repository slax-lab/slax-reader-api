import { Readability } from '@slax-lab/readability'
import { ReadabilityParseError } from '../../const/err'
import { parseHTML } from 'linkedom'
import { CustomParse, Preparse } from './type'
import { HtmlBuilder } from '../htmlBuilder'

const mpWeixinQQFallbackHandler = (doc: Document) => {
  console.log('fallback')
  const textDescDom = doc.querySelector('#js_text_desc')
  if (!textDescDom) return ReadabilityParseError()

  const { document } = parseHTML(`<html><body>${textDescDom.innerHTML}</body></html>`)
  const res = new Readability(document).parse()
  if (!res) return ReadabilityParseError()

  const byline = doc.querySelector('.wx_follow_nickname')
  res.byline = byline?.textContent || ''
  return res
}

const mpWeixinQQPreHandler = (url: string, document: Document) => {
  // 微信的普通视频
  const videoDoms = Array.from(document.querySelectorAll('[id^="js_mp_video_container"]')) || []
  videoDoms.forEach(item => {
    const videoDom = item.querySelector('.video_fill')
    if (videoDom && item.parentNode) {
      item.parentNode.replaceChild(videoDom, item)
    }
  })
  // 未加载成功时的视频
  const iframeDoms = Array.from(document.querySelectorAll('iframe')) || []
  iframeDoms.forEach(iframeDom => {
    if (iframeDom.className.indexOf('video_iframe') !== -1 && iframeDom.childNodes.length === 0) {
      const video = HtmlBuilder.buildVideo(document, iframeDom.dataset['src'] || '', iframeDom.dataset['cover'] || '')
      document.replaceChild(video, iframeDom)
    }
  })
  // 备份一下图片的style
  // 因为公众号号的图片样式是最杂的，得特殊处理一下
  const imgDoms = Array.from(document.querySelectorAll('img')) || []
  imgDoms.forEach(img => img.setAttribute('slax-style', img.getAttribute('style') || ''))
}

const mpWeixinQQPostHandler = (url: string, document: Document) => {
  const imgDoms = Array.from(document.querySelectorAll('img')) || []
  imgDoms.forEach(img => {
    // 覆盖原始样式后能解决90%的图片
    const originalStyle = (img.getAttribute('slax-style') || '')
      .split(';')
      .map(item => {
        if (item.includes('opacity')) return ''
        if (item.includes('display')) return ''
        if (item.includes('visibility')) return ''
        return item
      })
      .join(';')
    img.setAttribute('style', originalStyle)
    img.removeAttribute('slax-style')
    img.removeAttribute('data-original-style')
  })
}

const getWeixinBylineHandler = (rawByline: string, document: Document): string => {
  const nickNameDom = document.querySelector('#js_name')
  if (!nickNameDom) return rawByline
  const nickName = nickNameDom.textContent?.trimStart().trimEnd() || ''

  const publisherDom = document.querySelector('meta[name="author"]')
  if (!publisherDom) return nickName

  return `${nickName} ${publisherDom.getAttribute('content')}`
}

const customerParser = (url: URL, document: Document): CustomParse => {
  const imgs = Array.from(document.querySelectorAll('.swiper_item[data-status="1"]'))
    .filter(Boolean)
    .map(item => {
      return item.getAttribute('data-src') || ''
    })
  const title = document.querySelector('.rich_media_title')?.textContent || ''
  const desc = document.querySelector('#js_image_desc')?.outerHTML || ''
  const avatar = document.querySelector('.wx_follow_avatar')?.getAttribute('src') || ''
  const nickName = document.querySelector('.wx_follow_nickname')?.textContent || ''
  const publishedTime = document.querySelector('#publish_time')?.textContent || ''

  const slaxTopic = HtmlBuilder.buildSlaxTopic(document, {
    title,
    desc,
    imgs,
    nickName,
    avatar
  })

  return {
    title,
    // HTML DOM
    contentDocument: document,
    // HTML CONTENT
    content: slaxTopic.outerHTML,
    // HTML ONLY TEXT
    textContent: slaxTopic.textContent || '',
    length: slaxTopic.textContent?.length || 0,
    excerpt: slaxTopic.textContent || '',
    byline: nickName,
    dir: slaxTopic.dir,
    siteName: '微信',
    lang: slaxTopic.lang,
    publishedTime: publishedTime
  }
}

export { mpWeixinQQPreHandler, mpWeixinQQPostHandler, mpWeixinQQFallbackHandler, getWeixinBylineHandler, customerParser }

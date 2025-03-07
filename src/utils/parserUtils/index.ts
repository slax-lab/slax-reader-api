import { ReadabilityParseError } from '../../const/err'
import * as weixinProcess from './processWeixin'
import * as mediumProcess from './processMedium'
import * as bowtiedbullHandler from './processBowtiedbull'
import * as githubProcess from './processGithub'
import * as youtubeProcess from './processYoutube'
import { Readability } from '@slax-lab/readability'

enum hostIndex {
  WEIXIN = 'mp.weixin.qq.com',
  BOWTIEDBULL = 'bowtiedbull.io',
  GITHUB = 'github.com',
  YOUTUBE = 'youtube.com',
  YOUTUBE_WWW = 'www.youtube.com'
}

enum siteIndex {
  MEDIUM = 'Medium'
}

const parserHostHandlers: Map<string, Function[]> = new Map([
  [hostIndex.WEIXIN, [weixinProcess.mpWeixinQQPreHandler]],
  [hostIndex.BOWTIEDBULL, [bowtiedbullHandler.bowtiedbullHandler]],
  [hostIndex.GITHUB, [githubProcess.githubPreHandler]]
])

const parserPreSiteHandlers: Map<string, Function[]> = new Map([[siteIndex.MEDIUM, [mediumProcess.mediumHandler]]])

const postProcessHandlers: Map<string, Function[]> = new Map([
  [hostIndex.WEIXIN, [weixinProcess.mpWeixinQQPostHandler]],
  [hostIndex.YOUTUBE, [youtubeProcess.youtubeHandler]],
  [hostIndex.YOUTUBE_WWW, [youtubeProcess.youtubeHandler]]
])

// 预处理hook
export const PreparserHandle = async (url: URL, content: Document) => {
  const parserHandlers: Function[] = []
  // host匹配器
  if (parserHostHandlers.has(url.host)) {
    parserHandlers.push(...parserHostHandlers.get(url.host)!)
  }
  // 特征匹配
  const siteName = content.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
  if (parserPreSiteHandlers.has(siteName)) {
    parserHandlers.push(...parserPreSiteHandlers.get(siteName)!)
  }

  for (const handler of parserHandlers) {
    await handler(url, content)
  }
  console.log(`PreparserHandle: ${parserHandlers.map(handler => handler.name).join(', ')}`)
}

// 后处理hook
export const postParserHandle = async (url: URL, content: Document) => {
  const handlers: Function[] = [postProcessUrl]
  // host匹配器
  if (postProcessHandlers.has(url.host)) {
    handlers.push(...postProcessHandlers.get(url.host)!)
  }

  // execute
  for (const handler of handlers) {
    await handler(url, content)
  }
  console.log(`postParserHandle: ${handlers.map(handler => handler.name).join(', ')}`)
}

// 解析失败兜底
export const fallbackParserHandle = async (url: URL, content: Document) => {
  if (url.host === hostIndex.WEIXIN) return weixinProcess.mpWeixinQQFallbackHandler(content)

  return ReadabilityParseError()
}

// 作者提取
export const bylineParserHandle = (url: URL, rawByline: string, document: Document, rawDocument: Document): string => {
  if (url.host === hostIndex.WEIXIN) {
    return weixinProcess.getWeixinBylineHandler(rawByline, rawDocument)
  }

  const bylineDom = document.querySelector('#profileBt') || document.querySelector('meta[name="author"]')
  const byline = bylineDom?.getAttribute('content') || bylineDom?.textContent || rawByline
  if (bylineDom) bylineDom.remove()
  return byline
}

// 文章标题提取
export const titleParserHandle = (url: URL, rawDocument: Document, title?: string, rawTitle?: string): string => {
  return (
    rawDocument.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    rawDocument.querySelector('meta[name="title"]')?.getAttribute('content') ||
    rawDocument.querySelector('title')?.textContent ||
    rawTitle ||
    title ||
    ''
  )
}

export const publishedTimeParserHandle = (url: URL, rawPublishedTime: string, document: Document): string => {
  if (!rawPublishedTime) {
    const publishedTime = document.querySelector('meta[property="article:published_time"]') || document.querySelector('#publish_time')
    if (publishedTime) rawPublishedTime = publishedTime.textContent || ''
    if (publishedTime) publishedTime.remove()
  }
  return rawPublishedTime
}

export const postProcessUrl = (url: URL, document: Document) => {
  document.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href')
    if (!href) return

    try {
      const aUrl = new URL(href, url.href)
      if (!aUrl.href) return

      a.setAttribute('href', aUrl.href)
    } catch (error) {
      console.log(`Post Process href error: `, href)
    }
  })
}

export const slaxReadability = (url: URL, document: Document) => {
  const checkWeixinImageShower = function () {
    return url.host === 'mp.weixin.qq.com' && !!document.querySelector('#js_image_desc')
  }
  if (checkWeixinImageShower()) return weixinProcess.customerParser(url, document)
  return new Readability(document, { debug: false }).parse()
}

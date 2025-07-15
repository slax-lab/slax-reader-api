import { parseHTML } from 'linkedom'
import moment from 'moment-timezone'
import { bylineParserHandle, fallbackParserHandle, postParserHandle, PreparserHandle, publishedTimeParserHandle, slaxReadability, titleParserHandle } from './parserUtils'
import { Preparse } from './parserUtils/type'
import { MultiLangError } from './multiLangError'
import { ReadabilityParseError } from '../const/err'

export class ContentParser {
  public static async parse(options: { url: URL; content: string; title?: string }): Promise<Preparse> {
    const content = this.getCleanHtml(options.content)

    let rawDocument = this.getDocument(content)
    let rawTitle = rawDocument.title

    // 预处理hook
    await PreparserHandle(options.url, rawDocument)

    // Readability内容解析
    let res = slaxReadability(options.url, rawDocument)
    if (!res) {
      const fallbackResult = await fallbackParserHandle(options.url, rawDocument)
      if (fallbackResult instanceof MultiLangError) throw fallbackResult
      res = fallbackResult
    }
    if (!res) throw ReadabilityParseError()

    // Readability内容转换为DOM
    const document = this.getDocument(res.content || '')

    // 文章标题提取
    res.title = titleParserHandle(options.url, rawDocument, options.title, rawTitle)

    // 作者提取
    res.byline = bylineParserHandle(options.url, res.byline || '', document, rawDocument)

    // 发布时间提取
    res.publishedTime = publishedTimeParserHandle(options.url, res.publishedTime || '', document)

    // 后处理
    await postParserHandle(options.url, document)

    // 发布时间转换
    let publishedTime = new Date()
    if (res.publishedTime) {
      try {
        res.publishedTime = res.publishedTime.replace(/年|月/g, '-').replace('日', '')
        publishedTime = moment(res.publishedTime).toDate()
      } catch (err: any) {
        console.log(`Published time parse error: ${err.message}`)
      }
    }

    return {
      ...res,
      publishedTime,
      contentDocument: document,
      title: res.title || '',
      content: res.content || '',
      textContent: res.textContent || '',
      length: res.length || 0,
      excerpt: res.excerpt || '',
      byline: res.byline || '',
      dir: res.dir || '',
      siteName: res.siteName || '',
      lang: res.lang || ''
    }
  }

  public static getDocument(src: string): Document {
    const { document } = parseHTML(src)
    return document
  }

  public static getCleanHtml(rawHtml: string): string {
    function removeScriptAndStyleTags(html: string): string {
      const scriptAndStyleTagsRegex = /<(script|style)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi
      return html.replace(scriptAndStyleTagsRegex, '')
    }

    function removeInlineEventHandlers(html: string): string {
      const eventHandlerRegex = /\s(on\w+)=["'].*?["']/gi
      return html.replace(eventHandlerRegex, '')
    }

    function removeUnnecessaryAttributes(html: string): string {
      const unnecessaryAttributesRegex = /\s(type|language)=["'].*?["']/gi
      return html.replace(unnecessaryAttributesRegex, '')
    }

    function removeComments(html: string): string {
      const commentRegex = /<!--[\s\S]*?-->/g
      return html.replace(commentRegex, '')
    }

    const cleanedHtml = [removeScriptAndStyleTags, removeInlineEventHandlers, removeUnnecessaryAttributes, removeComments].reduce(
      (html, cleaningStep) => cleaningStep(html),
      rawHtml
    )

    return `${cleanedHtml}`
  }
}

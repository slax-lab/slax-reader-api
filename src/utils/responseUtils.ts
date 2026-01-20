import { corsCacheHeader, corsHeader, corsNotCacheHeader } from '../middleware/cors'
import { MultiLangError } from './multiLangError'

type ResponseType = 'json' | 'html'

interface ResponseOptions {
  data: any
  message?: string
  status?: number
  headers?: Record<string, string>
}

const defaultHeaders = {
  json: { 'Content-Type': 'application/json', ...corsHeader },
  html: { 'Content-Type': 'text/html' }
}

export const createResponse = (type: ResponseType, options: ResponseOptions): Response => {
  let { data, status = 200, headers = defaultHeaders[type], message = '' } = options
  if (data instanceof MultiLangError) {
    const mErr = data as MultiLangError
    message = mErr.getMessage
    status = mErr.errCode
    data = mErr.name
  }
  if ([401, 418, 429].includes(status)) {
    options.status = status
  }
  switch (type) {
    case 'json':
      return new Response(JSON.stringify({ data: data, message: message, code: status }), { status: options.status, headers })
    case 'html':
      return new Response(data, { status, headers })
    default:
      throw new Error('Unsupported response type')
  }
}

export const responseRedirect = (url: string, status = 302): Response => {
  return new Response(null, {
    status,
    headers: {
      Location: url,
      ...corsCacheHeader
    }
  })
}

export const responseImage = (r: ReadableStream<any>, mime: string, cache = false): Response => {
  return new Response(r, {
    headers: {
      'Content-Type': mime,
      ...(cache ? corsCacheHeader : corsNotCacheHeader)
    }
  })
}

const Successed = (data?: any, code = 200, message = 'ok', headers?: Record<string, string>) => createResponse('json', { data, status: code, message: message, headers })
const Failed = (data: any, code = 400, message = '', headers?: Record<string, string>) => createResponse('json', { data, status: code, message: message, headers })
const Panic = (data: any, code = 500, message = '', headers?: Record<string, string>) => createResponse('json', { data, status: code, message: message, headers })
const Render = (html: string, code = 200, headers?: Record<string, string>) => createResponse('html', { data: html, status: code, headers })
const RenderNotModify = (html: string, headers?: Record<string, string>) => createResponse('html', { data: html, status: 304, headers })
const NotFound = (data: any, message = '', headers?: Record<string, string>) => createResponse('json', { data, status: 404, message: message, headers })

export { Successed, Failed, Panic, Render, RenderNotModify, NotFound }

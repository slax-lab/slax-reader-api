import { ContextManager } from '../utils/context'

export const corsHeader = {
  server: 'slax-reader',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '86400'
}

export const corsCacheHeader = {
  server: 'slax-reader',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '31536000',
  'Cache-Control': 'public, max-age=31536000',
  'HIT-SLAX-CACHE': '1'
}

export const corsNotCacheHeader = {
  server: 'slax-reader',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '31536000',
  'Cache-Control': 'no-store',
  'HIT-SLAX-CACHE': '0',
  'SLAX-PROXY-IMAGE': '1'
}

export const cors = async (request: Request, ctx: ContextManager) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'public, max-age=86400',
        ...corsHeader
      }
    })
  }
}

import { Auth } from '../utils/jwt'
import { Failed } from '../utils/responseUtils'
import { ContextManager } from '../utils/context'
import { UnauthorizedError } from '../const/err'
import { Hashid } from '../utils/hashids'

const whiteList = [
  '/v1/user/login',
  '/v1/share/detail',
  '/v1/share/mark_list',
  '/v1/user/sessions',
  '/v1/user/verification_codes',
  '/v1/user/silent/sessions',
  '/v1/user/messages',
  '/ping',
  '/static/image',
  '/callback/telegram'
]

export const auth = async (request: Request, ctx: ContextManager) => {
  const authorization = request.headers.get('Authorization') ?? ''
  if (whiteList.some(item => request.url.includes(item)) && authorization === '') {
    ctx.setHashIds(new Hashid(ctx.env))
    return
  }

  if (authorization === '') throw UnauthorizedError()
  try {
    await authToken(ctx, authorization.replace('Bearer ', ''))
  } catch (err) {
    console.log(`auth failed: ${err}`)
    throw UnauthorizedError()
  }
}

export const authToken = async (ctx: ContextManager, token: string) => {
  try {
    let res = await new Auth(ctx.env).verify(token)
    const enId = parseInt(res.id)
    if (!enId || isNaN(enId) || enId < 1) throw Failed(UnauthorizedError())

    const deId = new Hashid(ctx.env).decodeId(enId)
    if (!deId || isNaN(deId) || deId < 1) throw Failed(UnauthorizedError())

    ctx.setUserInfo(deId, enId, res.email, res.lang)
    ctx.setHashIds(new Hashid(ctx.env, deId))
  } catch (err) {
    console.log(`auth failed: ${err}`)
    throw UnauthorizedError()
  }
}

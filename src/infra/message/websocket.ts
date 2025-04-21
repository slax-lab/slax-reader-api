import { DurableObject } from 'cloudflare:workers'
import { container } from '../../decorators/di'
import { UserRepo } from '../repository/dbUser'
import { lazy } from '../../decorators/lazy'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { bookmarkActionChangePO } from '../repository/dbBookmark'

type SocketSerializeMeta =
  | {
      uuid: string
      deviceId: number
    }
  | {
      userId: number
      deviceId: number
      connectType?: 'extensions'
    }
export class SlaxWebSocketServer extends DurableObject {
  private sessions: Map<string, WebSocket> = new Map()
  private extensionSession: Map<string, Set<WebSocket>> = new Map()

  constructor(
    state: DurableObjectState,
    public env: Env
  ) {
    super(state, env)

    container.registerInstance(UserRepo, new UserRepo(lazy(() => new PrismaClient({ adapter: new PrismaD1(env.DB) }))))
    state.getWebSockets().forEach(ws => {
      const meta = ws.deserializeAttachment() as SocketSerializeMeta
      if (!meta) {
        return
      }

      if ('connectType' in meta && meta.connectType === 'extensions') {
        if (!this.extensionSession.has(meta.userId.toString())) {
          this.extensionSession.set(meta.userId.toString(), new Set())
        }

        this.extensionSession.get(meta.userId.toString())?.add(ws)
      } else if ('uuid' in meta) {
        this.sessions.set(meta.uuid, ws)
      }
    })
  }

  async fetch(request: Request) {
    const uuid = request.headers.get('uuid')
    const userId = parseInt(request.headers.get('user_id') || '0')
    const region = request.headers.get('region')
    const deviceId = parseInt(request.headers.get('device_id') || '0')
    const connectType = request.headers.get('connect_type')

    if (!uuid || !userId || !region) return new Response(null, { status: 400, statusText: 'uuid not found' })
    // 创建websocket连接
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)
    // 休眠
    this.ctx.acceptWebSocket(server)

    if (connectType === 'extensions') {
      if (!this.extensionSession.has(userId.toString())) {
        this.extensionSession.set(userId.toString(), new Set())
      }

      this.extensionSession.get(userId.toString())?.add(server)
      server.serializeAttachment({ userId, deviceId, connectType })
    } else {
      // 维护session
      this.sessions.set(uuid, server)
      // 标记
      server.serializeAttachment({ uuid, deviceId })
    }

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  async sendReminder(token: string, unreadCount: number) {
    const ws = this.sessions.get(token)
    if (!ws) {
      console.log('websocket not found', token)
      return false
    }
    try {
      ws.send(`${JSON.stringify({ type: 'reminder', unreadCount })}`)
      return true
    } catch (e) {
      console.log('sendReminder error', e)
      return false
    }
  }

  async sendBookmarkChange(userId: number, changelog: Omit<bookmarkActionChangePO, 'user_id'>) {
    const wsSet = this.extensionSession.get(userId.toString())
    if (!wsSet || wsSet.size === 0) {
      console.log('websocket not found', userId)
      return false
    }

    ;[...wsSet].forEach(ws => {
      try {
        ws.send(`${JSON.stringify({ type: 'bookmark_changes', data: changelog })}`)
      } catch (e) {
        ws.close(1006, 'bye~')
        this.removeSocket(ws)
      }
    })
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    console.log('webSocketMessage', message)
    ws.send(`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`)
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    try {
      ws.close(code, 'bye~')
      this.removeSocket(ws)
    } catch (e) {
      console.log('webSocketClose error', e)
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.log('webSocketError', error)
    try {
      ws.close(1006, 'bye~')
      this.removeSocket(ws)
    } catch (e) {
      console.log('webSocketError error', e)
    }
  }

  async getOnlineWebsocketUser() {
    return this.sessions.size
  }

  async removeSocket(ws: WebSocket) {
    const meta = ws.deserializeAttachment() as SocketSerializeMeta
    if ('connectType' in meta && meta.connectType === 'extensions') {
      const wsSet = this.extensionSession.get(meta.userId.toString())
      if (wsSet) {
        wsSet.delete(ws)
        if (wsSet.size === 0) {
          this.extensionSession.delete(meta.userId.toString())
        }
      }
    } else if ('uuid' in meta && meta.uuid) {
      this.sessions.delete(meta?.uuid)
      await container.resolve<UserRepo>(UserRepo).removeUserPushDevice(meta?.deviceId)
    }
  }
}

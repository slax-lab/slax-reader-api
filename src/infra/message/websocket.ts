import { DurableObject } from 'cloudflare:workers'
import { container } from '../../decorators/di'
import { UserRepo } from '../repository/dbUser'
import { lazy } from '../../decorators/lazy'
import { PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

interface SocketSerializeMetaInfo {
  uuid: string
  userId: number
  deviceId: number
  connectType: 'extensions' | 'web'
}

interface BookmarkChangeVO {
  user_id: number
  bookmark_id: number
  created_at: Date
  target_url: string
  action: 'add' | 'delete' | 'update'
}

export class SlaxWebSocketServer extends DurableObject {
  private sessions: Map<string, WebSocket> = new Map()
  private extensionSession: Map<string, Set<WebSocket>> = new Map()

  constructor(
    state: DurableObjectState,
    public env: Env
  ) {
    super(state, env)

    state.getWebSockets().forEach(ws => {
      const meta = ws.deserializeAttachment() as SocketSerializeMetaInfo
      if (!meta) {
        return
      }

      if (meta.connectType === 'extensions') {
        if (!this.extensionSession.has(meta.userId.toString())) {
          this.extensionSession.set(meta.userId.toString(), new Set())
        }

        this.extensionSession.get(meta.userId.toString())?.add(ws)
      } else {
        this.sessions.set(meta.uuid, ws)
      }
    })
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request: Request) {
    const uuid = request.headers.get('uuid')
    const userId = parseInt(request.headers.get('user_id') || '0')
    const region = request.headers.get('region')
    const deviceId = parseInt(request.headers.get('device_id') || '0')
    const connectType = (request.headers.get('connect_type') as SocketSerializeMetaInfo['connectType']) || 'web'

    if (!uuid || !userId || !region) return new Response(null, { status: 400, statusText: 'uuid not found' })
    // 创建websocket连接
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)
    // 休眠
    this.ctx.acceptWebSocket(server)

    // 维护session
    if (connectType === 'extensions') {
      if (!this.extensionSession.has(userId.toString())) {
        this.extensionSession.set(userId.toString(), new Set())
      }

      this.extensionSession.get(userId.toString())?.add(server)
    } else {
      this.sessions.set(uuid, server)
    }

    // 标记
    server.serializeAttachment({ userId, uuid, deviceId, connectType })

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
      ws.send(`${JSON.stringify({ type: 'reminder', unreadCount: parseInt(unreadCount.toString()) })}`)
      return true
    } catch (e) {
      console.log('sendReminder error', e)
      return false
    }
  }

  async sendBookmarkChange(changelog: BookmarkChangeVO) {
    const { user_id, ...data } = changelog
    const wsSet = this.extensionSession.get(user_id.toString())

    wsSet?.forEach(ws => {
      try {
        ws.send(`${JSON.stringify({ type: 'bookmark_changes', data })}`)
      } catch (e) {
        ws.close(1006, 'bye~')
        this.removeSocket(ws)
      }
    })
  }

  async webSocketMessage(ws: WebSocket, message: string) {}

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
    const meta = ws.deserializeAttachment() as SocketSerializeMetaInfo
    if (meta.connectType === 'extensions') {
      const wsSet = this.extensionSession.get(meta.userId.toString())
      if (wsSet) {
        wsSet.delete(ws)
        if (wsSet.size === 0) {
          this.extensionSession.delete(meta.userId.toString())
        }
      }
    } else {
      this.sessions.delete(meta?.uuid)
      // HOOK: 修改为直接请求HTTP接口来完成
      const prismaPg = new HyperdrivePrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: this.env.HYPERDRIVE.connectionString, max: 1, maxUses: 1 })) })
      container.registerInstance(UserRepo, new UserRepo(lazy(() => prismaPg)))
      await container.resolve<UserRepo>(UserRepo).removeUserPushDevice(meta?.deviceId)
    }
  }
}

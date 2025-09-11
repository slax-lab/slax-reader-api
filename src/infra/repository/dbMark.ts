import { markSelectContent } from '../../domain/mark'
import { inject, injectable } from '../../decorators/di'
import { PRISIMA_CLIENT, PRISIMA_HYPERDRIVE_CLIENT } from '../../const/symbol'
import type { LazyInstance } from '../../decorators/lazy'
import { PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'
import { PrismaClient } from '@prisma/client'

export enum markType {
  LINE = 1,
  COMMENT = 2,
  REPLY = 3,
  ORIGIN_LINE = 4,
  ORIGIN_COMMENT = 5
}

export interface markXPathItem {
  type: 'text' | 'image'
  xpath: string
  start_offet: number
  end_offset: number
}

export interface markPO {
  id?: number
  user_id?: number
  user_bookmark_id?: number
  // 1- 划线 2- 评论 3- 回复评论
  type: markType
  source: markXPathItem[] | number
  comment: string
  parent_id: number
  root_id: number
  created_at?: Date
  updated_at?: Date
  source_type: string
  source_id: string
  content: markSelectContent[]
  approx_source?: markApproxSource
}

export interface markApproxSource {
  exact: string
  prefix: string
  suffix: string
  position_start: number
  position_end: number
}

export interface markPOWithId {
  id: number
  user_id: number
  bookmark_id: number
  type: number
  source: string
  approx_source: string
  comment: string
  root_id: number
  parent_id: number
  content: string
  source_type: string
  source_id: string
  is_deleted: boolean
  created_at: Date
  updated_at: Date
}

export interface markDetailPO {
  id: number
  user_id: number
  user_bookmark_id: number
  type: markType
  source: markXPathItem[]
  comment: string
  created_at: Date
  updated_at: Date
  is_deleted: boolean
  parent_id: number
  root_id: number
}

@injectable()
export class MarkRepo {
  constructor(
    @inject(PRISIMA_CLIENT) private prisma: LazyInstance<PrismaClient>,
    @inject(PRISIMA_HYPERDRIVE_CLIENT) private prismaPg: LazyInstance<HyperdrivePrismaClient>
  ) {}

  async create(data: markPO): Promise<markPOWithId> {
    return await this.prismaPg().sr_bookmark_comment.create({
      data: {
        user_id: data.user_id,
        bookmark_id: data.user_bookmark_id,
        type: data.type,
        source: JSON.stringify(data.source),
        comment: data.comment,
        created_at: new Date(),
        updated_at: new Date(),
        is_deleted: false,
        parent_id: data.parent_id,
        root_id: data.root_id,
        source_type: data.source_type,
        source_id: data.source_id,
        content: JSON.stringify(data.content),
        approx_source: JSON.stringify(data.approx_source)
      }
    })
  }

  async list(userBmId: number) {
    return (
      await this.prismaPg().sr_bookmark_comment.findMany({
        where: {
          bookmark_id: userBmId
        }
      })
    ).map(item => {
      return {
        id: item.id,
        user_id: item.is_deleted ? 0 : item.user_id,
        user_bookmark_id: item.bookmark_id,
        type: item.type,
        source: JSON.parse(item.source),
        comment: item.is_deleted ? '' : item.comment,
        created_at: item.created_at,
        updated_at: item.updated_at,
        is_deleted: item.is_deleted,
        parent_id: item.parent_id,
        root_id: item.root_id,
        approx_source: JSON.parse(item.approx_source.length > 0 ? item.approx_source : '{}')
      }
    })
  }

  async get(id: number): Promise<markDetailPO | null> {
    const res = await this.prismaPg().sr_bookmark_comment.findFirst({ where: { id } })
    if (!res) return null
    return {
      id: res.id,
      user_id: res.is_deleted ? 0 : res.user_id,
      user_bookmark_id: res.bookmark_id,
      type: res.type,
      source: JSON.parse(res.source),
      comment: res.is_deleted ? '' : res.comment,
      created_at: res.created_at,
      updated_at: res.updated_at,
      is_deleted: res.is_deleted,
      parent_id: res.parent_id,
      root_id: res.root_id
    }
  }

  async del(id: number) {
    return await this.prismaPg().sr_bookmark_comment.delete({ where: { id } })
  }

  async deleteByRootId(bookmarkId: number, rootId: number) {
    return await this.prismaPg().sr_bookmark_comment.deleteMany({ where: { bookmark_id: bookmarkId, root_id: rootId } })
  }

  async existsCommentMarkChild(bookmarkId: number, rootId: number) {
    return await this.prismaPg().sr_bookmark_comment.count({
      where: {
        bookmark_id: bookmarkId,
        root_id: rootId,
        is_deleted: false
      },
      // 外部需要判断是否除了自身外还有其他子评论
      // 如果只有一条记录，则说明没有其他子评论，故只拿2条即可
      take: 2
    })
  }

  async updateCommentMarkDeleted(id: number) {
    return await this.prismaPg().sr_bookmark_comment.update({ where: { id }, data: { is_deleted: true, updated_at: new Date() } })
  }

  async updateCommentRootId(id: number, rootId: number) {
    return await this.prismaPg().sr_bookmark_comment.update({ where: { id }, data: { root_id: rootId, updated_at: new Date() } })
  }

  async deleteByBookmarkId(bookmarkId: number) {
    return await this.prismaPg().sr_bookmark_comment.deleteMany({ where: { bookmark_id: bookmarkId } })
  }

  async listUserMark(userId: number, page: number, size: number) {
    return await this.prismaPg().sr_bookmark_comment.findMany({
      where: { user_id: userId, is_deleted: false },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * size,
      take: size
    })
  }
}

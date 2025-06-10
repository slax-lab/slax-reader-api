import { randomUUID } from 'crypto'
import { ErrorParam, ServerError } from '../const/err'
import { ContextManager } from '../utils/context'
import { Hashid } from '../utils/hashids'
import { inject, injectable } from '../decorators/di'
import { BookmarkRepo } from '../infra/repository/dbBookmark'
import type { LazyInstance } from '../decorators/lazy'
import { KVClient } from '../infra/repository/KVClient'
import { QueueClient, importBookmarkMessage } from '../infra/queue/queueClient'
import { BucketClient } from '../infra/repository/bucketClient'
import { parseCSVLine } from '../utils/csv'

export interface omnivoreData {
  id: string
  slug: string
  title: string
  description: string
  author: string
  url: string
  state: string
  readingProgress: number
  thumbnail: string
  labels: string[]
  savedAt: string
  updatedAt: string
  publishedAt: string
}

export interface pocketData {
  title: string
  url: string
  time_added: string
  tags: string
  status: string
}

export interface importProcessResponse {
  id: number
  batch_count: number
  current_count: number
  count: number
  status: number
  type: string
  reason: string
  created_at: string
}

@injectable()
export class ImportService {
  constructor(
    @inject(BookmarkRepo) private bookmarkRepo: BookmarkRepo,
    @inject(QueueClient) private queueClient: LazyInstance<QueueClient>,
    @inject(KVClient) private kvClient: LazyInstance<KVClient>,
    @inject(BucketClient) private bucketClient: LazyInstance<BucketClient>
  ) {}

  async importBookmark(ctx: ContextManager, type: string, fileType: string, blob: string): Promise<number> {
    const name = `import/data/${ctx.getUserId()}/${type}/${randomUUID()}`

    let data: (omnivoreData | pocketData)[] = []
    if (type === 'pocket') {
      for (const [index, item] of blob.split('\n').entries()) {
        if (index === 0) continue

        const fields = parseCSVLine(item)

        if (fields.length === 0 || fields.length < 5) continue

        const [title, url, time_added, tags, status] = fields

        if (!url || url.length < 1) continue
        data.push({
          title: title || '',
          url: url || '',
          time_added: time_added || '',
          tags: tags || '',
          status: status || ''
        })
      }
    } else if (type === 'omnivore') {
      data = JSON.parse(blob) as omnivoreData[]
      if (data.length < 1) throw ErrorParam()
    }

    const batchSize = 1
    const queueBatchSize = 100

    const res = await this.bookmarkRepo.createBookmarkImportTask(ctx.getUserId(), type, name, data.length, Math.ceil(data.length / batchSize))
    if (!res) throw ServerError()
    // 基于Cloudflare限制分割任务
    // 每个Import任务拆分成100个消息一组
    // 1000/request in Worker
    // 15 min duration limit for Cron Triggers, Durable Object Alarms and Queue Consumers
    // 将数据按每20条分组

    const queueMessages: importBookmarkMessage[] = []
    for (let i = 0; i < data.length; i += batchSize) {
      const message: importBookmarkMessage = {
        type,
        id: res.id,
        userId: ctx.getUserId(),
        data: data.slice(i, i + batchSize)
      }
      queueMessages.push(message)
    }

    for (let i = 0; i < queueMessages.length; i += queueBatchSize) {
      const batch = queueMessages.slice(i, i + queueBatchSize)
      await ctx.env.IMPORT_OTHER.sendBatch(
        batch.map(msg => ({
          body: msg
        }))
      )
      console.log(`Sent batch ${Math.floor(i / queueBatchSize) + 1}/${Math.ceil(queueMessages.length / queueBatchSize)}, messages: ${batch.length}`)
    }

    await this.bucketClient().R2Bucket.put(name, blob, {
      httpMetadata: {
        contentType: fileType
      }
    })
    console.log(`import task batch count: ${Math.ceil(data.length / batchSize)}`)
    return res.id
  }

  public async getImportInfo(ctx: ContextManager): Promise<importProcessResponse[]> {
    const res = await this.bookmarkRepo.getUserImportTask(ctx.getUserId())
    if (!res) throw ErrorParam()

    const importProcessList: importProcessResponse[] = []
    for (const item of res) {
      const itemData: importProcessResponse = {
        id: ctx.hashIds.encodeId(item.id),
        batch_count: item.batch_count,
        current_count: item.batch_count,
        type: item.type,
        count: item.total_count,
        status: item.status,
        reason: item.reason,
        created_at: item.created_at.toISOString()
      }
      //0- 未开始 1- 进行中 2- 失败 3- 完成
      if (item.status === 1) {
        itemData.current_count = await this.getImportProcess(ctx.env, ctx.getUserId(), item.id)
      }
      importProcessList.push(itemData)
    }

    return importProcessList
  }

  async getImportProcess(env: Env, userId: number, id: number) {
    const res = await env.KV.list({
      prefix: `import/process/${userId}/${id}/`
    })
    return res.keys?.length || 0
  }

  public async checkImportTaskProcess(ctx: ContextManager) {
    const res = await this.bookmarkRepo.getUnfinishedImportTask()
    res.length > 0 && console.log(`has ${res.length} unfinished import task`)

    for (const item of res) {
      console.log(`cronjob checkImportTaskProcess item: ${JSON.stringify(item)}`)
      const currentCount = await this.getImportProcess(ctx.env, item.user_id, item.id)
      if (currentCount === item.batch_count) {
        console.log(`cronjob checkImportTaskProcess item: ${item.id} finished, current count: ${currentCount}, batch count: ${item.batch_count}`)
        const res = await ctx.env.KV.list({
          prefix: `import/process/${item.user_id}/${item.id}/`
        })
        for (const key of res.keys) {
          await ctx.env.KV.delete(key.name)
        }
        await this.bookmarkRepo.updateBookmarkImportTask(item.id, 3, '')
      } else {
        console.log(`cronjob checkImportTaskProcess item: ${item.id} not finished, current count: ${currentCount}, batch count: ${item.batch_count}`)
      }
    }
  }

  public async processImportBookmark(ctx: ContextManager, message: { id: number; info: importBookmarkMessage }) {
    const onFaild = (err: string) => {
      console.error(`import bookmark failed: ${JSON.stringify(err)}`)
      this.bookmarkRepo.appendImportTaskErrLog(message.id, err)
    }

    const hashids = new Hashid(ctx.env, message.info.userId)
    const enUserId = hashids.encodeId(message.info.userId)
    ctx.setUserInfo(message.info.userId, enUserId, '', '')
    ctx.setHashIds(hashids)

    if (message.info.type === 'omnivore') {
      return message.info.data.map(item => ({
        target_url: item.url,
        thumbnail: item.thumbnail,
        description: item.description,
        tags: item.labels,
        target_title: item.title,
        is_archive: false
      }))
    } else if (message.info.type === 'pocket') {
      return message.info.data.map(item => ({
        target_url: !!item.url && item.url && item.url.length > 0 ? item.url : '',
        thumbnail: '',
        description: '',
        tags: !!item.tags && item.tags && item.tags.length > 0 ? item.tags.split('|') : [],
        target_title: !!item.title && item.title && item.title.length > 0 ? item.title : '',
        is_archive: !!item && item.status === 'archive' ? true : false
      }))
    } else {
      onFaild(`import bookmark type not match: ${message.info.type}`)
      return []
    }
  }
}

import { inject, singleton } from '../../decorators/di'
import { VECTORIZE_CLIENTS } from '../../const/symbol'
import type { LazyInstance } from '../../decorators/lazy'

@singleton()
export class VectorizeRepo {
  constructor(@inject(VECTORIZE_CLIENTS) private vectorize: LazyInstance<VectorizeIndex[]>) {}

  async upsertVector(bookmarkId: number, shardIdx: number, shardList: { vecId: string; vector: number[] }[]) {
    if (shardIdx < 0 || shardIdx > this.vectorize().length) return
    const vectorize = this.vectorize()[shardIdx]
    try {
      return await vectorize.upsert(
        shardList.map(item => ({
          id: item.vecId,
          values: item.vector,
          metadata: {
            bookmark_id: bookmarkId
          }
        }))
      )
    } catch (e) {
      console.log(e, 'upsertVector error')
      return []
    }
  }

  async deleteVector(bookmarkId: number, bucketIdx: number) {
    const vectorize = this.vectorize()[bucketIdx]
    const ids = Array.from({ length: 10 }, (_, idx) => `${bookmarkId}_${idx}`)
    await vectorize.deleteByIds(ids)
  }

  async seachVector(searchContent: number[], userBookmarkIds: number[], shardIdx: number): Promise<VectorizeMatches | []> {
    const t1 = performance.now()
    if (userBookmarkIds.length < 1) {
      console.log('no user bookmark ids')
      return []
    }
    if (searchContent.length < 1) {
      console.log('no search content')
      return []
    }
    if (shardIdx < 0 || shardIdx > this.vectorize().length) {
      console.log('invalid shard idx')
      return []
    }

    const vectorize = this.vectorize()[shardIdx]
    const res = await vectorize.query(searchContent, {
      topK: 30,
      filter: { bookmark_id: { $in: userBookmarkIds } } as any
    })
    const t2 = performance.now()
    console.log(`seachVector time: ${t2 - t1}ms`)
    return res
  }
}

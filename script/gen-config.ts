import Cloudflare from 'cloudflare'

const config = {
  d1_databases: [
    {
      name: 'slax-reader-backend',
      binding: 'DB',
      migrations_dir: '../migrations',
      id: '',
      preview_id: ''
    },
    {
      name: 'slax-reader-backend-fulltext',
      binding: 'DB_FULLTEXT',
      migrations_dir: '../migrations/fulltext',
      id: '',
      preview_id: ''
    }
  ],

  r2_buckets: [
    { name: 'slax-reader-backend', binding: 'OSS' },
    { name: 'slax-reader-backend-preview', binding: 'OSS_PREVIEW' }
  ],

  vectorize_indexes: [
    {
      name: 'bookmark-1',
      binding: 'VECTORIZE1',
      dimensions: 1024,
      metric: 'cosine'
    },
    { name: 'bookmark-2', binding: 'VECTORIZE2', dimensions: 1024, metric: 'cosine' },
    { name: 'bookmark-3', binding: 'VECTORIZE3', dimensions: 1024, metric: 'cosine' },
    { name: 'bookmark-4', binding: 'VECTORIZE4', dimensions: 1024, metric: 'cosine' },
    { name: 'bookmark-5', binding: 'VECTORIZE5', dimensions: 1024, metric: 'cosine' }
  ],

  queues: [
    {
      name: 'slax-reader-parser-twitter',
      binding: 'TWITTER_PARSER',
      consumer_options: {
        max_batch_size: 10,
        max_concurrency: 2,
        max_batch_timeout: 5,
        max_retries: 0
      }
    },
    {
      name: 'slax-reader-parser-fetch-retry-prod',
      binding: 'FETCH_RETRY_PARSER',
      consumer_options: {
        max_batch_size: 12,
        max_batch_timeout: 6,
        max_retries: 0
      }
    },
    {
      name: 'slax-reader-migrate-from-other',
      binding: 'IMPORT_OTHER',
      consumer_options: {
        max_batch_size: 1,
        max_concurrency: 10,
        max_batch_timeout: 0,
        max_retries: 0
      }
    }
  ],

  kv_namespaces: [{ name: 'slax-read-backend', binding: 'KV', id: '' }]
}

const api = {
  email: process.env.CLOUDFLARE_EMAIL,
  apiKey: process.env.CLOUDFLARE_API_KEY,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID
}

const client = new Cloudflare({
  apiEmail: api.email,
  apiKey: api.apiKey
})

class ResourceManager {
  constructor(private accountId: string) {
    if (!accountId) {
      throw new Error('Account ID is required')
    }
    this.accountId = accountId
  }

  async initializeAll() {
    await Promise.all([this.initializeD1Databases(), this.initializeR2Buckets(), this.initializeVectorizeIndexes(), this.initializeQueues(), this.initializeKVNamespaces()])
  }

  async initializeD1Databases() {
    const existingDatabases = await client.d1.database.list({
      account_id: this.accountId
    })

    for (const db of config.d1_databases) {
      const existing = existingDatabases.result.find(d => d.name === db.name)

      if (existing) {
        db.id = existing.uuid!
        console.log(`✅ existing ${db.name} (${db.binding}) - ID: ${db.id}`)
      } else {
        const newDb = await client.d1.database.create({
          account_id: this.accountId,
          name: db.name,
          primary_location_hint: 'apac'
        })
        db.id = newDb.uuid!
        console.log(`🔧 create ${db.name} (${db.binding}) - ID: ${db.id}`)
      }
    }
  }

  async initializeR2Buckets() {
    const existingBuckets = await client.r2.buckets.list({
      account_id: this.accountId
    })

    for (const bucket of config.r2_buckets) {
      const existing = existingBuckets.buckets?.find(b => b.name === bucket.name)

      if (existing) {
        console.log(`✅ existing ${bucket.name} (${bucket.binding})`)
      } else {
        await client.r2.buckets.create({
          account_id: this.accountId,
          name: bucket.name
        })
        console.log(`🔧 create ${bucket.name} (${bucket.binding})`)
      }
    }
  }

  async initializeVectorizeIndexes() {
    const existingIndexes = await client.vectorize.indexes.list({
      account_id: this.accountId
    })

    for (const index of config.vectorize_indexes) {
      const existing = existingIndexes.result.find(i => i.name === index.name)

      if (existing) {
        console.log(`✅ existing ${index.name} (${index.binding})`)
      } else {
        await client.vectorize.indexes.create({
          account_id: this.accountId,
          name: index.name,
          config: {
            dimensions: 1024,
            metric: 'cosine'
          }
        })
        console.log(`🔧 create ${index.name} (${index.binding})`)
        await client.vectorize.indexes.metadataIndex.create('', {
          account_id: this.accountId,
          indexType: 'number',
          propertyName: 'bookmark_id'
        })
        console.log(`🔧 create metadata index ${index.name}.bookmark_id`)
      }
    }
  }

  async initializeQueues() {
    const existingQueues = await client.queues.list({
      account_id: this.accountId
    })

    for (const queue of config.queues) {
      const existing = existingQueues.result?.find(q => q.queue_name === queue.name)

      if (existing) {
        console.log(`✅ existing ${queue.name} (${queue.binding})`)
      } else {
        await client.queues.create({
          account_id: this.accountId,
          queue_name: queue.name
        })
        console.log(`🔧 create queue ${queue.name} (${queue.binding})`)
      }
    }
  }

  async initializeKVNamespaces() {
    const existingNamespaces = await client.kv.namespaces.list({
      account_id: this.accountId
    })

    for (const ns of config.kv_namespaces) {
      const existing = existingNamespaces.result.find(n => n.title === ns.name)

      if (existing) {
        ns.id = existing.id
        console.log(`✅ existing ${ns.name} (${ns.binding}) - ID: ${ns.id}`)
      } else {
        const newNS = await client.kv.namespaces.create({
          account_id: this.accountId,
          title: ns.name
        })
        ns.id = newNS.id
        console.log(`🔧 create kv namespace ${ns.name} (${ns.binding}) - ID: ${ns.id}`)
      }
    }
  }

  generateWranglerConfig() {
    const parts: string[] = []

    config.d1_databases.forEach(db => {
      parts.push(`[[d1_databases]]`)
      parts.push(`binding = "${db.binding}"`)
      parts.push(`database_name = "${db.name}"`)
      if (db.id) parts.push(`database_id = "${db.id}"`)
      if (db.preview_id) parts.push(`preview_database_id = "${db.preview_id}"`)
      if (db.migrations_dir) parts.push(`migrations_dir = "${db.migrations_dir}"`)
      parts.push('')
    })

    config.r2_buckets.forEach(bucket => {
      parts.push(`[[r2_buckets]]`)
      parts.push(`binding = "${bucket.binding}"`)
      parts.push(`bucket_name = "${bucket.name}"`)
      parts.push('')
    })

    config.vectorize_indexes.forEach(index => {
      parts.push(`[[vectorize]]`)
      parts.push(`binding = "${index.binding}"`)
      parts.push(`index_name = "${index.name}"`)
      parts.push('')
    })

    config.queues.forEach(queue => {
      parts.push(`[[queues.consumers]]`)
      parts.push(`queue = "${queue.name}"`)
      if (queue.consumer_options?.max_batch_size) parts.push(`max_batch_size = ${queue.consumer_options.max_batch_size}`)
      if (queue.consumer_options?.max_concurrency) parts.push(`max_concurrency = ${queue.consumer_options.max_concurrency}`)
      if (queue.consumer_options?.max_batch_timeout !== undefined) parts.push(`max_batch_timeout = ${queue.consumer_options.max_batch_timeout}`)
      if (queue.consumer_options?.max_retries !== undefined) parts.push(`max_retries = ${queue.consumer_options.max_retries}`)
      parts.push('')
    })

    config.queues.forEach(queue => {
      parts.push(`[[queues.producers]]`)
      parts.push(`queue = "${queue.name}"`)
      parts.push(`binding = "${queue.binding}"`)
      parts.push('')
    })

    config.kv_namespaces.forEach(ns => {
      parts.push(`[[kv_namespaces]]`)
      parts.push(`binding = "${ns.binding}"`)
      parts.push(`id = "${ns.id}"`)
      parts.push('')
    })

    return parts.join('\n')
  }
}

async function main() {
  if (!api.email || !api.apiKey || !api.accountId) {
    console.error('Error: must set CLOUDFLARE_EMAIL, CLOUDFLARE_API_KEY and CLOUDFLARE_ACCOUNT_ID environment variables')
    return
  }

  try {
    const manager = new ResourceManager(api.accountId)
    await manager.initializeAll()

    console.log('\n=== generated Wrangler config ===')
    console.log(manager.generateWranglerConfig())
  } catch (error) {
    console.error('Error:', error)
  }
}

main()

import 'dotenv/config'
import type { PrismaConfig } from 'prisma'
import { env } from 'prisma/config'

export default {
  schema: './hyperdrive.prisma',
  migrations: {
    path: './migrations'
  },
  datasource: {
    url: env('HYPERDRIVE_DATABASE_URL')
  }
} satisfies PrismaConfig

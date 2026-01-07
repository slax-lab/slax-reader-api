import 'dotenv/config'
import type { PrismaConfig } from 'prisma'

export default {
  schema: './schema.prisma',
  migrations: {
    path: './d1_migrations',
    seed: 'tsx prisma/seed.ts'
  }
} satisfies PrismaConfig

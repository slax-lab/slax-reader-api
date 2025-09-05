import { inject, injectable } from '../../decorators/di'
import { PRISIMA_HYPERDRIVE_CLIENT } from '../../const/symbol'
import type { LazyInstance } from '../../decorators/lazy'
import { PrismaClient as HyperdrivePrismaClient } from '@prisma/hyperdrive-client'
import { PrismaClient } from '@prisma/client'

export interface reportPO {
  user_id: number
  content: string
  bookmark_id?: number
  created_at?: Date
  type: reportType
}

export enum reportType {
  PARSE_ERROR = 'parse_error',
  LOSS_FUNCTION = 'loss_function',
  LIKE = 'like',
  BUG = 'bug',
  OTHER = 'other'
}

@injectable()
export class ReportRepo {
  constructor(
    @inject(PRISIMA_HYPERDRIVE_CLIENT) private prisma: LazyInstance<PrismaClient>,
    @inject(PRISIMA_HYPERDRIVE_CLIENT) private prismaHyperdrive: LazyInstance<HyperdrivePrismaClient>
  ) {}

  public async saveReport(po: reportPO) {
    return await this.prisma().slax_user_report.create({ data: { ...po, created_at: new Date() } })
  }

  public async getReportDetail(reportId: number) {
    return await this.prisma().slax_user_report.findFirst({ where: { id: reportId } })
  }
}

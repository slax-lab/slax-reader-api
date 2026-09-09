import { inject, injectable } from '../decorators/di'
import { LabRepo } from '../infra/repository/dbLab'
import { ErrorName, ErrorParam, LabFeatureDisabledError } from '../const/err'
import { MultiLangError, Language } from '../utils/multiLangError'
import { ContextManager } from '../utils/context'

export type LabFeatureStatus = 'active' | 'graduated' | 'retired'

export interface LabFeatureDef {
  status: LabFeatureStatus
  /** Display name per language, spliced into the "still in Labs" error message */
  name: { [lang in Language]?: string }
  /** ISO date the feature left Labs; the settings page hides graduated rows after a while */
  graduatedAt?: string
}

export interface LabFeatureItem {
  key: string
  status: Exclude<LabFeatureStatus, 'retired'>
  enabled: boolean
  enabled_at: string | null
}

/**
 * Labs: per-user switches for features that are still being tried out.
 *
 * The registry is empty in the open-source build. A hosted backend subclasses this
 * service and overrides `features()` (and `gatedFeatureForUrl()` to block saves).
 */
@injectable()
export class LabService {
  constructor(@inject(LabRepo) private labRepo: LabRepo) {}

  /** Feature registry. Keys are what clients send as `lab:<key>`. */
  protected features(): Record<string, LabFeatureDef> {
    return {}
  }

  /** Which Labs feature (if any) a save of this URL needs. null = not gated. */
  protected gatedFeatureForUrl(_url: string): string | null {
    return null
  }

  /** Rows for the settings page: active and graduated only. */
  public async listForUser(userId: number): Promise<LabFeatureItem[]> {
    const defs = this.features()
    const keys = Object.keys(defs).filter(key => defs[key].status !== 'retired')
    if (keys.length === 0) return []

    const rows = await this.labRepo.listByUser(userId)
    const byKey = new Map(rows.map(row => [row.feature, row]))

    return keys.map(key => {
      const def = defs[key]
      const row = byKey.get(key)
      const enabled = def.status === 'graduated' ? true : (row?.enabled ?? false)
      return {
        key,
        status: def.status as Exclude<LabFeatureStatus, 'retired'>,
        enabled,
        enabled_at: row?.enabled ? row.updated_at.toISOString() : null
      }
    })
  }

  /** Unknown or retired keys are rejected; graduated ones are written but never read. */
  public async setEnabled(userId: number, key: string, enabled: boolean): Promise<void> {
    const def = this.features()[key]
    if (!def || def.status === 'retired') throw ErrorParam()
    await this.labRepo.upsert(userId, key, enabled)
  }

  public async isEnabled(userId: number, key: string): Promise<boolean> {
    const def = this.features()[key]
    if (!def || def.status === 'retired') return false
    if (def.status === 'graduated') return true
    return this.labRepo.isEnabled(userId, key)
  }

  /** Throws LAB_FEATURE_DISABLED when the URL needs a Labs feature the user has not turned on. */
  public async assertUrlAllowed(ctx: ContextManager, url: string): Promise<void> {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return // invalid URLs are reported by the existing save logic
    }
    const key = this.gatedFeatureForUrl(parsed.toString())
    if (!key) return
    if (!(await this.isEnabled(ctx.getUserId(), key))) throw this.disabledError(key)
  }

  public disabledError(key: string): MultiLangError {
    return LabFeatureDisabledError(this.features()[key]?.name ?? { en: key })
  }

  public static isLabDisabledError(e: unknown): boolean {
    return e instanceof MultiLangError && e.name === ErrorName.LAB_FEATURE_DISABLED
  }
}

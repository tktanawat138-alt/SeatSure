export type DoraLevel = 'elite' | 'high' | 'medium' | 'low'
export type DoraMetricKey = 'deploymentFrequency' | 'leadTime' | 'changeFailureRate' | 'timeToRestore'
export type Trend = 'better' | 'worse' | 'flat'
export type DensityTone = 'ok' | 'warn' | 'bad'
export type DefectSeverity = 'critical' | 'major' | 'minor'

export interface Deployment {
  id: string
  deployedAt: string
  leadTimeHours: number
  failed: boolean
  restoreMinutes: number | null
}

export interface Defect {
  id: string
  moduleId: string
  severity: DefectSeverity
  foundAt: string
}

export interface CodeModule {
  id: string
  name: string
  risk: string | null
  kloc: number
}

/** Raw records for one reporting period. Dates are 'YYYY-MM-DD', both inclusive; periodStart is a Monday. */
export interface QualityRecords {
  periodStart: string
  periodEnd: string
  isSample: boolean
  deployments: Deployment[]
  defects: Defect[]
  modules: CodeModule[]
}

/** value covers the later half of the period, previous the earlier half. null means no data, never 0. */
export interface DoraMetric {
  key: DoraMetricKey
  value: number | null
  previous: number | null
  level: DoraLevel | null
  trend: Trend | null
}

export interface DoraWeek {
  weekStart: string
  deployments: number
  leadTimeHours: number | null
  changeFailureRate: number | null
  restoreMinutes: number | null
}

export interface DensityRow {
  kloc: number
  defects: number
  density: number | null
  tone: DensityTone | null
}

export interface ModuleDensity extends DensityRow {
  moduleId: string
  name: string
  risk: string | null
}

export interface QualityDashboard {
  periodStart: string
  periodEnd: string
  isSample: boolean
  /** Always four, in DoraMetricKey order. */
  dora: DoraMetric[]
  weeks: DoraWeek[]
  modules: ModuleDensity[]
  overall: DensityRow
}

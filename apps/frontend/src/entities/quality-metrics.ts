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

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** Levels adapted from the 2023 State of DevOps report. null in, null out. */
export function doraLevel(key: DoraMetricKey, value: number | null): DoraLevel | null {
  if (value === null) return null
  switch (key) {
    case 'deploymentFrequency': // per week
      return value >= 7 ? 'elite' : value >= 1 ? 'high' : value >= 0.25 ? 'medium' : 'low'
    case 'leadTime': // hours
      return value < 24 ? 'elite' : value < 168 ? 'high' : value < 720 ? 'medium' : 'low'
    case 'changeFailureRate': // percent
      return value <= 5 ? 'elite' : value <= 10 ? 'high' : value <= 15 ? 'medium' : 'low'
    case 'timeToRestore': // minutes
      return value < 60 ? 'elite' : value < 1440 ? 'high' : value < 10080 ? 'medium' : 'low'
  }
}

/** A relative change under 5% is flat. Higher is better only for deploymentFrequency. */
export function trendOf(key: DoraMetricKey, current: number | null, previous: number | null): Trend | null {
  if (current === null || previous === null) return null
  const flat = previous === 0 ? current === 0 : Math.abs(current - previous) / Math.abs(previous) < 0.05
  if (flat) return 'flat'
  const higherIsBetter = key === 'deploymentFrequency'
  return current > previous === higherIsBetter ? 'better' : 'worse'
}

/** The project's own targets: up to 1 defect per KLOC is ok, up to 2 is warn. */
export function densityTone(density: number | null): DensityTone | null {
  if (density === null) return null
  return density <= 1 ? 'ok' : density <= 2 ? 'warn' : 'bad'
}

/** UTC milliseconds. A date-time without a zone is read as UTC, never as local time. */
function utcMs(value: string): number {
  const needsZone = value.includes('T') && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)
  return Date.parse(needsZone ? `${value}Z` : value)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The three figures a set of deployments gives on its own; null where it has nothing to compute from. */
function deploymentFigures(deployments: Deployment[]) {
  const failed = deployments.filter((d) => d.failed)
  return {
    leadTimeHours: median(deployments.map((d) => d.leadTimeHours)),
    changeFailureRate: deployments.length > 0 ? (failed.length / deployments.length) * 100 : null,
    restoreMinutes: median(failed.flatMap((d) => (d.restoreMinutes === null ? [] : [d.restoreMinutes]))),
  }
}

function doraMetric(key: DoraMetricKey, value: number | null, previous: number | null): DoraMetric {
  return { key, value, previous, level: doraLevel(key, value), trend: trendOf(key, value, previous) }
}

function densityRow(kloc: number, defects: number): DensityRow {
  const density = kloc > 0 ? defects / kloc : null
  return { kloc, defects, density, tone: densityTone(density) }
}

export function buildQualityDashboard(records: QualityRecords): QualityDashboard {
  const start = utcMs(records.periodStart)
  const end = utcMs(records.periodEnd)
  const days = (end - start) / DAY_MS + 1
  const midpoint = start + (days / 2) * DAY_MS
  const weeksPerHalf = days / 2 / 7

  const timed = records.deployments.map((deployment) => ({ deployment, at: utcMs(deployment.deployedAt) }))
  const earlier = timed.filter((t) => t.at < midpoint).map((t) => t.deployment)
  const later = timed.filter((t) => t.at >= midpoint).map((t) => t.deployment)
  const previous = deploymentFigures(earlier)
  const current = deploymentFigures(later)

  // No deployments in the whole period is "no data"; an empty half of a period that has some is a real 0.
  const hasFrequency = timed.length > 0 && weeksPerHalf > 0
  const frequency = doraMetric(
    'deploymentFrequency',
    hasFrequency ? later.length / weeksPerHalf : null,
    hasFrequency ? earlier.length / weeksPerHalf : null,
  )
  if (earlier.length === 0 || later.length === 0) frequency.trend = null

  const weeks: DoraWeek[] = []
  for (let weekStart = start; weekStart <= end; weekStart += WEEK_MS) {
    const inWeek = timed.filter((t) => t.at >= weekStart && t.at < weekStart + WEEK_MS).map((t) => t.deployment)
    weeks.push({
      weekStart: new Date(weekStart).toISOString().slice(0, 10),
      deployments: inWeek.length,
      ...deploymentFigures(inWeek),
    })
  }

  return {
    periodStart: records.periodStart,
    periodEnd: records.periodEnd,
    isSample: records.isSample,
    dora: [
      frequency,
      doraMetric('leadTime', current.leadTimeHours, previous.leadTimeHours),
      doraMetric('changeFailureRate', current.changeFailureRate, previous.changeFailureRate),
      doraMetric('timeToRestore', current.restoreMinutes, previous.restoreMinutes),
    ],
    weeks,
    modules: records.modules.map((module) => ({
      moduleId: module.id,
      name: module.name,
      risk: module.risk,
      ...densityRow(module.kloc, records.defects.filter((d) => d.moduleId === module.id).length),
    })),
    overall: densityRow(
      records.modules.reduce((sum, module) => sum + module.kloc, 0),
      records.defects.length,
    ),
  }
}

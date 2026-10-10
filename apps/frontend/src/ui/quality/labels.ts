import type { DensityTone, DoraLevel, DoraMetricKey, DoraWeek, Trend } from '@/entities/quality-metrics'

export const NOT_AVAILABLE = 'N/A'

const DAY_MS = 24 * 60 * 60 * 1000

const names: Record<DoraMetricKey, string> = {
  deploymentFrequency: 'Deployment Frequency',
  leadTime: 'Lead Time for Changes',
  changeFailureRate: 'Change Failure Rate',
  timeToRestore: 'Time to Restore',
}

const meanings: Record<DoraMetricKey, string> = {
  deploymentFrequency: 'ความถี่ในการนำระบบขึ้นใช้งาน',
  leadTime: 'เวลาตั้งแต่แก้โค้ดจนขึ้นใช้งาน',
  changeFailureRate: 'สัดส่วนการขึ้นระบบที่ทำให้เกิดปัญหา',
  timeToRestore: 'เวลาที่ใช้กู้ระบบเมื่อเกิดปัญหา',
}

const levels: Record<DoraLevel, { label: string; tone: DensityTone }> = {
  elite: { label: 'Elite', tone: 'ok' },
  high: { label: 'High', tone: 'ok' },
  medium: { label: 'Medium', tone: 'warn' },
  low: { label: 'Low', tone: 'bad' },
}

const trends: Record<Trend, string> = {
  better: 'ดีขึ้น',
  worse: 'แย่ลง',
  flat: 'คงที่',
}

const tones: Record<DensityTone, string> = {
  ok: 'อยู่ในเกณฑ์',
  warn: 'เฝ้าระวัง',
  bad: 'เกินเกณฑ์',
}

export const metricName = (key: DoraMetricKey) => names[key]
export const metricMeaning = (key: DoraMetricKey) => meanings[key]
export const levelLabel = (level: DoraLevel) => levels[level].label
/** The badge tone a DORA level is shown in. Elite and High both read as "ok"; the label tells them apart. */
export const levelTone = (level: DoraLevel) => levels[level].tone
export const trendLabel = (trend: Trend) => trends[trend]
export const toneLabel = (tone: DensityTone) => tones[tone]

const oneDecimal = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 })
const twoDecimals = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** At most one decimal: 2.5, 31, 1,200. */
export const formatNumber = (value: number) => oneDecimal.format(value)
export const formatKloc = (kloc: number) => twoDecimals.format(kloc)
export const formatDensity = (density: number | null) => (density === null ? NOT_AVAILABLE : twoDecimals.format(density))

export interface MetricScale {
  unit: string
  /** Divide the raw figure (hours, minutes) by this to get the figure in `unit`. */
  divisor: number
}

/**
 * The unit a metric is shown in. Lead time is stored in hours and restore time in minutes;
 * `reference` decides when they switch to the larger unit.
 */
export function metricScale(key: DoraMetricKey, reference: number): MetricScale {
  switch (key) {
    case 'deploymentFrequency':
      return { unit: 'ครั้ง/สัปดาห์', divisor: 1 }
    case 'leadTime':
      return reference < 48 ? { unit: 'ชั่วโมง', divisor: 1 } : { unit: 'วัน', divisor: 24 }
    case 'changeFailureRate':
      return { unit: '%', divisor: 1 }
    case 'timeToRestore':
      return reference < 120 ? { unit: 'นาที', divisor: 1 } : { unit: 'ชั่วโมง', divisor: 60 }
  }
}

/** A metric figure and its unit as shown on a card. No data gives "N/A" and no unit. */
export function formatMetric(key: DoraMetricKey, value: number | null): { text: string; unit: string } {
  if (value === null) return { text: NOT_AVAILABLE, unit: '' }
  const { unit, divisor } = metricScale(key, value)
  return { text: formatNumber(value / divisor), unit }
}

/** Weekly charts keep one unit for the whole series: the smaller one, which the cards also use for small figures. */
export const weeklyUnit = (key: DoraMetricKey) => metricScale(key, 0).unit

/** The weekly figure behind each metric, in the unit weeklyUnit() names. */
export function weeklyValue(key: DoraMetricKey, week: DoraWeek): number | null {
  switch (key) {
    case 'deploymentFrequency':
      return week.deployments
    case 'leadTime':
      return week.leadTimeHours
    case 'changeFailureRate':
      return week.changeFailureRate
    case 'timeToRestore':
      return week.restoreMinutes
  }
}

// Dates arrive as 'YYYY-MM-DD' and are read and shown in UTC, so the day never shifts with the viewer's time zone.
const utc = (date: string) => new Date(`${date}T00:00:00Z`)
const longDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'UTC' })
const shortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** 20 ก.ค. 2569 */
export const formatDate = (date: string) => longDate.format(utc(date))
/** 20 ก.ค. */
export const formatShortDate = (date: string) => shortDate.format(utc(date))

/** Whole period in weeks; both dates are inclusive. */
export const periodWeeks = (periodStart: string, periodEnd: string) =>
  ((utc(periodEnd).getTime() - utc(periodStart).getTime()) / DAY_MS + 1) / 7

export const periodText = (periodStart: string, periodEnd: string) =>
  `ช่วงข้อมูล ${formatDate(periodStart)} ถึง ${formatDate(periodEnd)} (${formatNumber(periodWeeks(periodStart, periodEnd))} สัปดาห์)`

/** Cards compare the later half of the period with the earlier half. */
export const comparisonText = (periodStart: string, periodEnd: string) =>
  `เทียบกับ ${formatNumber(periodWeeks(periodStart, periodEnd) / 2)} สัปดาห์ก่อนหน้า`

import { describe, expect, it } from 'vitest'
import { sampleQualityMetricsGateway } from '@/adaptor/sample/quality-metrics-gateway'
import {
  buildQualityDashboard,
  densityTone,
  doraLevel,
  trendOf,
  type Defect,
  type Deployment,
  type DoraMetric,
  type DoraMetricKey,
  type QualityDashboard,
  type QualityRecords,
} from '@/entities/quality-metrics'

function deployment(id: string, deployedAt: string, leadTimeHours: number, restoreMinutes?: number | null): Deployment {
  return { id, deployedAt, leadTimeHours, failed: restoreMinutes !== undefined, restoreMinutes: restoreMinutes ?? null }
}

function defect(id: string, moduleId: string): Defect {
  return { id, moduleId, severity: 'major', foundAt: '2026-06-10' }
}

// Four weeks from Monday 2026-06-01; the midpoint is 2026-06-15T00:00Z.
function records(overrides: Partial<QualityRecords> = {}): QualityRecords {
  return {
    periodStart: '2026-06-01',
    periodEnd: '2026-06-28',
    isSample: false,
    deployments: [],
    defects: [],
    modules: [
      { id: 'booking', name: 'Booking', risk: 'R1', kloc: 2 },
      { id: 'payment', name: 'Payment', risk: null, kloc: 1 },
    ],
    ...overrides,
  }
}

function metric(dashboard: QualityDashboard, key: DoraMetricKey): DoraMetric {
  const found = dashboard.dora.find((m) => m.key === key)
  if (!found) throw new Error(`no metric ${key}`)
  return found
}

const KEYS: DoraMetricKey[] = ['deploymentFrequency', 'leadTime', 'changeFailureRate', 'timeToRestore']

describe('doraLevel', () => {
  it.each([
    ['deploymentFrequency', 7, 'elite'],
    ['deploymentFrequency', 6.99, 'high'],
    ['deploymentFrequency', 1, 'high'],
    ['deploymentFrequency', 0.99, 'medium'],
    ['deploymentFrequency', 0.25, 'medium'],
    ['deploymentFrequency', 0.24, 'low'],
    ['deploymentFrequency', 0, 'low'],
    ['leadTime', 23.99, 'elite'],
    ['leadTime', 24, 'high'],
    ['leadTime', 167.99, 'high'],
    ['leadTime', 168, 'medium'],
    ['leadTime', 719.99, 'medium'],
    ['leadTime', 720, 'low'],
    ['changeFailureRate', 0, 'elite'],
    ['changeFailureRate', 5, 'elite'],
    ['changeFailureRate', 5.01, 'high'],
    ['changeFailureRate', 10, 'high'],
    ['changeFailureRate', 10.01, 'medium'],
    ['changeFailureRate', 15, 'medium'],
    ['changeFailureRate', 15.01, 'low'],
    ['timeToRestore', 59.99, 'elite'],
    ['timeToRestore', 60, 'high'],
    ['timeToRestore', 1439.99, 'high'],
    ['timeToRestore', 1440, 'medium'],
    ['timeToRestore', 10079.99, 'medium'],
    ['timeToRestore', 10080, 'low'],
  ] as const)('doraLevel %s at %d returns %s', (key, value, level) => {
    expect(doraLevel(key, value)).toBe(level)
  })

  it.each(KEYS)('doraLevel %s with no value returns null', (key) => {
    expect(doraLevel(key, null)).toBeNull()
  })
})

describe('trendOf', () => {
  it('trendOf deploymentFrequency going up returns better', () => {
    expect(trendOf('deploymentFrequency', 2, 1)).toBe('better')
  })

  it('trendOf deploymentFrequency going down returns worse', () => {
    expect(trendOf('deploymentFrequency', 1, 2)).toBe('worse')
  })

  it.each(['leadTime', 'changeFailureRate', 'timeToRestore'] as const)('trendOf %s going up returns worse', (key) => {
    expect(trendOf(key, 2, 1)).toBe('worse')
  })

  it.each(['leadTime', 'changeFailureRate', 'timeToRestore'] as const)('trendOf %s going down returns better', (key) => {
    expect(trendOf(key, 1, 2)).toBe('better')
  })

  it('trendOf a change under 5 percent returns flat', () => {
    expect(trendOf('leadTime', 10.2, 10)).toBe('flat')
    expect(trendOf('leadTime', 96, 100)).toBe('flat')
    expect(trendOf('deploymentFrequency', 104, 100)).toBe('flat')
  })

  it('trendOf a change of exactly 5 percent is not flat', () => {
    expect(trendOf('leadTime', 105, 100)).toBe('worse')
    expect(trendOf('leadTime', 95, 100)).toBe('better')
    expect(trendOf('deploymentFrequency', 105, 100)).toBe('better')
  })

  it('trendOf from a previous value of 0 returns flat only when the current value is 0', () => {
    expect(trendOf('changeFailureRate', 0, 0)).toBe('flat')
    expect(trendOf('changeFailureRate', 10, 0)).toBe('worse')
    expect(trendOf('deploymentFrequency', 1, 0)).toBe('better')
  })

  it('trendOf with a missing value returns null', () => {
    expect(trendOf('leadTime', null, 10)).toBeNull()
    expect(trendOf('leadTime', 10, null)).toBeNull()
    expect(trendOf('deploymentFrequency', null, null)).toBeNull()
  })
})

describe('densityTone', () => {
  it.each([
    [0, 'ok'],
    [1, 'ok'],
    [1.01, 'warn'],
    [2, 'warn'],
    [2.01, 'bad'],
  ] as const)('densityTone at %d returns %s', (density, tone) => {
    expect(densityTone(density)).toBe(tone)
  })

  it('densityTone with no density returns null', () => {
    expect(densityTone(null)).toBeNull()
  })
})

describe('buildQualityDashboard', () => {
  // Earlier half: 4 deployments, 1 failed. Later half: 6 deployments, 3 failed, one of them not restored yet.
  const fourWeeks = records({
    deployments: [
      deployment('a', '2026-06-02T03:00:00Z', 40, 100),
      deployment('b', '2026-06-04T03:00:00Z', 60),
      deployment('c', '2026-06-09T03:00:00Z', 20),
      deployment('d', '2026-06-11T03:00:00Z', 80),
      deployment('e', '2026-06-15T00:00:00Z', 10),
      deployment('f', '2026-06-16T03:00:00Z', 30, 30),
      deployment('g', '2026-06-18T03:00:00Z', 12),
      deployment('h', '2026-06-22T03:00:00Z', 20),
      deployment('i', '2026-06-24T03:00:00Z', 14, 50),
      deployment('j', '2026-06-26T03:00:00Z', 50, null),
    ],
  })

  it('buildQualityDashboard on any records returns the period, the sample flag and the four metrics in order', () => {
    const dashboard = buildQualityDashboard(records({ isSample: true }))

    expect(dashboard.periodStart).toBe('2026-06-01')
    expect(dashboard.periodEnd).toBe('2026-06-28')
    expect(dashboard.isSample).toBe(true)
    expect(dashboard.dora.map((m) => m.key)).toEqual(KEYS)
  })

  it('buildQualityDashboard on a four week period returns deployments per week for each half', () => {
    expect(metric(buildQualityDashboard(fourWeeks), 'deploymentFrequency')).toEqual({
      key: 'deploymentFrequency',
      value: 3,
      previous: 2,
      level: 'high',
      trend: 'better',
    })
  })

  it('buildQualityDashboard with an even number of lead times returns the mean of the two middle values', () => {
    expect(metric(buildQualityDashboard(fourWeeks), 'leadTime')).toEqual({
      key: 'leadTime',
      value: 17,
      previous: 50,
      level: 'elite',
      trend: 'better',
    })
  })

  it('buildQualityDashboard with more failures in the later half returns a worse change failure rate', () => {
    expect(metric(buildQualityDashboard(fourWeeks), 'changeFailureRate')).toEqual({
      key: 'changeFailureRate',
      value: 50,
      previous: 25,
      level: 'low',
      trend: 'worse',
    })
  })

  it('buildQualityDashboard with a failed deployment not restored yet leaves it out of time to restore', () => {
    expect(metric(buildQualityDashboard(fourWeeks), 'timeToRestore')).toEqual({
      key: 'timeToRestore',
      value: 40,
      previous: 100,
      level: 'elite',
      trend: 'better',
    })
  })

  it('buildQualityDashboard on a four week period returns one row per week starting on periodStart', () => {
    const { weeks } = buildQualityDashboard(fourWeeks)

    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22'])
    expect(weeks.map((w) => w.deployments)).toEqual([2, 2, 3, 3])
    expect(weeks.map((w) => w.leadTimeHours)).toEqual([50, 50, 12, 20])
    expect(weeks.map((w) => w.restoreMinutes)).toEqual([100, null, 30, 50])
    expect(weeks[0].changeFailureRate).toBe(50)
    expect(weeks[1].changeFailureRate).toBe(0)
    expect(weeks[2].changeFailureRate).toBeCloseTo(33.333, 3)
    expect(weeks[3].changeFailureRate).toBeCloseTo(66.667, 3)
  })

  it('buildQualityDashboard with a period that ends mid week still returns a row for the last week', () => {
    const { weeks } = buildQualityDashboard(records({ periodEnd: '2026-06-15' }))

    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-06-01', '2026-06-08', '2026-06-15'])
  })

  it('buildQualityDashboard with a deployment just before the midpoint in UTC counts it in the earlier half', () => {
    const dashboard = buildQualityDashboard(
      records({
        deployments: [
          deployment('late-sunday', '2026-06-14T23:59:59Z', 10),
          deployment('monday', '2026-06-15T00:00:00Z', 30),
          deployment('date-only', '2026-06-15', 50),
        ],
      }),
    )

    expect(metric(dashboard, 'leadTime')).toMatchObject({ value: 40, previous: 10 })
    expect(dashboard.weeks.map((w) => w.deployments)).toEqual([0, 1, 2, 0])
  })

  it('buildQualityDashboard with no deployments returns null for every value, level and trend', () => {
    const dashboard = buildQualityDashboard(records())

    expect(dashboard.dora).toEqual(KEYS.map((key) => ({ key, value: null, previous: null, level: null, trend: null })))
    expect(dashboard.weeks).toEqual(
      ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22'].map((weekStart) => ({
        weekStart,
        deployments: 0,
        leadTimeHours: null,
        changeFailureRate: null,
        restoreMinutes: null,
      })),
    )
  })

  it('buildQualityDashboard with deployments but none failed returns a 0 percent elite failure rate and no time to restore', () => {
    const dashboard = buildQualityDashboard(
      records({
        deployments: [deployment('a', '2026-06-03T03:00:00Z', 30), deployment('b', '2026-06-17T03:00:00Z', 30)],
      }),
    )

    expect(metric(dashboard, 'changeFailureRate')).toEqual({
      key: 'changeFailureRate',
      value: 0,
      previous: 0,
      level: 'elite',
      trend: 'flat',
    })
    expect(metric(dashboard, 'timeToRestore')).toEqual({
      key: 'timeToRestore',
      value: null,
      previous: null,
      level: null,
      trend: null,
    })
    expect(dashboard.weeks.map((w) => w.changeFailureRate)).toEqual([0, null, 0, null])
    expect(dashboard.weeks.map((w) => w.restoreMinutes)).toEqual([null, null, null, null])
  })

  it('buildQualityDashboard with deployments only in the later half returns a null trend for every metric', () => {
    const dashboard = buildQualityDashboard(
      records({
        deployments: [deployment('a', '2026-06-16T03:00:00Z', 30, 45), deployment('b', '2026-06-23T03:00:00Z', 50)],
      }),
    )

    expect(dashboard.dora.map((m) => m.trend)).toEqual([null, null, null, null])
    expect(metric(dashboard, 'deploymentFrequency')).toMatchObject({ value: 1, previous: 0, level: 'high' })
    expect(metric(dashboard, 'leadTime')).toMatchObject({ value: 40, previous: null, level: 'high' })
    expect(metric(dashboard, 'changeFailureRate')).toMatchObject({ value: 50, previous: null, level: 'low' })
    expect(metric(dashboard, 'timeToRestore')).toMatchObject({ value: 45, previous: null, level: 'elite' })
  })

  it('buildQualityDashboard with deployments only in the earlier half returns a 0 low frequency and a null trend', () => {
    const dashboard = buildQualityDashboard(
      records({ deployments: [deployment('a', '2026-06-03T03:00:00Z', 30, 45)] }),
    )

    expect(dashboard.dora.map((m) => m.trend)).toEqual([null, null, null, null])
    expect(metric(dashboard, 'deploymentFrequency')).toMatchObject({ value: 0, previous: 0.5, level: 'low' })
    expect(metric(dashboard, 'leadTime')).toMatchObject({ value: null, previous: 30, level: null })
    expect(metric(dashboard, 'changeFailureRate')).toMatchObject({ value: null, previous: 100, level: null })
    expect(metric(dashboard, 'timeToRestore')).toMatchObject({ value: null, previous: 45, level: null })
  })

  it('buildQualityDashboard with defects returns density and tone per module in module order', () => {
    const dashboard = buildQualityDashboard(
      records({
        defects: [defect('1', 'payment'), defect('2', 'booking'), defect('3', 'payment'), defect('4', 'payment')],
      }),
    )

    expect(dashboard.modules).toEqual([
      { moduleId: 'booking', name: 'Booking', risk: 'R1', kloc: 2, defects: 1, density: 0.5, tone: 'ok' },
      { moduleId: 'payment', name: 'Payment', risk: null, kloc: 1, defects: 3, density: 3, tone: 'bad' },
    ])
    expect(dashboard.overall.kloc).toBe(3)
    expect(dashboard.overall.defects).toBe(4)
    expect(dashboard.overall.density).toBeCloseTo(1.3333, 4)
    expect(dashboard.overall.tone).toBe('warn')
  })

  it('buildQualityDashboard with a defect in an unknown module counts it in overall and in no module row', () => {
    const dashboard = buildQualityDashboard(records({ defects: [defect('1', 'booking'), defect('2', 'reporting')] }))

    expect(dashboard.modules.map((m) => m.defects)).toEqual([1, 0])
    expect(dashboard.modules.map((m) => m.moduleId)).toEqual(['booking', 'payment'])
    expect(dashboard.overall).toEqual({ kloc: 3, defects: 2, density: 2 / 3, tone: 'ok' })
  })

  it('buildQualityDashboard with a module of 0 KLOC returns null density and tone for it', () => {
    const dashboard = buildQualityDashboard(
      records({
        modules: [{ id: 'empty', name: 'Empty', risk: null, kloc: 0 }],
        defects: [defect('1', 'empty')],
      }),
    )

    expect(dashboard.modules).toEqual([
      { moduleId: 'empty', name: 'Empty', risk: null, kloc: 0, defects: 1, density: null, tone: null },
    ])
    expect(dashboard.overall).toEqual({ kloc: 0, defects: 1, density: null, tone: null })
  })

  it('buildQualityDashboard with no defects returns a density of 0, not null', () => {
    const dashboard = buildQualityDashboard(records())

    expect(dashboard.modules.map((m) => m.density)).toEqual([0, 0])
    expect(dashboard.modules.map((m) => m.tone)).toEqual(['ok', 'ok'])
    expect(dashboard.overall).toEqual({ kloc: 3, defects: 0, density: 0, tone: 'ok' })
  })

  it('buildQualityDashboard leaves the records it was given unchanged', () => {
    const input = records({
      deployments: [deployment('a', '2026-06-03T03:00:00Z', 90), deployment('b', '2026-06-04T03:00:00Z', 10)],
    })
    const before = structuredClone(input)

    buildQualityDashboard(input)

    expect(input).toEqual(before)
  })
})

// The sample adaptor has no I/O, so the story it must tell is checked here against the real rules.
describe('sample quality records', () => {
  it('sample records cover the 12 week period with the four modules from the spec', async () => {
    const sample = await sampleQualityMetricsGateway.loadRecords()

    expect(sample.periodStart).toBe('2026-07-20')
    expect(sample.periodEnd).toBe('2026-10-11')
    expect(sample.isSample).toBe(true)
    expect(sample.modules).toEqual([
      { id: 'booking', name: 'จองที่นั่ง', risk: 'R1', kloc: 1.2 },
      { id: 'payment', name: 'ชำระเงิน', risk: 'R2', kloc: 1.35 },
      { id: 'access', name: 'สิทธิ์เข้าถึง', risk: null, kloc: 0.95 },
      { id: 'admin', name: 'จัดการคอร์ส', risk: null, kloc: 1.25 },
    ])
  })

  it('sample records have unique ids, dates inside the period and defects in known modules', async () => {
    const sample = await sampleQualityMetricsGateway.loadRecords()
    const from = Date.parse('2026-07-20T00:00:00Z')
    const until = Date.parse('2026-10-12T00:00:00Z')
    const inPeriod = (value: string) => Date.parse(value) >= from && Date.parse(value) < until
    const moduleIds = sample.modules.map((m) => m.id)

    expect(new Set(sample.deployments.map((d) => d.id)).size).toBe(sample.deployments.length)
    expect(new Set(sample.defects.map((d) => d.id)).size).toBe(sample.defects.length)
    expect(sample.deployments.filter((d) => !inPeriod(d.deployedAt))).toEqual([])
    expect(sample.defects.filter((d) => !inPeriod(d.foundAt))).toEqual([])
    expect(sample.defects.filter((d) => !moduleIds.includes(d.moduleId))).toEqual([])
    expect(sample.deployments.filter((d) => d.failed !== (d.restoreMinutes !== null))).toEqual([])
  })

  it('sample records loaded twice return the same data', async () => {
    expect(await sampleQualityMetricsGateway.loadRecords()).toEqual(await sampleQualityMetricsGateway.loadRecords())
  })

  it('sample dashboard shows delivery improving on all four DORA metrics', async () => {
    const dashboard = buildQualityDashboard(await sampleQualityMetricsGateway.loadRecords())

    expect(dashboard.dora.map((m) => m.trend)).toEqual(['better', 'better', 'better', 'better'])
    expect(dashboard.dora.filter((m) => m.value === null || m.previous === null || m.level === null)).toEqual([])
    expect(metric(dashboard, 'deploymentFrequency')).toMatchObject({ value: 4, previous: 2, level: 'high' })
    expect(metric(dashboard, 'leadTime')).toMatchObject({ value: 20, previous: 56, level: 'elite' })
    expect(metric(dashboard, 'changeFailureRate')).toMatchObject({ value: 12.5, previous: 25, level: 'medium' })
    expect(metric(dashboard, 'timeToRestore')).toMatchObject({ value: 90, previous: 240, level: 'high' })
  })

  it('sample dashboard has 12 weekly rows and a deployment in every week', async () => {
    const { weeks } = buildQualityDashboard(await sampleQualityMetricsGateway.loadRecords())

    expect(weeks).toHaveLength(12)
    expect(weeks[0].weekStart).toBe('2026-07-20')
    expect(weeks[11].weekStart).toBe('2026-10-05')
    expect(weeks.filter((w) => w.deployments === 0)).toEqual([])
    expect(weeks.filter((w) => w.leadTimeHours === null || w.changeFailureRate === null)).toEqual([])
  })

  it('sample dashboard puts payment at the highest defect density', async () => {
    const dashboard = buildQualityDashboard(await sampleQualityMetricsGateway.loadRecords())
    const byId = Object.fromEntries(dashboard.modules.map((m) => [m.moduleId, m]))
    const highest = [...dashboard.modules].sort((a, b) => (b.density ?? 0) - (a.density ?? 0))[0]

    expect(dashboard.modules.map((m) => m.moduleId)).toEqual(['booking', 'payment', 'access', 'admin'])
    expect(byId.booking.tone).toBe('warn')
    expect(byId.payment.tone).toBe('bad')
    expect(byId.access.tone).toBe('ok')
    expect(byId.admin.tone).toBe('ok')
    expect(highest.moduleId).toBe('payment')
    expect(dashboard.overall.kloc).toBeCloseTo(4.75)
    expect(dashboard.overall.defects).toBe(dashboard.modules.reduce((sum, m) => sum + m.defects, 0))
    expect(dashboard.overall.tone).toBe('warn')
  })
})

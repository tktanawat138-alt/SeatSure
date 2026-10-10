import { describe, expect, it } from 'vitest'
import { buildQualityDashboard, type QualityRecords } from '@/entities/quality-metrics'
import type { QualityMetricsGateway } from '@/interfaces/quality-metrics-gateway'
import { createLoadQualityDashboard } from '@/use-cases/load-quality-dashboard'

const records: QualityRecords = {
  periodStart: '2026-06-01',
  periodEnd: '2026-06-28',
  isSample: false,
  deployments: [
    { id: 'a', deployedAt: '2026-06-03T03:00:00Z', leadTimeHours: 40, failed: true, restoreMinutes: 90 },
    { id: 'b', deployedAt: '2026-06-17T03:00:00Z', leadTimeHours: 20, failed: false, restoreMinutes: null },
  ],
  defects: [{ id: '1', moduleId: 'booking', severity: 'minor', foundAt: '2026-06-05' }],
  modules: [{ id: 'booking', name: 'Booking', risk: 'R1', kloc: 2 }],
}

describe('loadQualityDashboard', () => {
  it('loadQualityDashboard with records from the gateway resolves to the dashboard built from them', async () => {
    const gateway: QualityMetricsGateway = { loadRecords: () => Promise.resolve(records) }

    const dashboard = await createLoadQualityDashboard(gateway)()

    expect(dashboard).toEqual(buildQualityDashboard(records))
    expect(dashboard.overall.defects).toBe(1)
  })

  it('loadQualityDashboard with a gateway that fails rejects with the same error', async () => {
    const failure = new Error('gateway down')
    const gateway: QualityMetricsGateway = { loadRecords: () => Promise.reject(failure) }

    await expect(createLoadQualityDashboard(gateway)()).rejects.toBe(failure)
  })
})

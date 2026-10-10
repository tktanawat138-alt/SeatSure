import type { QualityRecords } from '@/entities/quality-metrics'
import type { QualityMetricsGateway } from '@/interfaces/quality-metrics-gateway'

// Fixed sample records for the quality dashboard: 12 weeks, split at 2026-08-31.
// Every figure on the page is computed from these by the entity rules, so a real
// adaptor (GitHub Actions, GitHub Issues, SonarQube) only has to return the same shape.
// Module sizes add up to 4.75 KLOC, the SonarQube ncloc on 2026-10-10. Times are UTC.
const records: QualityRecords = {
  periodStart: '2026-07-20',
  periodEnd: '2026-10-11',
  isSample: true,
  modules: [
    { id: 'booking', name: 'จองที่นั่ง', risk: 'R1', kloc: 1.2 },
    { id: 'payment', name: 'ชำระเงิน', risk: 'R2', kloc: 1.35 },
    { id: 'access', name: 'สิทธิ์เข้าถึง', risk: null, kloc: 0.95 },
    { id: 'admin', name: 'จัดการคอร์ส', risk: null, kloc: 1.25 },
  ],
  deployments: [
    // Earlier half: 12 deployments, 3 failed.
    { id: 'dep-01', deployedAt: '2026-07-23T08:40:00Z', leadTimeHours: 96, failed: false, restoreMinutes: null },
    { id: 'dep-02', deployedAt: '2026-07-28T07:15:00Z', leadTimeHours: 80, failed: true, restoreMinutes: 320 },
    { id: 'dep-03', deployedAt: '2026-07-31T09:05:00Z', leadTimeHours: 72, failed: false, restoreMinutes: null },
    { id: 'dep-04', deployedAt: '2026-08-04T06:30:00Z', leadTimeHours: 66, failed: false, restoreMinutes: null },
    { id: 'dep-05', deployedAt: '2026-08-06T08:20:00Z', leadTimeHours: 60, failed: false, restoreMinutes: null },
    { id: 'dep-06', deployedAt: '2026-08-11T07:45:00Z', leadTimeHours: 58, failed: true, restoreMinutes: 240 },
    { id: 'dep-07', deployedAt: '2026-08-14T09:30:00Z', leadTimeHours: 54, failed: false, restoreMinutes: null },
    { id: 'dep-08', deployedAt: '2026-08-17T06:10:00Z', leadTimeHours: 50, failed: false, restoreMinutes: null },
    { id: 'dep-09', deployedAt: '2026-08-20T08:55:00Z', leadTimeHours: 46, failed: true, restoreMinutes: 150 },
    { id: 'dep-10', deployedAt: '2026-08-24T07:00:00Z', leadTimeHours: 44, failed: false, restoreMinutes: null },
    { id: 'dep-11', deployedAt: '2026-08-26T08:35:00Z', leadTimeHours: 40, failed: false, restoreMinutes: null },
    { id: 'dep-12', deployedAt: '2026-08-28T09:15:00Z', leadTimeHours: 36, failed: false, restoreMinutes: null },
    // Later half: 24 deployments, 3 failed.
    { id: 'dep-13', deployedAt: '2026-08-31T06:20:00Z', leadTimeHours: 34, failed: false, restoreMinutes: null },
    { id: 'dep-14', deployedAt: '2026-09-02T08:10:00Z', leadTimeHours: 30, failed: false, restoreMinutes: null },
    { id: 'dep-15', deployedAt: '2026-09-04T09:40:00Z', leadTimeHours: 28, failed: false, restoreMinutes: null },
    { id: 'dep-16', deployedAt: '2026-09-07T06:45:00Z', leadTimeHours: 30, failed: false, restoreMinutes: null },
    { id: 'dep-17', deployedAt: '2026-09-08T07:30:00Z', leadTimeHours: 26, failed: true, restoreMinutes: 120 },
    { id: 'dep-18', deployedAt: '2026-09-10T08:25:00Z', leadTimeHours: 24, failed: false, restoreMinutes: null },
    { id: 'dep-19', deployedAt: '2026-09-11T09:50:00Z', leadTimeHours: 22, failed: false, restoreMinutes: null },
    { id: 'dep-20', deployedAt: '2026-09-14T06:15:00Z', leadTimeHours: 26, failed: false, restoreMinutes: null },
    { id: 'dep-21', deployedAt: '2026-09-15T07:55:00Z', leadTimeHours: 22, failed: false, restoreMinutes: null },
    { id: 'dep-22', deployedAt: '2026-09-16T08:30:00Z', leadTimeHours: 20, failed: false, restoreMinutes: null },
    { id: 'dep-23', deployedAt: '2026-09-18T09:10:00Z', leadTimeHours: 18, failed: false, restoreMinutes: null },
    { id: 'dep-24', deployedAt: '2026-09-21T06:35:00Z', leadTimeHours: 22, failed: false, restoreMinutes: null },
    { id: 'dep-25', deployedAt: '2026-09-23T07:20:00Z', leadTimeHours: 20, failed: true, restoreMinutes: 90 },
    { id: 'dep-26', deployedAt: '2026-09-24T08:45:00Z', leadTimeHours: 18, failed: false, restoreMinutes: null },
    { id: 'dep-27', deployedAt: '2026-09-25T09:25:00Z', leadTimeHours: 16, failed: false, restoreMinutes: null },
    { id: 'dep-28', deployedAt: '2026-09-28T06:50:00Z', leadTimeHours: 20, failed: false, restoreMinutes: null },
    { id: 'dep-29', deployedAt: '2026-09-29T07:40:00Z', leadTimeHours: 18, failed: false, restoreMinutes: null },
    { id: 'dep-30', deployedAt: '2026-10-01T08:15:00Z', leadTimeHours: 16, failed: false, restoreMinutes: null },
    { id: 'dep-31', deployedAt: '2026-10-02T09:35:00Z', leadTimeHours: 14, failed: false, restoreMinutes: null },
    { id: 'dep-32', deployedAt: '2026-10-05T06:25:00Z', leadTimeHours: 18, failed: false, restoreMinutes: null },
    { id: 'dep-33', deployedAt: '2026-10-06T07:10:00Z', leadTimeHours: 16, failed: true, restoreMinutes: 60 },
    { id: 'dep-34', deployedAt: '2026-10-07T08:05:00Z', leadTimeHours: 14, failed: false, restoreMinutes: null },
    { id: 'dep-35', deployedAt: '2026-10-08T08:50:00Z', leadTimeHours: 12, failed: false, restoreMinutes: null },
    { id: 'dep-36', deployedAt: '2026-10-09T09:20:00Z', leadTimeHours: 10, failed: false, restoreMinutes: null },
  ],
  defects: [
    { id: 'def-01', moduleId: 'payment', severity: 'critical', foundAt: '2026-07-29' },
    { id: 'def-02', moduleId: 'booking', severity: 'major', foundAt: '2026-08-05' },
    { id: 'def-03', moduleId: 'payment', severity: 'major', foundAt: '2026-08-12' },
    { id: 'def-04', moduleId: 'admin', severity: 'minor', foundAt: '2026-08-21' },
    { id: 'def-05', moduleId: 'payment', severity: 'major', foundAt: '2026-09-09' },
    { id: 'def-06', moduleId: 'booking', severity: 'minor', foundAt: '2026-09-24' },
    { id: 'def-07', moduleId: 'payment', severity: 'minor', foundAt: '2026-10-06' },
  ],
}

export const sampleQualityMetricsGateway: QualityMetricsGateway = {
  loadRecords: () => Promise.resolve(records),
}

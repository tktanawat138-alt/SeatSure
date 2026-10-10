import { buildQualityDashboard, type QualityDashboard } from '@/entities/quality-metrics'
import type { QualityMetricsGateway } from '@/interfaces/quality-metrics-gateway'

export function createLoadQualityDashboard(gateway: QualityMetricsGateway) {
  return async (): Promise<QualityDashboard> => buildQualityDashboard(await gateway.loadRecords())
}

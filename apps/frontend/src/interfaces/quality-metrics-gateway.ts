import type { QualityRecords } from '@/entities/quality-metrics'

export interface QualityMetricsGateway {
  loadRecords(): Promise<QualityRecords>
}

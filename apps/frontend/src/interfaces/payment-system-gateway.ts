import type { Course } from '@/entities/course'
import type { RefundReport } from '@/entities/payment-system'

export interface PaymentSystemGateway {
  load(): Promise<{ courses: Course[]; refunds: RefundReport[] }>
}

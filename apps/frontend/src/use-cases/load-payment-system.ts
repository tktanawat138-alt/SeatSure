import type { PaymentsGateway } from '@/interfaces/payments-gateway'

export function createLoadPaymentSystem(gateway: Pick<PaymentsGateway, 'overview'>) {
  return () => gateway.overview()
}

import type { PaymentSystemGateway } from '@/interfaces/payment-system-gateway'

export function createLoadPaymentSystem(gateway: PaymentSystemGateway) {
  return () => gateway.load()
}

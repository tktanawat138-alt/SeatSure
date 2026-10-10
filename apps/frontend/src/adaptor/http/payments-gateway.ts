import type { PaymentSystemDto } from '@contract'
import type { PaymentsGateway } from '@/interfaces/payments-gateway'
import { apiClient, type ApiClient } from './client'

const booking = (id: string) => `/bookings/${encodeURIComponent(id)}`

export function createPaymentsGateway(client: ApiClient): PaymentsGateway {
  return {
    // The file goes as the raw body with its own content type (image/jpeg, png or webp).
    async submitProof(bookingId, file) {
      await client.request<null>('PUT', `${booking(bookingId)}/proof`, file)
    },
    async confirm(bookingId) {
      await client.request<null>('POST', `${booking(bookingId)}/confirm-payment`)
    },
    overview: () => client.request<PaymentSystemDto>('GET', '/admin/payments'),
  }
}

export const paymentsGateway = createPaymentsGateway(apiClient)

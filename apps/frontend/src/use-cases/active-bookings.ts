import type { BookingsGateway } from '@/interfaces/bookings-gateway'

export function createLoadActiveBookings(gateway: BookingsGateway) {
  return () => gateway.active()
}

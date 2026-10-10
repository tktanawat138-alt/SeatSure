import type { BookingsGateway } from '@/interfaces/bookings-gateway'

export function createLoadMyBookings(gateway: BookingsGateway) {
  return () => gateway.mine()
}

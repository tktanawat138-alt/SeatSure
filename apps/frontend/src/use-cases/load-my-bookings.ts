import type { MyBookingsGateway } from '@/interfaces/my-bookings-gateway'

export function createLoadMyBookings(gateway: MyBookingsGateway) {
  return () => gateway.load()
}

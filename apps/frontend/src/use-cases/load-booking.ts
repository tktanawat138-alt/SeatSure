import type { BookingsGateway } from '@/interfaces/bookings-gateway'

export function createLoadBooking(gateway: BookingsGateway) {
  return (bookingId: string) => gateway.get(bookingId)
}

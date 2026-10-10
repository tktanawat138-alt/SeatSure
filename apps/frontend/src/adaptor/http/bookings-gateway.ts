import type { ActiveBookingDto, BookingDto, BookSeatBody, RosterRowDto } from '@contract'
import type { BookingsGateway } from '@/interfaces/bookings-gateway'
import { apiClient, type ApiClient } from './client'

export function createBookingsGateway(client: ApiClient): BookingsGateway {
  return {
    book: ({ courseId, studentName }) =>
      client.request<BookingDto>('POST', '/bookings', { courseId, studentName } satisfies BookSeatBody),
    mine: () => client.request<BookingDto[]>('GET', '/bookings/mine'),
    active: () => client.request<ActiveBookingDto[]>('GET', '/bookings/active'),
    get: (bookingId) => client.request<BookingDto>('GET', `/bookings/${encodeURIComponent(bookingId)}`),
    roster: (courseId) => client.request<RosterRowDto[]>('GET', `/courses/${encodeURIComponent(courseId)}/roster`),
  }
}

export const bookingsGateway = createBookingsGateway(apiClient)

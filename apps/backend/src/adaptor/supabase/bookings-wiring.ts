import type { BookingsDeps } from '../http/bookings.routes'
import { createSupabaseBookingRepository } from './booking-repository'
import type { SupabaseConfig } from './config'

/** Builds the bookings ports over Supabase. */
export function wireBookings(config: SupabaseConfig): BookingsDeps {
  return { bookingRepository: createSupabaseBookingRepository(config) }
}

import type { BookingsDeps } from '../http/bookings.routes'
import type { SupabaseConfig } from './config'

/** Builds the bookings ports over Supabase. Filled in by the bookings group. */
export function wireBookings(_config: SupabaseConfig): BookingsDeps {
  return {}
}

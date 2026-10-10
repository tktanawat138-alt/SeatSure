import { Router } from 'express'
import type { RequireAuth } from './guard'

/** Ports the bookings use cases need. Filled in by the bookings group. */
export type BookingsDeps = Record<never, never>

export function bookingsRoutes(_deps: BookingsDeps, _requireAuth: RequireAuth): Router {
  return Router()
}

import { Router } from 'express'
import type { RequireAuth } from './guard'

/** Ports the payments use cases need. Filled in by the payments group. */
export type PaymentsDeps = Record<never, never>

export function paymentsRoutes(_deps: PaymentsDeps, _requireAuth: RequireAuth): Router {
  return Router()
}

import type { PaymentsDeps } from '../http/payments.routes'
import type { SupabaseConfig } from './config'

/** Builds the payments ports over Supabase. Filled in by the payments group. */
export function wirePayments(_config: SupabaseConfig): PaymentsDeps {
  return {}
}

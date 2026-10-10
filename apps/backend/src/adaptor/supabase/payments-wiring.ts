import { createClient } from '@supabase/supabase-js'
import type { Actor } from '../../entities/actor'
import type { PaymentsDeps } from '../http/payments.routes'
import type { SupabaseConfig } from './config'
import { createSupabasePaymentRepository } from './payment-repository'
import { createSupabaseProofStorage } from './proof-storage'

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

/**
 * Builds the payments ports over Supabase. Every call runs as the signed-in user (anon key plus
 * their bearer token), never with the service key: `confirm_transfer_payment` reads `auth.uid()`,
 * and the RLS and storage policies keep each parent to their own bookings and folder.
 */
export function wirePayments(config: SupabaseConfig): PaymentsDeps {
  const clientFor = (actor: Actor) =>
    createClient(config.url, config.anonKey, {
      ...clientOptions,
      global: { headers: { Authorization: `Bearer ${actor.token}` } },
    })
  return {
    paymentRepository: createSupabasePaymentRepository(clientFor),
    proofStorage: createSupabaseProofStorage(clientFor),
  }
}

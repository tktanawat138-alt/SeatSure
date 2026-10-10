import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfirmPaymentProof } from '@/use-cases/submit-payment-proof'
import { rpc, stubNetwork } from './stub-network'

afterEach(() => vi.unstubAllGlobals())

// myBookingsGateway (supabase) is replaced by the HTTP bookings gateway: tests/integration/bookings-gateway.test.ts.

describe('paymentProofGateway.confirm', () => {
  it('calls confirm_transfer_payment with the booking id', async () => {
    const calls = stubNetwork(rpc('confirm_transfer_payment', { body: null }))
    const { paymentProofGateway } = await import('@/adaptor/supabase/payment-proof-gateway')

    await createConfirmPaymentProof(paymentProofGateway)('b1')

    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ p_booking_id: 'b1' })
  })

  it('surfaces the backend error code', async () => {
    stubNetwork(rpc('confirm_transfer_payment', { status: 400, body: { message: 'payment_proof_required' } }))
    const { paymentProofGateway } = await import('@/adaptor/supabase/payment-proof-gateway')

    await expect(createConfirmPaymentProof(paymentProofGateway)('b1')).rejects.toMatchObject({
      message: 'payment_proof_required',
    })
  })
})

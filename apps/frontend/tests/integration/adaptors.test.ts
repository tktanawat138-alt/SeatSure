import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfirmPaymentProof } from '@/use-cases/submit-payment-proof'
import { createLoadMyBookings } from '@/use-cases/load-my-bookings'
import { rpc, stubNetwork, table } from './stub-network'

afterEach(() => vi.unstubAllGlobals())

const booking = (id: string) => ({ id, status: 'held', courses: { title: 'x', price: 100 }, payments: [] })

describe('myBookingsGateway', () => {
  it('load attaches each proof to its own booking', async () => {
    stubNetwork(
      table('bookings', { body: [booking('b1'), booking('b2')] }),
      table('payment_proofs', { body: [{ id: 'p1', booking_id: 'b2', proof_path: 'u/b2.png' }] }),
    )
    const { myBookingsGateway } = await import('@/adaptor/supabase/my-bookings-gateway')

    const bookings = await createLoadMyBookings(myBookingsGateway)()

    expect(bookings.map((b) => b.payment_proofs.length)).toEqual([0, 1])
  })

  it('load rejects when the bookings request fails', async () => {
    stubNetwork(
      table('bookings', { status: 500, body: { message: 'boom' } }),
      table('payment_proofs', { body: [] }),
    )
    const { myBookingsGateway } = await import('@/adaptor/supabase/my-bookings-gateway')

    await expect(createLoadMyBookings(myBookingsGateway)()).rejects.toMatchObject({ message: 'boom' })
  })
})

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

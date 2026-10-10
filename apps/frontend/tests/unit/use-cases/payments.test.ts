import { describe, expect, it } from 'vitest'
import type { PaymentsGateway } from '@/interfaces/payments-gateway'
import { createLoadPaymentSystem } from '@/use-cases/load-payment-system'
import { createConfirmPaymentProof, createSubmitPaymentProof } from '@/use-cases/submit-payment-proof'

function fakeGateway() {
  const log: string[] = []
  const gateway: PaymentsGateway = {
    submitProof: async (bookingId, file) => void log.push(`submit ${bookingId} ${file.type} ${file.size}`),
    confirm: async (bookingId) => void log.push(`confirm ${bookingId}`),
    overview: async () => ({ courses: [], refunds: [] }),
  }
  return { gateway, log }
}

const file = (type: string, size = 4) => new File([new Uint8Array(size)], 'slip', { type })
const codeOf = (promise: Promise<unknown>) => promise.then(() => null, (e: { code?: string }) => e.code)

describe('payment use cases', () => {
  it('submitPaymentProof valid image hands the booking and file to the gateway', async () => {
    const { gateway, log } = fakeGateway()
    await createSubmitPaymentProof(gateway)({ userId: 'u1', bookingId: 'b1', file: file('image/png') })
    expect(log).toEqual(['submit b1 image/png 4'])
  })

  it('submitPaymentProof wrong type rejects proof_type_invalid without a request', async () => {
    const { gateway, log } = fakeGateway()
    expect(await codeOf(createSubmitPaymentProof(gateway)({ bookingId: 'b1', file: file('application/pdf') }))).toBe('proof_type_invalid')
    expect(log).toEqual([])
  })

  it('submitPaymentProof over 5 MiB rejects proof_size_exceeded without a request', async () => {
    const { gateway, log } = fakeGateway()
    const big = file('image/jpeg', 5 * 1024 * 1024 + 1)
    expect(await codeOf(createSubmitPaymentProof(gateway)({ bookingId: 'b1', file: big }))).toBe('proof_size_exceeded')
    expect(log).toEqual([])
  })

  it('confirmPaymentProof asks the gateway to confirm the booking', async () => {
    const { gateway, log } = fakeGateway()
    await createConfirmPaymentProof(gateway)('b1')
    expect(log).toEqual(['confirm b1'])
  })

  it('loadPaymentSystem returns the overview', async () => {
    const { gateway } = fakeGateway()
    expect(await createLoadPaymentSystem(gateway)()).toEqual({ courses: [], refunds: [] })
  })
})

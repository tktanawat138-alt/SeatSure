import { describe, expect, it } from 'vitest'
import { DomainError } from '../../../src/entities/domain-error'
import { MAX_PROOF_BYTES } from '../../../src/entities/payment'
import { createPayments } from '../../../src/use-cases/payments'
import { actor, course, fakePayments, refund } from '../payments-fakes'

const parent = actor('u1')
const png = (size = 8) => ({ contentType: 'image/png', bytes: new Uint8Array(size) })

function setup() {
  const fake = fakePayments()
  fake.bookings.set('b1', { userId: 'u1', status: 'held' })
  return { fake, payments: createPayments(fake) }
}

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => (e instanceof DomainError ? e.code : e),
  )

describe('submitProof', () => {
  it('submitProof valid png stores the object under the owner folder and records it', async () => {
    const { fake, payments } = setup()

    await payments.submitProof(parent, 'b1', png())

    const path = fake.proofs.get('b1')?.path
    expect(path).toMatch(/^u1\/b1-[0-9a-f-]{36}\.png$/)
    expect([...fake.objects]).toEqual([path])
    expect(fake.proofStorage.uploads[0]).toMatchObject({ contentType: 'image/png', size: 8 })
  })

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
  ])('submitProof %s uses the .%s extension', async (contentType, extension) => {
    const { fake, payments } = setup()
    await payments.submitProof(parent, 'b1', { contentType, bytes: new Uint8Array(4) })
    expect(fake.proofs.get('b1')?.path.endsWith(`.${extension}`)).toBe(true)
  })

  it.each(['application/pdf', 'image/gif', 'text/plain', ''])('submitProof type %j rejects proof_type_invalid', async (contentType) => {
    const { fake, payments } = setup()
    expect(await codeOf(payments.submitProof(parent, 'b1', { contentType, bytes: new Uint8Array(4) }))).toBe('proof_type_invalid')
    expect(fake.objects.size).toBe(0)
  })

  it('submitProof of 5 MiB + 1 byte rejects proof_size_exceeded, exactly 5 MiB is accepted', async () => {
    const { fake, payments } = setup()
    expect(await codeOf(payments.submitProof(parent, 'b1', png(MAX_PROOF_BYTES + 1)))).toBe('proof_size_exceeded')
    expect(fake.objects.size).toBe(0)
    await payments.submitProof(parent, 'b1', png(MAX_PROOF_BYTES))
    expect(fake.objects.size).toBe(1)
  })

  it('submitProof empty body rejects payment_proof_required', async () => {
    const { fake, payments } = setup()
    expect(await codeOf(payments.submitProof(parent, 'b1', png(0)))).toBe('payment_proof_required')
    expect(fake.objects.size).toBe(0)
  })

  it('submitProof for someone else booking rejects booking_not_found and stores nothing', async () => {
    const { fake, payments } = setup()
    expect(await codeOf(payments.submitProof(actor('u2'), 'b1', png()))).toBe('booking_not_found')
    expect(await codeOf(payments.submitProof(parent, 'missing', png()))).toBe('booking_not_found')
    expect(fake.objects.size).toBe(0)
  })

  it('submitProof for a booking that is not held rejects booking_not_payable', async () => {
    const { fake, payments } = setup()
    fake.bookings.set('b1', { userId: 'u1', status: 'paid' })
    expect(await codeOf(payments.submitProof(parent, 'b1', png()))).toBe('booking_not_payable')
    expect(fake.objects.size).toBe(0)
  })

  it('submitProof when the DB write fails removes the uploaded object and rethrows', async () => {
    const { fake, payments } = setup()
    fake.state.failNextSave = true
    await expect(payments.submitProof(parent, 'b1', png())).rejects.toThrow('db down')
    expect(fake.proofStorage.uploads).toHaveLength(1)
    expect(fake.objects.size).toBe(0)
    expect(fake.proofs.size).toBe(0)
  })

  it('submitProof again replaces the row and removes the old object', async () => {
    const { fake, payments } = setup()
    await payments.submitProof(parent, 'b1', png())
    const first = fake.proofs.get('b1')!

    await payments.submitProof(parent, 'b1', { contentType: 'image/webp', bytes: new Uint8Array(4) })

    const second = fake.proofs.get('b1')!
    expect(second.id).toBe(first.id)
    expect(second.path).not.toBe(first.path)
    expect([...fake.objects]).toEqual([second.path])
  })

  it('submitProof replacing when the DB write fails keeps the old proof and object', async () => {
    const { fake, payments } = setup()
    await payments.submitProof(parent, 'b1', png())
    const first = fake.proofs.get('b1')!
    fake.state.failNextSave = true

    await expect(payments.submitProof(parent, 'b1', png())).rejects.toThrow('db down')

    expect(fake.proofs.get('b1')).toEqual(first)
    expect([...fake.objects]).toEqual([first.path])
  })
})

describe('confirmPayment', () => {
  it('confirmPayment after a proof marks the booking paid with one payment, repeat stays one', async () => {
    const { fake, payments } = setup()
    await payments.submitProof(parent, 'b1', png())
    await payments.confirmPayment(parent, 'b1')
    await payments.confirmPayment(parent, 'b1')
    expect(fake.bookings.get('b1')?.status).toBe('paid')
    expect(fake.payments).toHaveLength(1)
  })

  it('confirmPayment without a proof rejects payment_proof_required', async () => {
    const { payments } = setup()
    expect(await codeOf(payments.confirmPayment(parent, 'b1'))).toBe('payment_proof_required')
  })

  it('confirmPayment by another user rejects booking_not_found', async () => {
    const { payments } = setup()
    expect(await codeOf(payments.confirmPayment(actor('u2'), 'b1'))).toBe('booking_not_found')
  })
})

describe('admin reads', () => {
  it('paymentOverview as admin returns courses and refunds', async () => {
    const { payments } = setup()
    expect(await payments.paymentOverview(actor('a1', 'admin'))).toEqual({ courses: [course], refunds: [refund] })
  })

  it('refunds as admin returns the refund reports', async () => {
    const { payments } = setup()
    expect(await payments.refunds(actor('a1', 'admin'))).toEqual([refund])
  })

  it.each(['parent', 'teacher'] as const)('paymentOverview and refunds as %s reject forbidden', async (role) => {
    const { payments } = setup()
    expect(await codeOf(payments.paymentOverview(actor('x', role)))).toBe('forbidden')
    expect(await codeOf(payments.refunds(actor('x', role)))).toBe('forbidden')
  })
})

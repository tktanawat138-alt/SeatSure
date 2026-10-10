import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp, type AppDeps } from '../../../src/app'
import { PaymentSystemDto, RefundReportDto } from '../../../src/adaptor/http/contract'
import { MAX_PROOF_BYTES } from '../../../src/entities/payment'
import { fakePayments } from '../payments-fakes'
import { fakeAuthProvider, tokenFor } from './fake-auth-provider'

const BOOKING = '11111111-1111-4111-8111-111111111111'

function setup() {
  const fake = fakePayments()
  fake.bookings.set(BOOKING, { userId: 'u-parent', status: 'held' })
  // Only the payments ports are exercised here; the other groups' ports are never touched.
  const app = createApp({ frontendOrigin: 'http://localhost:5173', authProvider: fakeAuthProvider(), ...fake } as unknown as AppDeps)
  return { app, fake }
}

const bearer = (id: string) => ({ Authorization: `Bearer ${tokenFor(id)}` })
const putProof = (app: ReturnType<typeof setup>['app'], body: Buffer | string, type: string, as = 'u-parent', id = BOOKING) =>
  request(app).put(`/bookings/${id}/proof`).set(bearer(as)).set('Content-Type', type).send(body)

describe('PUT /bookings/:id/proof', () => {
  it('a png body returns 200 and hands the exact bytes and type to storage', async () => {
    const { app, fake } = setup()
    const res = await putProof(app, Buffer.alloc(123, 1), 'image/png')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: null })
    expect(fake.proofStorage.uploads).toEqual([{ path: expect.stringMatching(/^u-parent\/.+\.png$/), contentType: 'image/png', size: 123 }])
  })

  it('exactly 5 MiB is accepted', async () => {
    const { app } = setup()
    const res = await putProof(app, Buffer.alloc(MAX_PROOF_BYTES), 'image/jpeg')
    expect(res.status).toBe(200)
  })

  it('5 MiB + 1 byte returns 413 proof_size_exceeded and stores nothing', async () => {
    const { app, fake } = setup()
    const res = await putProof(app, Buffer.alloc(MAX_PROOF_BYTES + 1), 'image/png')
    expect(res.status).toBe(413)
    expect(res.body).toEqual({ success: false, message: 'proof_size_exceeded' })
    expect(fake.proofStorage.uploads).toHaveLength(0)
  })

  it.each(['text/plain', 'application/pdf', 'image/gif'])('content type %s returns 400 proof_type_invalid', async (type) => {
    const { app, fake } = setup()
    const res = await putProof(app, 'not an image', type)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'proof_type_invalid' })
    expect(fake.proofStorage.uploads).toHaveLength(0)
  })

  it('a JSON body returns 400 proof_type_invalid', async () => {
    const { app } = setup()
    const res = await request(app).put(`/bookings/${BOOKING}/proof`).set(bearer('u-parent')).send({ proof: 'x' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('proof_type_invalid')
  })

  it('an empty image body returns 400 payment_proof_required', async () => {
    const { app, fake } = setup()
    const res = await putProof(app, Buffer.alloc(0), 'image/png')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'payment_proof_required' })
    expect(fake.proofStorage.uploads).toHaveLength(0)
  })

  it('another user booking returns 404 booking_not_found', async () => {
    const { app, fake } = setup()
    const res = await putProof(app, Buffer.alloc(10), 'image/png', 'u-teacher')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, message: 'booking_not_found' })
    expect(fake.proofStorage.uploads).toHaveLength(0)
  })

  it('a booking id that is not a uuid returns 400 Validation failed', async () => {
    const { app } = setup()
    const res = await putProof(app, Buffer.alloc(10), 'image/png', 'u-parent', 'nope')
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Validation failed')
  })

  it('without a token returns 401 not_authenticated', async () => {
    const { app } = setup()
    const res = await request(app).put(`/bookings/${BOOKING}/proof`).set('Content-Type', 'image/png').send(Buffer.alloc(10))
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })
})

describe('POST /bookings/:id/confirm-payment', () => {
  it('after a proof returns 200 and pays once, a repeat is still 200', async () => {
    const { app, fake } = setup()
    await putProof(app, Buffer.alloc(10), 'image/png')
    const first = await request(app).post(`/bookings/${BOOKING}/confirm-payment`).set(bearer('u-parent'))
    const again = await request(app).post(`/bookings/${BOOKING}/confirm-payment`).set(bearer('u-parent'))
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ success: true, data: null })
    expect(again.status).toBe(200)
    expect(fake.payments).toHaveLength(1)
  })

  it('without a proof returns 400 payment_proof_required', async () => {
    const { app } = setup()
    const res = await request(app).post(`/bookings/${BOOKING}/confirm-payment`).set(bearer('u-parent'))
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'payment_proof_required' })
  })

  it('by another user returns 404 booking_not_found', async () => {
    const { app } = setup()
    const res = await request(app).post(`/bookings/${BOOKING}/confirm-payment`).set(bearer('u-admin'))
    expect(res.status).toBe(404)
    expect(res.body.message).toBe('booking_not_found')
  })
})

describe('admin payment reads', () => {
  it('GET /admin/payments as admin returns courses and refunds in the contract shape', async () => {
    const { app } = setup()
    const res = await request(app).get('/admin/payments').set(bearer('u-admin'))
    expect(res.status).toBe(200)
    expect(PaymentSystemDto.parse(res.body.data).refunds).toHaveLength(1)
  })

  it('GET /admin/refunds as admin returns the refund reports', async () => {
    const { app } = setup()
    const res = await request(app).get('/admin/refunds').set(bearer('u-admin'))
    expect(res.status).toBe(200)
    expect(RefundReportDto.array().parse(res.body.data)).toHaveLength(1)
  })

  it.each([
    ['/admin/payments', 'u-parent'],
    ['/admin/payments', 'u-teacher'],
    ['/admin/refunds', 'u-parent'],
    ['/admin/refunds', 'u-teacher'],
  ])('GET %s as %s returns 403 forbidden', async (path, who) => {
    const { app } = setup()
    const res = await request(app).get(path).set(bearer(who))
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ success: false, message: 'forbidden' })
  })
})

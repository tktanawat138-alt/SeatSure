import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp, type AppDeps } from '../../src/app'
import { PaymentSystemDto, RefundReportDto } from '../../src/adaptor/http/contract'
import { createSupabaseAuthProvider } from '../../src/adaptor/supabase/auth-provider'
import { wirePayments } from '../../src/adaptor/supabase/payments-wiring'
import { MAX_PROOF_BYTES } from '../../src/entities/payment'
import {
  admin,
  cleanup,
  createCourse,
  createUser,
  createUsers,
  getBooking,
  mustBook,
  pay,
  paymentsFor,
  seatsTaken,
  type TestUser,
} from './helpers'

// Payment is a bank transfer: upload a proof image, then press "confirm". Everything goes
// through the API over HTTP (supertest) with the real Supabase adaptors.
const supabase = {
  url: process.env.VITE_SUPABASE_URL!,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
}
// Only the auth and payments ports are exercised by this file.
const app = createApp({
  frontendOrigin: 'http://localhost:5173',
  authProvider: createSupabaseAuthProvider(supabase),
  ...wirePayments(supabase),
} as unknown as AppDeps)

const users: TestUser[] = []
async function newUser(role?: 'parent' | 'admin' | 'teacher') {
  const user = await createUser(role)
  users.push(user)
  return user
}
async function newUsers(count: number) {
  const created = await createUsers(count)
  users.push(...created)
  return created
}

afterAll(async () => {
  // Proof objects uploaded through the API live under each user's folder.
  for (const user of users) {
    const paths = (await objectsOf(user)).map((name) => `${user.id}/${name}`)
    if (paths.length > 0) await admin.storage.from('payment-proofs').remove(paths)
  }
  await cleanup()
})

async function tokenOf(user: TestUser) {
  const { data } = await user.client.auth.getSession()
  return data.session!.access_token
}

async function objectsOf(user: TestUser) {
  const { data, error } = await admin.storage.from('payment-proofs').list(user.id)
  if (error) throw error
  return (data ?? []).map((o) => o.name)
}

async function proofRow(bookingId: string) {
  const { data, error } = await admin.from('payment_proofs').select().eq('booking_id', bookingId)
  if (error) throw error
  return data
}

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function uploadProof(user: TestUser, bookingId: string, body: Buffer | string = PNG, type = 'image/png') {
  return request(app)
    .put(`/bookings/${bookingId}/proof`)
    .set('Authorization', `Bearer ${await tokenOf(user)}`)
    .set('Content-Type', type)
    .send(body)
}

async function confirm(user: TestUser, bookingId: string) {
  return request(app).post(`/bookings/${bookingId}/confirm-payment`).set('Authorization', `Bearer ${await tokenOf(user)}`)
}

async function setupBooking() {
  const course = await createCourse({ capacity: 2 })
  const parent = await newUser()
  const booking = await mustBook(parent, course.id)
  return { course, parent, booking }
}

describe('PUT /bookings/:id/proof', () => {
  it('upload stores one object under the parent folder and records it, booking stays held', async () => {
    const { parent, booking } = await setupBooking()

    const res = await uploadProof(parent, booking.id)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: null })
    const rows = await proofRow(booking.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.proof_path).toMatch(new RegExp(`^${parent.id}/${booking.id}-[0-9a-f-]{36}\\.png$`))
    expect(await objectsOf(parent)).toEqual([rows[0]!.proof_path.split('/')[1]])
    expect((await getBooking(booking.id)).status).toBe('held')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })

  it('a second upload replaces the proof and leaves exactly one object', async () => {
    const { parent, booking } = await setupBooking()
    await uploadProof(parent, booking.id)
    const [first] = await proofRow(booking.id)

    const res = await uploadProof(parent, booking.id, PNG, 'image/webp')

    expect(res.status).toBe(200)
    const rows = await proofRow(booking.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(first!.id)
    expect(rows[0]!.proof_path).toMatch(/\.webp$/)
    expect(await objectsOf(parent)).toEqual([rows[0]!.proof_path.split('/')[1]])
  })

  it.each([
    ['wrong type', () => 'plain text', 'text/plain', 400, 'proof_type_invalid'],
    ['oversized body', () => Buffer.alloc(MAX_PROOF_BYTES + 1), 'image/png', 413, 'proof_size_exceeded'],
    ['empty body', () => Buffer.alloc(0), 'image/png', 400, 'payment_proof_required'],
  ])('%s is rejected with its code and leaves no object', async (_name, body, type, status, code) => {
    const { parent, booking } = await setupBooking()

    const res = await uploadProof(parent, booking.id, body(), type)

    expect(res.status).toBe(status)
    expect(res.body).toEqual({ success: false, message: code })
    expect(await objectsOf(parent)).toEqual([])
    expect(await proofRow(booking.id)).toHaveLength(0)
  })

  it('another user cannot upload a proof for the booking: 404 booking_not_found, nothing stored', async () => {
    const course = await createCourse({ capacity: 2 })
    const [owner, other] = await newUsers(2)
    const booking = await mustBook(owner!, course.id)

    const res = await uploadProof(other!, booking.id)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, message: 'booking_not_found' })
    expect(await objectsOf(other!)).toEqual([])
    expect(await objectsOf(owner!)).toEqual([])
    expect(await proofRow(booking.id)).toHaveLength(0)
  })

  it('a paid booking takes no new proof: 400 booking_not_payable', async () => {
    const { parent, booking } = await setupBooking()
    await uploadProof(parent, booking.id)
    await confirm(parent, booking.id)

    const res = await uploadProof(parent, booking.id)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('booking_not_payable')
    expect(await objectsOf(parent)).toHaveLength(1)
  })
})

describe('POST /bookings/:id/confirm-payment', () => {
  it('confirm after a proof marks the booking paid with exactly one receipt', async () => {
    const { course, parent, booking } = await setupBooking()
    await uploadProof(parent, booking.id)

    const res = await confirm(parent, booking.id)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: null })
    const payments = await paymentsFor(booking.id)
    expect(payments).toHaveLength(1)
    expect(payments[0]!.status).toBe('succeeded')
    expect(payments[0]!.receipt_no).toMatch(/^RC-\d{8}-\d{6}$/)
    expect((await getBooking(booking.id)).status).toBe('paid')
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('confirm without a proof returns 400 payment_proof_required', async () => {
    const { parent, booking } = await setupBooking()

    const res = await confirm(parent, booking.id)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'payment_proof_required' })
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })

  it('another user cannot confirm the booking: 404 booking_not_found', async () => {
    const course = await createCourse({ capacity: 2 })
    const [owner, other] = await newUsers(2)
    const booking = await mustBook(owner!, course.id)
    await uploadProof(owner!, booking.id)

    const res = await confirm(other!, booking.id)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, message: 'booking_not_found' })
    expect((await getBooking(booking.id)).status).toBe('held')
  })

  it('card payment is retired: pay_booking still returns bank_transfer_only', async () => {
    const { parent, booking } = await setupBooking()

    const { error } = await pay(parent, booking.id)

    expect(error?.message).toBe('bank_transfer_only')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })
})

describe('R2 no double charge: any number of confirms charges once', () => {
  it('5 parallel confirms create one payment', async () => {
    const { parent, booking } = await setupBooking()
    await uploadProof(parent, booking.id)

    const replies = await Promise.all(Array.from({ length: 5 }, () => confirm(parent, booking.id)))

    expect(replies.map((r) => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(await paymentsFor(booking.id), 'payments recorded').toHaveLength(1)
    expect((await getBooking(booking.id)).status).toBe('paid')
  })

  it('a repeat confirm after paying returns 200 and charges nothing more', async () => {
    const { parent, booking } = await setupBooking()
    await uploadProof(parent, booking.id)
    await confirm(parent, booking.id)

    const res = await confirm(parent, booking.id)

    expect(res.status).toBe(200)
    expect(await paymentsFor(booking.id), 'payments recorded').toHaveLength(1)
  })
})

describe('admin payment reads', () => {
  it('GET /admin/payments as admin lists every course and the refund reports', async () => {
    const course = await createCourse({ capacity: 2 })
    const adminUser = await newUser('admin')

    const res = await request(app).get('/admin/payments').set('Authorization', `Bearer ${await tokenOf(adminUser)}`)

    expect(res.status).toBe(200)
    const data = PaymentSystemDto.parse(res.body.data)
    expect(data.courses.map((c) => c.id)).toContain(course.id)
    const times = data.refunds.map((r) => Date.parse(r.created_at))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('GET /admin/refunds as admin returns refund reports', async () => {
    const adminUser = await newUser('admin')
    const res = await request(app).get('/admin/refunds').set('Authorization', `Bearer ${await tokenOf(adminUser)}`)
    expect(res.status).toBe(200)
    expect(() => RefundReportDto.array().parse(res.body.data)).not.toThrow()
  })

  it.each(['parent', 'teacher'] as const)('GET /admin/* as %s returns 403 forbidden', async (role) => {
    const user = await newUser(role)
    const token = await tokenOf(user)
    for (const path of ['/admin/payments', '/admin/refunds']) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`)
      expect(res.status, path).toBe(403)
      expect(res.body).toEqual({ success: false, message: 'forbidden' })
    }
  })
})

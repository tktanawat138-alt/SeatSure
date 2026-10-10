import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CourseDto, RefundReportDto, Session } from '@contract'
import { DomainError } from '@/entities/domain-error'
import { createApiClient } from '@/adaptor/http/client'
import { createPaymentsGateway } from '@/adaptor/http/payments-gateway'
import { createSessionStore } from '@/adaptor/http/session-store'
import { createLoadPaymentSystem } from '@/use-cases/load-payment-system'
import { createConfirmPaymentProof, createSubmitPaymentProof } from '@/use-cases/submit-payment-proof'
import { api, authorization, stubNetwork } from './stub-network'

afterEach(() => vi.unstubAllGlobals())

const BASE = 'http://api.test'
const session = (n: number): Session => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresAt: 2_000_000_000 })
const ok = (data: unknown) => ({ body: { success: true, data } })
const fail = (status: number, message: string) => ({ status, body: { success: false, message } })

function setup() {
  const items = new Map<string, string>()
  const store = createSessionStore(() => ({
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  }))
  store.set(session(1))
  const client = createApiClient({ baseUrl: BASE, store })
  return { client, store, gateway: createPaymentsGateway(client) }
}

const course: CourseDto = {
  id: 'c1',
  title: 'Math',
  description: '',
  teacher_id: null,
  teacher_name: null,
  capacity: 10,
  price: 1500,
  registration_open: true,
  seats_taken: 1,
  cancelled_at: null,
  cancellation_reason: null,
  starts_at: null,
  ends_at: null,
  approval_status: 'approved',
  approval_note: null,
}
const refund: RefundReportDto = {
  id: 'r1',
  payment_id: 'p1',
  booking_id: 'b1',
  course_id: 'c1',
  course_title: 'Math',
  student_name: 'Student',
  account_name: 'Parent',
  account_email: 'parent@test',
  amount: 1500,
  receipt_no: 'RC-20261010-000001',
  cancellation_reason: 'closed',
  created_at: '2026-10-10T00:00:00.000Z',
}

describe('apiClient raw body', () => {
  it('request with a Blob body sends the blob as is with its own content type', async () => {
    const calls = stubNetwork(api('PUT', '/upload', ok(null)))
    const { client } = setup()
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })

    await client.request('PUT', '/upload', blob)

    expect(new Headers(calls[0]!.init?.headers).get('content-type')).toBe('image/webp')
    expect(calls[0]!.init?.body).toBe(blob)
  })

  it('a Blob body is sent again on the retry after a token refresh', async () => {
    const calls = stubNetwork(
      api('PUT', '/upload', (init) => (authorization(init) === 'Bearer access-2' ? ok(null) : fail(401, 'not_authenticated'))),
      api('POST', '/auth/refresh', ok(session(2))),
    )
    const { client } = setup()
    const blob = new Blob(['x'], { type: 'image/png' })

    await client.request('PUT', '/upload', blob)

    expect(calls.map((c) => c.url.pathname)).toEqual(['/upload', '/auth/refresh', '/upload'])
    expect(calls[2]!.init?.body).toBe(blob)
    expect(new Headers(calls[2]!.init?.headers).get('content-type')).toBe('image/png')
  })
})

describe('paymentsGateway', () => {
  it('submit sends PUT /bookings/:id/proof with the file bytes, its content type and the bearer token', async () => {
    const calls = stubNetwork(api('PUT', '/bookings/b1/proof', ok(null)))
    const { gateway } = setup()
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'slip.png', { type: 'image/png' })

    await createSubmitPaymentProof(gateway)({ userId: 'u1', bookingId: 'b1', file })

    const init = calls[0]!.init
    expect(init?.method).toBe('PUT')
    expect(authorization(init)).toBe('Bearer access-1')
    expect(new Headers(init?.headers).get('content-type')).toBe('image/png')
    expect(new Uint8Array(await (init?.body as Blob).arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]))
  })

  it('submit surfaces the server code, e.g. booking_not_found', async () => {
    stubNetwork(api('PUT', '/bookings/b1/proof', fail(404, 'booking_not_found')))
    const { gateway } = setup()
    const file = new File(['x'], 'slip.jpg', { type: 'image/jpeg' })

    const error = await createSubmitPaymentProof(gateway)({ bookingId: 'b1', file }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe('booking_not_found')
  })

  it('submit maps a 413 to proof_size_exceeded', async () => {
    stubNetwork(api('PUT', '/bookings/b1/proof', fail(413, 'proof_size_exceeded')))
    const { gateway } = setup()
    const file = new File(['x'], 'slip.png', { type: 'image/png' })
    await expect(createSubmitPaymentProof(gateway)({ bookingId: 'b1', file })).rejects.toMatchObject({ code: 'proof_size_exceeded' })
  })

  it('confirm sends POST /bookings/:id/confirm-payment without a body', async () => {
    const calls = stubNetwork(api('POST', '/bookings/b1/confirm-payment', ok(null)))
    const { gateway } = setup()

    await createConfirmPaymentProof(gateway)('b1')

    expect(calls[0]!.init?.body).toBeUndefined()
    expect(authorization(calls[0]!.init)).toBe('Bearer access-1')
  })

  it('confirm surfaces payment_proof_required', async () => {
    stubNetwork(api('POST', '/bookings/b1/confirm-payment', fail(400, 'payment_proof_required')))
    const { gateway } = setup()
    await expect(createConfirmPaymentProof(gateway)('b1')).rejects.toMatchObject({ code: 'payment_proof_required' })
  })

  it('load reads GET /admin/payments and maps courses and refunds', async () => {
    stubNetwork(api('GET', '/admin/payments', ok({ courses: [course], refunds: [refund] })))
    const { gateway } = setup()

    expect(await createLoadPaymentSystem(gateway)()).toEqual({ courses: [course], refunds: [refund] })
  })

  it('load as a non-admin rejects forbidden', async () => {
    stubNetwork(api('GET', '/admin/payments', fail(403, 'forbidden')))
    const { gateway } = setup()
    await expect(createLoadPaymentSystem(gateway)()).rejects.toMatchObject({ code: 'forbidden' })
  })
})

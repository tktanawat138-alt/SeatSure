import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { createSupabaseAuthProvider } from '../../src/adaptor/supabase/auth-provider'
import { wireCourses } from '../../src/adaptor/supabase/courses-wiring'
import { wirePayments } from '../../src/adaptor/supabase/payments-wiring'
import { fakeAppDeps } from '../unit/api/fake-deps'
import { admin, attachProof, cleanup, createCourse, createUser, mustBook, paymentsFor, type TestUser } from './helpers'

// Security review M4: a parent confirming a transfer while the admin cancels the course must never
// leave a succeeded payment on a cancelled booking without a refund report. Both requests go
// through the API at the same moment; whichever wins, the end state has to be consistent.
const config = {
  url: process.env.VITE_SUPABASE_URL!,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
}
const app = createApp(fakeAppDeps({
  authProvider: createSupabaseAuthProvider(config),
  ...wireCourses(config),
  ...wirePayments(config),
}))

const courseIds: string[] = []
afterAll(async () => {
  // refund_reports reference payments (on delete restrict), so they go before the shared cleanup.
  if (courseIds.length > 0) await admin.from('refund_reports').delete().in('course_id', courseIds)
  await cleanup()
})

const tokenOf = async (user: TestUser) => (await user.client.auth.getSession()).data.session!.access_token
const post = async (user: TestUser, path: string, body?: object) =>
  request(app).post(path).set('Authorization', `Bearer ${await tokenOf(user)}`).send(body)

const ROUNDS = 10

describe('cancel course racing confirm payment', () => {
  it(`cancel and confirm at the same time end consistent, ${ROUNDS} rounds`, async () => {
    const adminUser = await createUser('admin')
    for (let round = 0; round < ROUNDS; round++) {
      const course = await createCourse({ capacity: 3 })
      courseIds.push(course.id)
      const parent = await createUser()
      const booking = await mustBook(parent, course.id)
      await attachProof(parent, booking.id)

      const [cancel, confirm] = await Promise.all([
        post(adminUser, `/courses/${course.id}/cancel`, { reason: `race ${round}` }),
        post(parent, `/bookings/${booking.id}/confirm-payment`),
      ])
      expect(cancel.status).toBe(200)

      const payments = await paymentsFor(booking.id)
      const { data: reports } = await admin.from('refund_reports').select('payment_id').eq('booking_id', booking.id)
      const { data: stored } = await admin.from('bookings').select('status').eq('id', booking.id).single()
      expect(stored?.status).toBe('cancelled')

      if (payments.length > 0) {
        // Confirm won: the payment is owed back and reported.
        expect(confirm.status).toBe(200)
        expect(payments).toHaveLength(1)
        expect(payments[0].status).toBe('refund_due')
        expect(reports).toEqual([{ payment_id: payments[0].id }])
        expect(cancel.body.data).toBe(1)
      } else {
        // Cancel won: the confirm was refused and nothing was charged.
        expect(confirm.status).toBe(400)
        expect(['booking_not_payable', 'course_cancelled']).toContain(confirm.body.message)
        expect(reports).toEqual([])
        expect(cancel.body.data).toBe(0)
      }
    }
  }, 120_000)
})

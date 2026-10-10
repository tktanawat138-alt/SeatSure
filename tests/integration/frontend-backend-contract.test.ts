import { beforeAll, describe, expect, it } from 'vitest'
import { myBookingsGateway } from '@/adaptor/supabase/my-bookings-gateway'
import { paymentProofGateway } from '@/adaptor/supabase/payment-proof-gateway'
import { fetchCourses, supabase } from '@/lib/supabase'

// Seeded by `task up`. These check the shapes the frontend relies on, not the backend rules
// (those live in apps/backend/tests/integration).
const PASSWORD = 'seatsure123'

async function signIn(email: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
}

describe('frontend adaptors against the real backend', () => {
  beforeAll(() => signIn('parent1@seatsure.test'))

  it('fetchCourses returns the columns the course cards read', async () => {
    const courses = await fetchCourses()

    expect(courses.length).toBeGreaterThan(0)
    expect(courses[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        capacity: expect.any(Number),
        price: expect.any(Number),
        seats_taken: expect.any(Number),
        approval_status: 'approved',
      }),
    )
  })

  it('myBookingsGateway.load resolves to a list with the joined course', async () => {
    const bookings = await myBookingsGateway.load()

    expect(Array.isArray(bookings)).toBe(true)
    for (const booking of bookings) {
      expect(booking.courses).toEqual(expect.objectContaining({ title: expect.any(String) }))
      expect(Array.isArray(booking.payment_proofs)).toBe(true)
    }
  })

  it('confirm on a booking that does not exist rejects with booking_not_found', async () => {
    await expect(paymentProofGateway.confirm('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      message: 'booking_not_found',
    })
  })
})

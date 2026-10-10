import { authGateway } from '@/adaptor/http/auth-gateway'
import { sessionStore } from '@/adaptor/http/session-store'
import { supabase } from '@/lib/supabase'
import { createLoadMe } from '@/use-cases/load-me'
import { createSignIn } from '@/use-cases/sign-in'
import { createSignOut } from '@/use-cases/sign-out'
import { paymentsGateway } from '@/adaptor/http/payments-gateway'
import { bookingsGateway } from '@/adaptor/http/bookings-gateway'
import { createLoadActiveBookings } from '@/use-cases/active-bookings'
import { createBookSeat } from '@/use-cases/book-seat'
import { createLoadBooking } from '@/use-cases/load-booking'
import { createLoadCourseRoster } from '@/use-cases/load-course-roster'
import { createLoadMyBookings } from '@/use-cases/load-my-bookings'
import { coursesGateway } from '@/adaptor/http/courses-gateway'
import { createCancelCourse } from '@/use-cases/cancel-course'
import { createCreateCourse } from '@/use-cases/create-course'
import { createListCourses } from '@/use-cases/list-courses'
import { createReviewCourse } from '@/use-cases/review-course'
import { createUpdateCourse } from '@/use-cases/update-course'
import { createLoadPaymentSystem } from '@/use-cases/load-payment-system'
import { createConfirmPaymentProof, createSubmitPaymentProof } from '@/use-cases/submit-payment-proof'
import { createUpdateCourseSchedule } from '@/use-cases/update-course-schedule'

export const submitPaymentProof = createSubmitPaymentProof(paymentsGateway)
export const confirmPaymentProof = createConfirmPaymentProof(paymentsGateway)
export const loadPaymentSystem = createLoadPaymentSystem(paymentsGateway)
export const loadCourseRoster = createLoadCourseRoster(bookingsGateway)
export const loadMyBookings = createLoadMyBookings(bookingsGateway)
export const bookSeat = createBookSeat(bookingsGateway)
export const loadBooking = createLoadBooking(bookingsGateway)
export const loadActiveBookings = createLoadActiveBookings(bookingsGateway)
export const updateCourseSchedule = createUpdateCourseSchedule(coursesGateway)
export const listCourses = createListCourses(coursesGateway)
export const createCourse = createCreateCourse(coursesGateway)
export const updateCourse = createUpdateCourse(coursesGateway)
export const reviewCourse = createReviewCourse(coursesGateway)
export const cancelCourse = createCancelCourse(coursesGateway)

// removed in Task 8 with supabase-js: pages still read data through the legacy client, so its
// persisted session must never outlive an API sign-in or sign-out (it could be another user's).
const forgetLegacySession = () => supabase.auth.signOut({ scope: 'local' }).then(
  () => undefined,
  () => undefined,
)
const apiSignIn = createSignIn(authGateway)
const apiSignOut = createSignOut(authGateway)

export const signIn = async (email: string, password: string) => {
  await forgetLegacySession()
  await apiSignIn(email, password)
}
export const signOut = async () => {
  await forgetLegacySession()
  await apiSignOut()
}
export const loadMe = createLoadMe(authGateway)
/** Fires with the new session (or null) whenever tokens are stored or forgotten. */
export const onSessionChange = sessionStore.subscribe
export const currentSession = sessionStore.get

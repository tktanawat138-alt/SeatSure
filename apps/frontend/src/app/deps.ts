import { authGateway } from '@/adaptor/http/auth-gateway'
import { sessionStore } from '@/adaptor/http/session-store'
import { createLoadMe } from '@/use-cases/load-me'
import { createSignIn } from '@/use-cases/sign-in'
import { createSignOut } from '@/use-cases/sign-out'
import { paymentProofGateway } from '@/adaptor/supabase/payment-proof-gateway'
import { paymentSystemGateway } from '@/adaptor/supabase/payment-system-gateway'
import { courseRosterGateway } from '@/adaptor/supabase/course-roster-gateway'
import { createLoadCourseRoster } from '@/use-cases/load-course-roster'
import { createLoadMyBookings } from '@/use-cases/load-my-bookings'
import { myBookingsGateway } from '@/adaptor/supabase/my-bookings-gateway'
import { courseScheduleGateway } from '@/adaptor/supabase/course-schedule-gateway'
import { createLoadPaymentSystem } from '@/use-cases/load-payment-system'
import { createConfirmPaymentProof, createSubmitPaymentProof } from '@/use-cases/submit-payment-proof'
import { createUpdateCourseSchedule } from '@/use-cases/update-course-schedule'

export const submitPaymentProof = createSubmitPaymentProof(paymentProofGateway)
export const confirmPaymentProof = createConfirmPaymentProof(paymentProofGateway)
export const loadPaymentSystem = createLoadPaymentSystem(paymentSystemGateway)
export const loadCourseRoster = createLoadCourseRoster(courseRosterGateway)
export const loadMyBookings = createLoadMyBookings(myBookingsGateway)
export const updateCourseSchedule = createUpdateCourseSchedule(courseScheduleGateway)

export const signIn = createSignIn(authGateway)
export const signOut = createSignOut(authGateway)
export const loadMe = createLoadMe(authGateway)
/** Fires with the new session (or null) whenever tokens are stored or forgotten. */
export const onSessionChange = sessionStore.subscribe
export const currentSession = sessionStore.get

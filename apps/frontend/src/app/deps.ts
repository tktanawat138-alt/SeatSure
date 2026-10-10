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
import { sampleQualityMetricsGateway } from '@/adaptor/sample/quality-metrics-gateway'
import { createLoadQualityDashboard } from '@/use-cases/load-quality-dashboard'

export const submitPaymentProof = createSubmitPaymentProof(paymentProofGateway)
export const confirmPaymentProof = createConfirmPaymentProof(paymentProofGateway)
export const loadPaymentSystem = createLoadPaymentSystem(paymentSystemGateway)
export const loadCourseRoster = createLoadCourseRoster(courseRosterGateway)
export const loadMyBookings = createLoadMyBookings(myBookingsGateway)
export const updateCourseSchedule = createUpdateCourseSchedule(courseScheduleGateway)
export const loadQualityDashboard = createLoadQualityDashboard(sampleQualityMetricsGateway)

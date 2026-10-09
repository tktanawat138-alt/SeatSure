import type { Course } from '@/entities/course'
import type { PaymentSystemGateway } from '@/interfaces/payment-system-gateway'
import { supabase } from '@/lib/supabase'

export const paymentSystemGateway: PaymentSystemGateway = {
  async load() {
    const [courses, refunds] = await Promise.all([
      supabase.from('course_seats').select().order('created_at'),
      supabase.from('refund_reports').select().order('created_at', { ascending: false }),
    ])
    if (courses.error) throw courses.error
    if (refunds.error) throw refunds.error
    return { courses: (courses.data ?? []) as Course[], refunds: refunds.data ?? [] }
  },
}

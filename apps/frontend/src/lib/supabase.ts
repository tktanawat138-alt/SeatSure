import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { Course } from '@/entities/course'
export type { Course } from '@/entities/course'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local. Run: task up')
}

export const supabase = createClient<Database>(url, anonKey)

type Tables = Database['public']['Tables']
export type Profile = Tables['profiles']['Row']
export type Booking = Tables['bookings']['Row']
export type Payment = Tables['payments']['Row']
export type RefundReport = Tables['refund_reports']['Row']
export type PaymentProof = Tables['payment_proofs']['Row']

export async function fetchCourses(teacherId?: string): Promise<Course[]> {
  let query = supabase.from('course_seats').select().order('created_at')
  if (teacherId) query = query.eq('teacher_id', teacherId)
  const { data, error } = await query
  if (error) throw error
  return data as Course[]
}

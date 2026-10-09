import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local. Run: npm run setup')
}

export const supabase = createClient<Database>(url, anonKey)

type Tables = Database['public']['Tables']
export type Profile = Tables['profiles']['Row']
export type Booking = Tables['bookings']['Row']
export type Payment = Tables['payments']['Row']
export type BookingMode = 'safe' | 'unsafe'

/** A row of the course_seats view. (Generated view types mark every column nullable.) */
export interface Course {
  id: string
  title: string
  description: string
  teacher_id: string | null
  teacher_name: string | null
  capacity: number
  price: number
  registration_open: boolean
  seats_taken: number
}

export async function fetchCourses(teacherId?: string): Promise<Course[]> {
  let query = supabase.from('course_seats').select().order('created_at')
  if (teacherId) query = query.eq('teacher_id', teacherId)
  const { data, error } = await query
  if (error) throw error
  return data as Course[]
}

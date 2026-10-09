import { supabase, type Course } from '@/lib/supabase'

export async function fetchRoster(courseId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles(full_name), payments(*)')
    .eq('course_id', courseId)
    .order('created_at')
  if (error) throw error
  return data
}

export type RosterRow = Awaited<ReturnType<typeof fetchRoster>>[number]

/** The roster on screen: `rows` is null until it has loaded, `error` is set when loading failed. */
export interface RosterView {
  course: Course
  rows: RosterRow[] | null
  error: string
}

/** Money taken that does not match exactly one paid seat. */
export function paymentProblem(row: RosterRow) {
  const charges = row.payments.filter((p) => p.status === 'succeeded').length
  if (charges > 1) return 'เก็บเงินซ้ำ'
  if (charges === 1 && row.status !== 'paid') return 'รับเงินแล้วแต่ไม่มีที่นั่ง'
  return null
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Actor } from '../../entities/actor'
import type { ApprovalStatus, Course } from '../../entities/course'
import { DomainError } from '../../entities/domain-error'
import type { CourseChanges, CourseRepository } from '../../interfaces/course-repository'
import type { SupabaseConfig } from './config'

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const COLUMNS = '*, teacher:profiles(full_name)'

interface CourseRow {
  id: string
  title: string
  description: string
  teacher_id: string | null
  capacity: number
  price: number
  registration_open: boolean
  cancelled_at: string | null
  cancellation_reason: string | null
  starts_at: string | null
  ends_at: string | null
  approval_status: ApprovalStatus
  approval_note: string | null
  teacher: { full_name: string } | null
}

/** SQL exceptions raised by the guards, mapped to the API's error codes. */
const RAISED: Record<string, string> = {
  admin_required: 'forbidden',
  teachers_may_only_change_schedule: 'forbidden',
}

/** Never includes the database message when it could echo data: only the known rule codes pass. */
function failure(step: string, error: { code?: string; message?: string }): Error {
  if (error.code === 'P0001' && error.message) return new DomainError(RAISED[error.message] ?? error.message)
  if (error.code === '42501') return new DomainError('forbidden')
  if (error.code === '23514' && error.message?.includes('courses_valid_schedule')) return new DomainError('invalid_course_schedule')
  return new Error(`courses ${step} failed (${error.code ?? 'unknown'})`)
}

export function createSupabaseCourseRepository(config: SupabaseConfig): CourseRepository {
  const service = createClient(config.url, config.serviceRoleKey, clientOptions)
  // Writes run as the signed-in user so row level security and the guard triggers decide.
  const asUser = (token: string): SupabaseClient =>
    createClient(config.url, config.anonKey, { ...clientOptions, global: { headers: { Authorization: `Bearer ${token}` } } })

  /** Seats in use per approved course. Courses that are not approved cannot have bookings. */
  async function seatsOf(rows: CourseRow[]): Promise<Map<string, number>> {
    const approved = rows.filter((r) => r.approval_status === 'approved').map((r) => r.id)
    if (approved.length === 0) return new Map()
    const { data, error } = await service.from('course_seats').select('id, seats_taken').in('id', approved)
    if (error) throw failure('seats', error)
    return new Map((data ?? []).map((r) => [r.id as string, Number(r.seats_taken)]))
  }

  async function toCourses(rows: CourseRow[]): Promise<Course[]> {
    const seats = await seatsOf(rows)
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      teacher_id: row.teacher_id,
      teacher_name: row.teacher?.full_name ?? null,
      capacity: row.capacity,
      price: Number(row.price),
      registration_open: row.registration_open,
      seats_taken: seats.get(row.id) ?? 0,
      cancelled_at: row.cancelled_at,
      cancellation_reason: row.cancellation_reason,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      approval_status: row.approval_status,
      approval_note: row.approval_note,
    }))
  }

  async function list(filter: (query: ReturnType<typeof base>) => ReturnType<typeof base>): Promise<Course[]> {
    const { data, error } = await filter(base()).order('created_at')
    if (error) throw failure('list', error)
    return toCourses((data ?? []) as unknown as CourseRow[])
  }
  const base = () => service.from('courses').select(COLUMNS)

  async function find(id: string): Promise<Course | null> {
    const { data, error } = await base().eq('id', id).maybeSingle()
    if (error) throw failure('find', error)
    return data ? (await toCourses([data as unknown as CourseRow]))[0]! : null
  }

  async function mustFind(id: string): Promise<Course> {
    const course = await find(id)
    if (!course) throw new DomainError('course_not_found')
    return course
  }

  return {
    listApproved: () => list((q) => q.eq('approval_status', 'approved')),
    listPending: () => list((q) => q.eq('approval_status', 'pending')),
    listByTeacher: (teacherId) => list((q) => q.eq('teacher_id', teacherId)),
    find,

    async create(actor: Actor, input) {
      const { data, error } = await asUser(actor.token)
        .from('courses')
        .insert({
          title: input.title,
          description: input.description,
          teacher_id: actor.id,
          capacity: input.capacity,
          price: input.price,
          registration_open: false,
          approval_status: 'pending',
          starts_at: input.startsAt,
          ends_at: input.endsAt,
        })
        .select('id')
        .single()
      if (error) throw failure('create', error)
      return mustFind(data.id as string)
    },

    async update(actor: Actor, id: string, changes: CourseChanges) {
      const row = {
        ...(changes.capacity !== undefined && { capacity: changes.capacity }),
        ...(changes.registrationOpen !== undefined && { registration_open: changes.registrationOpen }),
        ...(changes.startsAt !== undefined && { starts_at: changes.startsAt, ends_at: changes.endsAt }),
        ...(changes.approvalStatus !== undefined && { approval_status: changes.approvalStatus }),
      }
      const { data, error } = await asUser(actor.token).from('courses').update(row).eq('id', id).select('id')
      if (error) throw failure('update', error)
      // Row level security hides rows the user may not change: nothing updated means not allowed.
      if (!data?.length) throw new DomainError('forbidden')
      return mustFind(id)
    },

    async cancel(actor: Actor, id: string, reason: string) {
      const { data, error } = await asUser(actor.token).rpc('cancel_course', { p_course_id: id, p_reason: reason })
      if (error) throw failure('cancel', error)
      return Number(data ?? 0)
    },
  }
}

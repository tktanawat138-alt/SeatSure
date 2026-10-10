import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Booking, BookingRow, RosterAccess, RosterRow } from '../../entities/booking'
import { DomainError } from '../../entities/domain-error'
import type { BookingRepository } from '../../interfaces/booking-repository'
import type { SupabaseConfig } from './config'

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROOF_URL_SECONDS = 600

const ROW = 'id, course_id, user_id, student_name, status, hold_expires_at, created_at, paid_at'
const DETAIL = `${ROW}, courses(title, price), payments(id, booking_id, amount, status, receipt_no, created_at, idempotency_key), payment_proofs(id, booking_id, proof_path, submitted_at)`
// Roster columns per access level (see RosterAccess): a viewer's select never names what they may not see.
const ROSTER_ROW = 'id, student_name, status, hold_expires_at, created_at'
const ROSTER: Record<RosterAccess, string> = {
  teacher: ROSTER_ROW,
  admin: `${ROSTER_ROW}, profiles(full_name), payments(id, amount, status, receipt_no)`,
  school_admin: `${ROSTER_ROW}, profiles(full_name), payments(id, amount, status, receipt_no), payment_proofs(id, booking_id, proof_path, submitted_at)`,
}

/** payment_proofs.booking_id is unique, so PostgREST embeds it as one object (or null): always hand out a list. */
const asList = <T>(value: T | T[] | null | undefined): T[] => (value == null ? [] : Array.isArray(value) ? value : [value])

/** Never includes the message: it could quote request data. The code is enough to look it up. */
const failed = (step: string, error: PostgrestError) => new Error(`bookings ${step} failed: ${error.code || 'unknown'}`)

type DetailRow = BookingRow & { courses: Booking['courses']; payments: Booking['payments']; payment_proofs: unknown }
const toBooking = (row: DetailRow): Booking => ({ ...row, payment_proofs: asList(row.payment_proofs as Booking['payment_proofs']) })

/**
 * Bookings over Supabase. Reads use the service key, so authorization is the use case's job;
 * `bookSeat` runs as the user (anon key + their token) because the RPC reads `auth.uid()`.
 */
export function createSupabaseBookingRepository(config: SupabaseConfig): BookingRepository {
  const service = createClient(config.url, config.serviceRoleKey, clientOptions)
  // A fresh client per call: the token is never shared between requests.
  const asUser = (token: string) =>
    createClient(config.url, config.anonKey, { ...clientOptions, global: { headers: { Authorization: `Bearer ${token}` } } })

  return {
    async bookSeat(token, courseId, studentName) {
      const { data, error } = await asUser(token).rpc('book_seat', { p_course_id: courseId, p_student_name: studentName })
      if (error) {
        // `raise exception '<code>'` in the RPC arrives as P0001 with the code as the message.
        if (error.code === 'P0001') throw new DomainError(error.message)
        if (error.code === 'PGRST301' || error.code === 'PGRST303') throw new DomainError('not_authenticated')
        throw failed('book_seat', error)
      }
      return (data as { id: string }).id
    },

    async findBooking(id) {
      if (!UUID.test(id)) return null
      const { data, error } = await service.from('bookings').select(DETAIL).eq('id', id).maybeSingle()
      if (error) throw failed('find', error)
      return data ? toBooking(data as unknown as DetailRow) : null
    },

    async listOwnBookings(userId) {
      const { data, error } = await service
        .from('bookings')
        .select(DETAIL)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw failed('list own', error)
      return (data as unknown as DetailRow[]).map(toBooking)
    },

    async listActive(scope) {
      let query = service.from('bookings').select(ROW).in('status', ['held', 'paid'])
      if (!('all' in scope)) {
        let taught: string[] = []
        if (scope.teacherId) {
          const { data, error } = await service.from('courses').select('id').eq('teacher_id', scope.teacherId)
          if (error) throw failed('list taught courses', error)
          taught = data.map((c) => c.id as string)
        }
        // Ids are uuids from our own tables and the verified token, so they are safe in the filter.
        query = taught.length ? query.or(`user_id.eq.${scope.userId},course_id.in.(${taught.join(',')})`) : query.eq('user_id', scope.userId)
      }
      const { data, error } = await query.order('created_at')
      if (error) throw failed('list active', error)
      return data as unknown as BookingRow[]
    },

    async courseTeacher(courseId) {
      if (!UUID.test(courseId)) return undefined
      const { data, error } = await service.from('courses').select('teacher_id').eq('id', courseId).maybeSingle()
      if (error) throw failed('course teacher', error)
      return data ? { teacherId: (data.teacher_id as string | null) ?? null } : undefined
    },

    async roster(courseId, access) {
      const { data, error } = await service.from('bookings').select(ROSTER[access]).eq('course_id', courseId).order('created_at')
      if (error) throw failed('roster', error)
      type Raw = Pick<RosterRow, 'id' | 'student_name' | 'status' | 'hold_expires_at' | 'created_at'> & {
        profiles?: { full_name: string } | null
        payments?: RosterRow['payments']
        payment_proofs?: unknown
      }
      type Proof = Omit<RosterRow['payment_proofs'][number], 'signed_url'>
      const rows = data as unknown as Raw[]
      const proofs = rows.flatMap((row) => asList(row.payment_proofs as Proof[] | null | undefined))

      // Only school_admin selects proofs, so only school_admin gets them signed.
      const signed = new Map<string, string>()
      if (proofs.length) {
        const { data: urls, error: signError } = await service.storage
          .from('payment-proofs')
          .createSignedUrls(proofs.map((p) => p.proof_path), PROOF_URL_SECONDS)
        if (signError) throw new Error('bookings sign proof urls failed')
        for (const url of urls) if (url.path && url.signedUrl && !url.error) signed.set(url.path, url.signedUrl)
      }

      return rows.map((row) => ({
        id: row.id,
        student_name: row.student_name,
        status: row.status,
        hold_expires_at: row.hold_expires_at,
        created_at: row.created_at,
        profiles: { full_name: row.profiles?.full_name ?? '' },
        payments: row.payments ?? [],
        payment_proofs: proofs
          .filter((p) => p.booking_id === row.id)
          .map((p) => ({ ...p, signed_url: signed.get(p.proof_path) ?? null })),
      }))
    },
  }
}

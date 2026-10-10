import type { Actor, Role } from '../../src/entities/actor'
import { DomainError } from '../../src/entities/domain-error'
import type { AuthProvider } from '../../src/interfaces/auth-provider'
import type { Booking, BookingRow, RosterRow } from '../../src/entities/booking'
import type { ActiveScope, BookingRepository } from '../../src/interfaces/booking-repository'

export const COURSE_T1 = '11111111-1111-4111-8111-111111111111' // taught by u-teacher
export const COURSE_T2 = '22222222-2222-4222-8222-222222222222' // taught by u-teacher2
export const COURSE_FULL = '33333333-3333-4333-8333-333333333333'

const HOUR = 3_600_000
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

export function bookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: overrides.id ?? `b-${Math.random().toString(36).slice(2, 8)}`,
    course_id: COURSE_T1,
    user_id: 'u-parent',
    student_name: 'Mali',
    status: 'held',
    hold_expires_at: iso(HOUR),
    created_at: iso(-HOUR),
    paid_at: null,
    ...overrides,
  }
}

export const detailed = (row: BookingRow): Booking => ({
  ...row,
  courses: { title: 'Piano', price: 1500 },
  payments: [],
  payment_proofs: [{ id: `p-${row.id}`, booking_id: row.id, proof_path: `${row.user_id}/${row.id}.png`, submitted_at: row.created_at }],
})

/** In-memory BookingRepository. Records the token and options it was called with. */
export function fakeBookingRepository(rows: BookingRow[] = []) {
  const courses: Record<string, string | null> = { [COURSE_T1]: 'u-teacher', [COURSE_T2]: 'u-teacher2', [COURSE_FULL]: null }
  const calls = { bookSeat: [] as { token: string; courseId: string; studentName: string }[], roster: [] as { courseId: string; signProofs: boolean }[] }

  const repo: BookingRepository & { rows: BookingRow[]; calls: typeof calls } = {
    rows,
    calls,
    async bookSeat(token, courseId, studentName) {
      calls.bookSeat.push({ token, courseId, studentName })
      if (courseId === COURSE_FULL) throw new DomainError('course_full')
      const row = bookingRow({ course_id: courseId, user_id: token.replace(/^token-/, ''), student_name: studentName.trim() })
      rows.push(row)
      return row.id
    },
    async findBooking(id) {
      const row = rows.find((r) => r.id === id)
      return row ? detailed(row) : null
    },
    async listOwnBookings(userId) {
      return rows.filter((r) => r.user_id === userId).map(detailed)
    },
    async listActive(scope: ActiveScope) {
      return rows.filter((r) => {
        if (r.status !== 'held' && r.status !== 'paid') return false
        if ('all' in scope) return true
        return r.user_id === scope.userId || (scope.teacherId !== undefined && courses[r.course_id] === scope.teacherId)
      })
    },
    async courseTeacher(courseId) {
      return courseId in courses ? { teacherId: courses[courseId] ?? null } : undefined
    },
    async roster(courseId, { signProofs }) {
      calls.roster.push({ courseId, signProofs })
      return rows
        .filter((r) => r.course_id === courseId)
        .map(
          (r): RosterRow => ({
            id: r.id,
            student_name: r.student_name,
            status: r.status,
            hold_expires_at: r.hold_expires_at,
            created_at: r.created_at,
            profiles: { full_name: 'Parent One' },
            payments: [],
            payment_proofs: [
              { id: `p-${r.id}`, booking_id: r.id, proof_path: `${r.user_id}/${r.id}.png`, submitted_at: r.created_at, signed_url: signProofs ? `https://signed/${r.id}` : null },
            ],
          }),
        )
    },
  }
  return repo
}

type Account = { id: string; email: string; role: Role; fullName: string }

export const actors = {
  parent: { id: 'u-parent', email: 'parent@test', role: 'parent', fullName: 'Parent One' },
  parent2: { id: 'u-parent2', email: 'parent2@test', role: 'parent', fullName: 'Parent Two' },
  teacher: { id: 'u-teacher', email: 'teacher@test', role: 'teacher', fullName: 'Teacher One' },
  teacher2: { id: 'u-teacher2', email: 'teacher2@test', role: 'teacher', fullName: 'Teacher Two' },
  admin: { id: 'u-admin', email: 'admin02@seatsure.test', role: 'admin', fullName: 'Admin Two' },
  admin01: { id: 'u-admin01', email: 'Admin01@SeatSure.test', role: 'admin', fullName: 'Admin One' },
} satisfies Record<string, Account>

export type ActorName = keyof typeof actors

/** The Actor a use case receives for an account; its token is `token-<id>`. */
export const actor = (name: ActorName): Actor => {
  const { id, email, role } = actors[name]
  return { id, email, role, token: `token-${id}` }
}

/** AuthProvider that knows the accounts above by token `token-<id>`. */
export const bookingsAuthProvider = (): AuthProvider => ({
  async signIn() {
    throw new DomainError('Invalid login credentials')
  },
  async refresh() {
    throw new DomainError('not_authenticated')
  },
  async signOut() {},
  async verify(token) {
    const account = Object.values(actors).find((a) => `token-${a.id}` === token)
    if (!account) throw new DomainError('not_authenticated')
    return { id: account.id, email: account.email }
  },
  async profile(id) {
    const account = Object.values(actors).find((a) => a.id === id)
    if (!account) throw new DomainError('not_authenticated')
    return { fullName: account.fullName, role: account.role }
  },
})

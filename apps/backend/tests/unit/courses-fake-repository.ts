import type { Course } from '../../src/entities/course'
import { DomainError } from '../../src/entities/domain-error'
import type { Actor } from '../../src/entities/actor'
import type { CourseChanges, CourseRepository } from '../../src/interfaces/course-repository'

export const actors = {
  parent: { id: 'u-parent', email: 'parent@test', role: 'parent', token: 't-parent' },
  teacher: { id: 'u-teacher', email: 'teacher@test', role: 'teacher', token: 't-teacher' },
  otherTeacher: { id: 'u-teacher2', email: 'teacher2@test', role: 'teacher', token: 't-teacher2' },
  admin: { id: 'u-admin', email: 'admin@seatsure.test', role: 'admin', token: 't-admin' },
  admin01: { id: 'u-admin01', email: 'Admin01@seatsure.test', role: 'admin', token: 't-admin01' },
} satisfies Record<string, Actor>

export function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c-1',
    title: 'Math',
    description: '',
    teacher_id: actors.teacher.id,
    teacher_name: 'Teacher One',
    capacity: 10,
    price: 1500,
    registration_open: true,
    seats_taken: 0,
    cancelled_at: null,
    cancellation_reason: null,
    starts_at: '2026-11-01T09:00:00.000Z',
    ends_at: '2026-11-01T11:00:00.000Z',
    approval_status: 'approved',
    approval_note: null,
    ...overrides,
  }
}

/** In-memory CourseRepository. `calls` records every write; `failWith` makes the next write throw. */
export function fakeCourseRepository(initial: Course[] = []) {
  const courses = new Map(initial.map((c) => [c.id, c]))
  const calls: { method: string; actor?: Actor; args: unknown[] }[] = []
  let failure: string | null = null
  let nextId = 0
  const fail = () => {
    if (!failure) return
    const code = failure
    failure = null
    throw new DomainError(code)
  }

  const repository: CourseRepository & {
    calls: typeof calls
    courses: typeof courses
    failWith(code: string): void
    refundCount: number
  } = {
    calls,
    courses,
    refundCount: 0,
    failWith(code) {
      failure = code
    },
    async listApproved() {
      return [...courses.values()].filter((c) => c.approval_status === 'approved')
    },
    async listPending() {
      return [...courses.values()].filter((c) => c.approval_status === 'pending')
    },
    async listByTeacher(teacherId) {
      return [...courses.values()].filter((c) => c.teacher_id === teacherId)
    },
    async find(id) {
      return courses.get(id) ?? null
    },
    async create(actor, input) {
      calls.push({ method: 'create', actor, args: [input] })
      fail()
      const created = course({
        id: `new-${++nextId}`,
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
      courses.set(created.id, created)
      return created
    },
    async update(actor, id, changes: CourseChanges) {
      calls.push({ method: 'update', actor, args: [id, changes] })
      fail()
      const current = courses.get(id)!
      const next = {
        ...current,
        ...(changes.capacity !== undefined && { capacity: changes.capacity }),
        ...(changes.registrationOpen !== undefined && { registration_open: changes.registrationOpen }),
        ...(changes.startsAt !== undefined && { starts_at: changes.startsAt, ends_at: changes.endsAt }),
        ...(changes.approvalStatus !== undefined && { approval_status: changes.approvalStatus }),
      }
      courses.set(id, next)
      return next
    },
    async cancel(actor, id, reason) {
      calls.push({ method: 'cancel', actor, args: [id, reason] })
      fail()
      return repository.refundCount
    },
  }
  return repository
}

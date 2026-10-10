import type { Actor } from '../entities/actor'
import { endsAfterStarts, isSchoolAdmin, type Course, type NewCourse } from '../entities/course'
import { DomainError } from '../entities/domain-error'
import type { CourseChanges, CourseRepository } from '../interfaces/course-repository'

export interface CourseFilter {
  teacherId?: string
  pending?: boolean
}

type ScheduleChange = { startsAt?: string; endsAt?: string }
type UpdateInput = Pick<CourseChanges, 'capacity' | 'registrationOpen' | 'startsAt' | 'endsAt'>

const hasSchedule = (c: ScheduleChange) => c.startsAt !== undefined || c.endsAt !== undefined

export function createCourses(repo: CourseRepository) {
  async function listCourses(actor: Actor, filter: CourseFilter = {}): Promise<Course[]> {
    if (filter.pending) {
      if (actor.role !== 'admin') throw new DomainError('forbidden')
      return repo.listPending()
    }
    if (filter.teacherId !== undefined) {
      const allowed = actor.role === 'admin' || (actor.role === 'teacher' && filter.teacherId === actor.id)
      if (!allowed) throw new DomainError('forbidden')
      return repo.listByTeacher(filter.teacherId)
    }
    if (actor.role === 'teacher') return repo.listByTeacher(actor.id)
    const approved = await repo.listApproved()
    // Parents only see what can still be booked into: admins also see cancelled courses.
    return actor.role === 'admin' ? approved : approved.filter((c) => !c.cancelled_at)
  }

  async function createCourse(actor: Actor, input: NewCourse): Promise<Course> {
    if (actor.role !== 'teacher') throw new DomainError('forbidden')
    if (!endsAfterStarts(input.startsAt, input.endsAt)) throw new DomainError('invalid_course_schedule')
    return repo.create(actor, { ...input, title: input.title.trim(), description: input.description.trim() })
  }

  async function updateCourse(actor: Actor, id: string, changes: UpdateInput): Promise<Course> {
    if (actor.role !== 'admin' && actor.role !== 'teacher') throw new DomainError('forbidden')
    // Admins manage capacity and registration; teachers only move the schedule of their own course.
    if (actor.role === 'admin' && hasSchedule(changes)) throw new DomainError('forbidden')
    if (actor.role === 'teacher' && (changes.capacity !== undefined || changes.registrationOpen !== undefined)) {
      throw new DomainError('forbidden')
    }

    const course = await repo.find(id)
    if (!course) throw new DomainError('course_not_found')
    if (actor.role === 'teacher' && course.teacher_id !== actor.id) throw new DomainError('forbidden')

    if (changes.startsAt !== undefined && changes.endsAt !== undefined && !endsAfterStarts(changes.startsAt, changes.endsAt)) {
      throw new DomainError('invalid_course_schedule')
    }
    if (hasSchedule(changes) && (changes.startsAt === undefined || changes.endsAt === undefined)) {
      throw new DomainError('invalid_course_schedule')
    }
    if (changes.registrationOpen === true && course.cancelled_at) throw new DomainError('course_cancelled')

    return repo.update(actor, id, changes)
  }

  async function reviewCourse(actor: Actor, id: string, approved: boolean): Promise<Course> {
    if (!isSchoolAdmin(actor)) throw new DomainError('admin01_required')
    const course = await repo.find(id)
    if (!course) throw new DomainError('course_not_found')
    // Only the approval queue is reviewed. Withdrawing an approved course goes through cancelCourse,
    // which cancels its bookings and reports the refunds.
    if (course.approval_status !== 'pending') throw new DomainError('course_not_pending')
    return repo.update(actor, id, { approvalStatus: approved ? 'approved' : 'rejected', registrationOpen: approved })
  }

  async function cancelCourse(actor: Actor, id: string, reason: string): Promise<number> {
    if (actor.role !== 'admin') throw new DomainError('forbidden')
    const trimmed = reason.trim()
    if (!trimmed) throw new DomainError('cancellation_reason_required')
    return repo.cancel(actor, id, trimmed)
  }

  return { listCourses, createCourse, updateCourse, reviewCourse, cancelCourse }
}

export type Courses = ReturnType<typeof createCourses>

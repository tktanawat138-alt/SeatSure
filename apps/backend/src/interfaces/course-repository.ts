import type { Actor } from '../entities/actor'
import type { ApprovalStatus, Course, NewCourse } from '../entities/course'

/** Fields a use case may change in one update. `startsAt` and `endsAt` go together. */
export interface CourseChanges {
  capacity?: number
  registrationOpen?: boolean
  startsAt?: string
  endsAt?: string
  approvalStatus?: ApprovalStatus
}

/**
 * Reads are plain lookups. Writes take the actor because the database guards (row level security,
 * triggers, `cancel_course`) decide by the signed-in user. Database refusals arrive as
 * `DomainError` with the rule's code (`capacity_below_booked`, `course_cancelled`, ...).
 */
export interface CourseRepository {
  /** Approved courses, cancelled ones included, oldest first. */
  listApproved(): Promise<Course[]>
  /** Courses waiting for review, oldest first. */
  listPending(): Promise<Course[]>
  /** Every course of one teacher whatever its approval status, oldest first. */
  listByTeacher(teacherId: string): Promise<Course[]>
  find(id: string): Promise<Course | null>
  create(actor: Actor, input: NewCourse): Promise<Course>
  update(actor: Actor, id: string, changes: CourseChanges): Promise<Course>
  /** Cancels the course and returns how many refunds were reported. */
  cancel(actor: Actor, id: string, reason: string): Promise<number>
}

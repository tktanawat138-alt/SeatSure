import type { Course } from '@/entities/course'

/** A course as the API takes it: ISO 8601 date-times. */
export interface CourseInput {
  title: string
  description: string
  capacity: number
  price: number
  startsAt: string
  endsAt: string
}

/** Any of capacity, registrationOpen, or startsAt together with endsAt. */
export interface CourseChanges {
  capacity?: number
  registrationOpen?: boolean
  startsAt?: string
  endsAt?: string
}

export interface CoursesFilter {
  /** Only the signed-in teacher's own courses, pending and rejected included. */
  mine?: boolean
  /** The approval queue (admin). */
  pending?: boolean
}

/** Rejects with DomainError(code); the code is the API's error message. */
export interface CoursesGateway {
  list(filter?: CoursesFilter): Promise<Course[]>
  create(input: CourseInput): Promise<Course>
  update(courseId: string, changes: CourseChanges): Promise<Course>
  /** admin01 only. Approving also opens registration. */
  review(courseId: string, approved: boolean): Promise<Course>
  /** Admin only. Resolves with the number of refunds reported. */
  cancel(courseId: string, reason: string): Promise<number>
}

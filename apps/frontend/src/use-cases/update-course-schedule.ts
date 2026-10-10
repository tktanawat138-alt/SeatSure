import { DomainError } from '@/entities/domain-error'
import type { CoursesGateway } from '@/interfaces/courses-gateway'

export function createUpdateCourseSchedule(gateway: CoursesGateway) {
  return async (courseId: string, startsAt: string, endsAt: string) => {
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (!(end > start)) throw new DomainError('invalid_course_schedule')
    await gateway.update(courseId, { startsAt: start.toISOString(), endsAt: end.toISOString() })
  }
}

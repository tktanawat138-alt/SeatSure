import { DomainError } from '@/entities/domain-error'
import type { CourseScheduleGateway } from '@/interfaces/course-schedule-gateway'

export function createUpdateCourseSchedule(gateway: CourseScheduleGateway) {
  return async (courseId: string, startsAt: string, endsAt: string) => {
    if (new Date(endsAt) <= new Date(startsAt)) throw new DomainError('invalid_course_schedule')
    await gateway.update(courseId, startsAt, endsAt)
  }
}

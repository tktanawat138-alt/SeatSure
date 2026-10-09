import type { CourseRosterGateway } from '@/interfaces/course-roster-gateway'

export function createLoadCourseRoster(gateway: CourseRosterGateway) {
  return (courseId: string) => gateway.load(courseId)
}

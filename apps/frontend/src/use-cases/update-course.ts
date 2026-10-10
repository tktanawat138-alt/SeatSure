import type { CourseChanges, CoursesGateway } from '@/interfaces/courses-gateway'

export function createUpdateCourse(gateway: CoursesGateway) {
  return (courseId: string, changes: CourseChanges) => gateway.update(courseId, changes)
}

import type { CourseRosterRow } from '@/entities/course-roster'

export interface CourseRosterGateway {
  load(courseId: string): Promise<CourseRosterRow[]>
}

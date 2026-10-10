import type { CoursesFilter, CoursesGateway } from '@/interfaces/courses-gateway'

export function createListCourses(gateway: CoursesGateway) {
  return (filter?: CoursesFilter) => gateway.list(filter)
}

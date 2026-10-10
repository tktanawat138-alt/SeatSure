import type { CoursesGateway } from '@/interfaces/courses-gateway'

export function createReviewCourse(gateway: CoursesGateway) {
  return (courseId: string, approved: boolean) => gateway.review(courseId, approved)
}

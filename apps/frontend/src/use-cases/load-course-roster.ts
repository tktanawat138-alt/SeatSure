import type { BookingsGateway } from '@/interfaces/bookings-gateway'

export function createLoadCourseRoster(gateway: BookingsGateway) {
  return (courseId: string) => gateway.roster(courseId)
}

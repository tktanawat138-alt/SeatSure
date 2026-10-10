import { DomainError } from '@/entities/domain-error'
import type { CoursesGateway } from '@/interfaces/courses-gateway'

export function createCancelCourse(gateway: CoursesGateway) {
  return async (courseId: string, reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) throw new DomainError('cancellation_reason_required')
    return gateway.cancel(courseId, trimmed)
  }
}

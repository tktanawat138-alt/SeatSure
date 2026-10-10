import { DomainError } from '@/entities/domain-error'
import type { BookingsGateway } from '@/interfaces/bookings-gateway'

export function createBookSeat(gateway: BookingsGateway) {
  return ({ courseId, studentName }: { courseId: string; studentName: string }) => {
    const name = studentName.trim()
    if (!name) return Promise.reject(new DomainError('student_name_required'))
    return gateway.book({ courseId, studentName: name })
  }
}

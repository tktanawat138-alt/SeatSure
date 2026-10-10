import { DomainError } from '@/entities/domain-error'
import type { CoursesGateway } from '@/interfaces/courses-gateway'

/** What the new-course form holds: text fields, `datetime-local` values. */
export interface CourseDraft {
  title: string
  description: string
  capacity: string
  price: string
  startsAt: string
  endsAt: string
}

const toIso = (value: string) => {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) throw new DomainError('invalid_course_schedule')
  return new Date(time).toISOString()
}

export function createCreateCourse(gateway: CoursesGateway) {
  return async (draft: CourseDraft) => {
    const startsAt = toIso(draft.startsAt)
    const endsAt = toIso(draft.endsAt)
    if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new DomainError('invalid_course_schedule')
    return gateway.create({
      title: draft.title.trim(),
      description: draft.description.trim(),
      capacity: Number(draft.capacity),
      price: Number(draft.price),
      startsAt,
      endsAt,
    })
  }
}

import { describe, expect, it } from 'vitest'
import type { Course } from '@/entities/course'
import { DomainError } from '@/entities/domain-error'
import type { CoursesGateway } from '@/interfaces/courses-gateway'
import { createCancelCourse } from '@/use-cases/cancel-course'
import { createCreateCourse } from '@/use-cases/create-course'
import { createListCourses } from '@/use-cases/list-courses'
import { createReviewCourse } from '@/use-cases/review-course'
import { createUpdateCourse } from '@/use-cases/update-course'
import { createUpdateCourseSchedule } from '@/use-cases/update-course-schedule'

const course = { id: 'c1', title: 'Math' } as Course

function fakeGateway() {
  const log: unknown[][] = []
  const gateway: CoursesGateway = {
    list: async (filter) => (log.push(['list', filter]), [course]),
    create: async (input) => (log.push(['create', input]), course),
    update: async (id, changes) => (log.push(['update', id, changes]), course),
    review: async (id, approved) => (log.push(['review', id, approved]), course),
    cancel: async (id, reason) => (log.push(['cancel', id, reason]), 4),
  }
  return { gateway, log }
}
const code = (promise: Promise<unknown>) => promise.then(() => null, (e: DomainError) => e.code)

describe('listCourses', () => {
  it('passes the filter to the gateway and returns the courses', async () => {
    const { gateway, log } = fakeGateway()
    expect(await createListCourses(gateway)({ mine: true })).toEqual([course])
    expect(log).toEqual([['list', { mine: true }]])
  })
})

describe('createCourse', () => {
  const draft = { title: ' Physics ', description: ' d ', capacity: '20', price: '900', startsAt: '2026-12-01T09:00', endsAt: '2026-12-01T11:00' }

  it('trims text, converts numbers and dates, then creates', async () => {
    const { gateway, log } = fakeGateway()
    await createCreateCourse(gateway)(draft)
    expect(log).toEqual([
      ['create', {
        title: 'Physics',
        description: 'd',
        capacity: 20,
        price: 900,
        startsAt: new Date('2026-12-01T09:00').toISOString(),
        endsAt: new Date('2026-12-01T11:00').toISOString(),
      }],
    ])
  })

  it('a schedule that ends before it starts is rejected without a request', async () => {
    const { gateway, log } = fakeGateway()
    expect(await code(createCreateCourse(gateway)({ ...draft, endsAt: draft.startsAt }))).toBe('invalid_course_schedule')
    expect(log).toEqual([])
  })

  it('a date that cannot be read is an invalid schedule', async () => {
    const { gateway } = fakeGateway()
    expect(await code(createCreateCourse(gateway)({ ...draft, startsAt: '' }))).toBe('invalid_course_schedule')
  })
})

describe('updateCourse', () => {
  it('sends the changes', async () => {
    const { gateway, log } = fakeGateway()
    await createUpdateCourse(gateway)('c1', { capacity: 5, registrationOpen: false })
    expect(log).toEqual([['update', 'c1', { capacity: 5, registrationOpen: false }]])
  })
})

describe('updateCourseSchedule', () => {
  it('rejects an end before the start', async () => {
    const { gateway, log } = fakeGateway()
    expect(await code(createUpdateCourseSchedule(gateway)('c1', '2026-12-01T10:00:00Z', '2026-12-01T09:00:00Z'))).toBe('invalid_course_schedule')
    expect(log).toEqual([])
  })

  it('sends the schedule through the courses gateway', async () => {
    const { gateway, log } = fakeGateway()
    await createUpdateCourseSchedule(gateway)('c1', '2026-12-01T09:00:00Z', '2026-12-01T10:00:00Z')
    expect(log).toEqual([['update', 'c1', { startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T10:00:00.000Z' }]])
  })
})

describe('reviewCourse', () => {
  it('sends the decision', async () => {
    const { gateway, log } = fakeGateway()
    await createReviewCourse(gateway)('c1', false)
    expect(log).toEqual([['review', 'c1', false]])
  })
})

describe('cancelCourse', () => {
  it('trims the reason and returns the refund count', async () => {
    const { gateway, log } = fakeGateway()
    expect(await createCancelCourse(gateway)('c1', ' ฝนตก ')).toBe(4)
    expect(log).toEqual([['cancel', 'c1', 'ฝนตก']])
  })

  it('a blank reason is rejected without a request', async () => {
    const { gateway, log } = fakeGateway()
    expect(await code(createCancelCourse(gateway)('c1', '  '))).toBe('cancellation_reason_required')
    expect(log).toEqual([])
  })
})

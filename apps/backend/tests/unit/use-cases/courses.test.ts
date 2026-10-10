import { describe, expect, it } from 'vitest'
import { DomainError } from '../../../src/entities/domain-error'
import { createCourses } from '../../../src/use-cases/courses'
import { actors, course, fakeCourseRepository } from '../courses-fake-repository'

const rejection = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e)
const codeOf = async (promise: Promise<unknown>) => ((await rejection(promise)) as DomainError | null)?.code

const approved = course({ id: 'a', title: 'Approved open' })
const closedUnapproved = course({ id: 'cancelled', title: 'Cancelled', cancelled_at: '2026-10-01T00:00:00Z', registration_open: false })
const pending = course({ id: 'p', title: 'Pending', approval_status: 'pending', registration_open: false })
const rejected = course({ id: 'r', title: 'Rejected', approval_status: 'rejected', registration_open: false })
const others = course({ id: 'o', title: 'Other teacher', teacher_id: actors.otherTeacher.id })

function setup(initial = [approved, closedUnapproved, pending, rejected, others]) {
  const repo = fakeCourseRepository(initial)
  return { repo, ...createCourses(repo) }
}

describe('listCourses', () => {
  it('parent sees approved, not cancelled courses only', async () => {
    const { listCourses } = setup()
    const list = await listCourses(actors.parent)
    expect(list.map((c) => c.id).sort()).toEqual(['a', 'o'])
  })

  it('parent never sees pending or rejected courses', async () => {
    const { listCourses } = setup()
    const ids = (await listCourses(actors.parent)).map((c) => c.id)
    expect(ids).not.toContain('p')
    expect(ids).not.toContain('r')
  })

  it('teacher sees only their own courses, including pending and rejected', async () => {
    const { listCourses } = setup()
    const ids = (await listCourses(actors.teacher)).map((c) => c.id).sort()
    expect(ids).toEqual(['a', 'cancelled', 'p', 'r'])
  })

  it('teacher with a teacherId filter of their own gets the same list', async () => {
    const { listCourses } = setup()
    expect((await listCourses(actors.teacher, { teacherId: actors.teacher.id })).map((c) => c.id).sort()).toEqual(['a', 'cancelled', 'p', 'r'])
  })

  it('teacher asking for another teacher is forbidden', async () => {
    const { listCourses } = setup()
    expect(await codeOf(listCourses(actors.teacher, { teacherId: actors.otherTeacher.id }))).toBe('forbidden')
  })

  it('admin sees all approved courses including cancelled ones', async () => {
    const { listCourses } = setup()
    expect((await listCourses(actors.admin)).map((c) => c.id).sort()).toEqual(['a', 'cancelled', 'o'])
  })

  it('admin pending filter returns the approval queue', async () => {
    const { listCourses } = setup()
    expect((await listCourses(actors.admin, { pending: true })).map((c) => c.id)).toEqual(['p'])
  })

  it('admin can filter by teacher', async () => {
    const { listCourses } = setup()
    expect((await listCourses(actors.admin, { teacherId: actors.otherTeacher.id })).map((c) => c.id)).toEqual(['o'])
  })

  it.each([['parent'], ['teacher']] as const)('%s asking for the pending queue is forbidden', async (who) => {
    const { listCourses } = setup()
    expect(await codeOf(listCourses(actors[who], { pending: true }))).toBe('forbidden')
  })

  it('parent filtering by teacher is forbidden', async () => {
    const { listCourses } = setup()
    expect(await codeOf(listCourses(actors.parent, { teacherId: actors.teacher.id }))).toBe('forbidden')
  })
})

const body = { title: '  Physics ', description: ' intro ', capacity: 20, price: 900, startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T11:00:00.000Z' }

describe('createCourse', () => {
  it('teacher creates a pending course owned by them with registration closed', async () => {
    const { createCourse, repo } = setup([])
    const created = await createCourse(actors.teacher, body)
    expect(created).toMatchObject({ title: 'Physics', description: 'intro', teacher_id: actors.teacher.id, approval_status: 'pending', registration_open: false, capacity: 20, price: 900 })
    expect(repo.calls[0]!.actor).toEqual(actors.teacher)
  })

  it.each([['parent'], ['admin'], ['admin01']] as const)('%s cannot create a course', async (who) => {
    const { createCourse, repo } = setup([])
    expect(await codeOf(createCourse(actors[who], body))).toBe('forbidden')
    expect(repo.calls).toEqual([])
  })

  it('a schedule that ends before it starts is rejected', async () => {
    const { createCourse, repo } = setup([])
    expect(await codeOf(createCourse(actors.teacher, { ...body, endsAt: body.startsAt }))).toBe('invalid_course_schedule')
    expect(await codeOf(createCourse(actors.teacher, { ...body, endsAt: '2026-11-01T00:00:00.000Z' }))).toBe('invalid_course_schedule')
    expect(repo.calls).toEqual([])
  })
})

describe('updateCourse', () => {
  it('admin changes capacity and registration', async () => {
    const { updateCourse, repo } = setup()
    const updated = await updateCourse(actors.admin, 'a', { capacity: 5, registrationOpen: false })
    expect(updated).toMatchObject({ capacity: 5, registration_open: false })
    expect(repo.calls[0]).toMatchObject({ method: 'update', actor: actors.admin })
  })

  it('capacity_below_booked from the database passes through', async () => {
    const { updateCourse, repo } = setup()
    repo.failWith('capacity_below_booked')
    expect(await codeOf(updateCourse(actors.admin, 'a', { capacity: 1 }))).toBe('capacity_below_booked')
  })

  it('reopening a cancelled course is refused with course_cancelled', async () => {
    const { updateCourse, repo } = setup()
    expect(await codeOf(updateCourse(actors.admin, 'cancelled', { registrationOpen: true }))).toBe('course_cancelled')
    expect(repo.calls).toEqual([])
  })

  it('course_cancelled from the database passes through', async () => {
    const { updateCourse, repo } = setup()
    repo.failWith('course_cancelled')
    expect(await codeOf(updateCourse(actors.admin, 'a', { registrationOpen: true }))).toBe('course_cancelled')
  })

  it('closing registration of a cancelled course is allowed', async () => {
    const { updateCourse } = setup()
    expect(await updateCourse(actors.admin, 'cancelled', { registrationOpen: false })).toMatchObject({ registration_open: false })
  })

  it('admin cannot change the schedule', async () => {
    const { updateCourse } = setup()
    expect(await codeOf(updateCourse(actors.admin, 'a', { startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T10:00:00.000Z' }))).toBe('forbidden')
  })

  it('teacher changes the schedule of their own course', async () => {
    const { updateCourse } = setup()
    const updated = await updateCourse(actors.teacher, 'a', { startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T10:00:00.000Z' })
    expect(updated).toMatchObject({ starts_at: '2026-12-01T09:00:00.000Z', ends_at: '2026-12-01T10:00:00.000Z' })
  })

  it('teacher cannot edit another teacher\'s course', async () => {
    const { updateCourse, repo } = setup()
    expect(await codeOf(updateCourse(actors.teacher, 'o', { startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T10:00:00.000Z' }))).toBe('forbidden')
    expect(repo.calls).toEqual([])
  })

  it.each([[{ capacity: 3 }], [{ registrationOpen: true }]])('teacher cannot change %o', async (changes) => {
    const { updateCourse, repo } = setup()
    expect(await codeOf(updateCourse(actors.teacher, 'a', changes))).toBe('forbidden')
    expect(repo.calls).toEqual([])
  })

  it('teacher schedule that ends before it starts is rejected', async () => {
    const { updateCourse, repo } = setup()
    expect(await codeOf(updateCourse(actors.teacher, 'a', { startsAt: '2026-12-01T10:00:00.000Z', endsAt: '2026-12-01T09:00:00.000Z' }))).toBe('invalid_course_schedule')
    expect(repo.calls).toEqual([])
  })

  it('parent cannot update a course', async () => {
    const { updateCourse } = setup()
    expect(await codeOf(updateCourse(actors.parent, 'a', { capacity: 3 }))).toBe('forbidden')
  })

  it('an unknown course is course_not_found', async () => {
    const { updateCourse } = setup()
    expect(await codeOf(updateCourse(actors.admin, 'nope', { capacity: 3 }))).toBe('course_not_found')
  })
})

describe('reviewCourse', () => {
  it('admin01 approves: approved and registration opens', async () => {
    const { reviewCourse, repo } = setup()
    const reviewed = await reviewCourse(actors.admin01, 'p', true)
    expect(reviewed).toMatchObject({ approval_status: 'approved', registration_open: true })
    expect(repo.calls[0]).toMatchObject({ method: 'update', actor: actors.admin01, args: ['p', { approvalStatus: 'approved', registrationOpen: true }] })
  })

  it('admin01 rejects: rejected and registration stays closed', async () => {
    const { reviewCourse } = setup()
    expect(await reviewCourse(actors.admin01, 'p', false)).toMatchObject({ approval_status: 'rejected', registration_open: false })
  })

  it.each([['admin'], ['teacher'], ['parent']] as const)('%s is not admin01', async (who) => {
    const { reviewCourse, repo } = setup()
    expect(await codeOf(reviewCourse(actors[who], 'p', true))).toBe('admin01_required')
    expect(repo.calls).toEqual([])
  })

  it('an unknown course is course_not_found', async () => {
    const { reviewCourse } = setup()
    expect(await codeOf(reviewCourse(actors.admin01, 'nope', true))).toBe('course_not_found')
  })
})

describe('cancelCourse', () => {
  it('admin cancels and gets the refund count', async () => {
    const { cancelCourse, repo } = setup()
    repo.refundCount = 3
    expect(await cancelCourse(actors.admin, 'a', ' ฝนตก ')).toBe(3)
    expect(repo.calls[0]).toMatchObject({ method: 'cancel', actor: actors.admin, args: ['a', 'ฝนตก'] })
  })

  it.each([['teacher'], ['parent']] as const)('%s cannot cancel', async (who) => {
    const { cancelCourse, repo } = setup()
    expect(await codeOf(cancelCourse(actors[who], 'a', 'x'))).toBe('forbidden')
    expect(repo.calls).toEqual([])
  })

  it('a blank reason is refused', async () => {
    const { cancelCourse, repo } = setup()
    expect(await codeOf(cancelCourse(actors.admin, 'a', '   '))).toBe('cancellation_reason_required')
    expect(repo.calls).toEqual([])
  })

  it('course_already_cancelled from the database passes through', async () => {
    const { cancelCourse, repo } = setup()
    repo.failWith('course_already_cancelled')
    expect(await codeOf(cancelCourse(actors.admin, 'a', 'x'))).toBe('course_already_cancelled')
  })
})

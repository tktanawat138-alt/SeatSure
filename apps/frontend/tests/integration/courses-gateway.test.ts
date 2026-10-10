import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CourseDto, Session } from '@contract'
import { CreateCourseBody, UpdateCourseBody, ApprovalBody, CancelCourseBody } from '@contract'
import type { DomainError } from '@/entities/domain-error'
import { createApiClient } from '@/adaptor/http/client'
import { createCoursesGateway } from '@/adaptor/http/courses-gateway'
import { createSessionStore } from '@/adaptor/http/session-store'
import { api, authorization, stubNetwork } from './stub-network'

afterEach(() => vi.unstubAllGlobals())

const BASE = 'http://api.test'
const session: Session = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 2_000_000_000 }
const ok = (data: unknown) => ({ body: { success: true, data } })
const fail = (status: number, message: string) => ({ status, body: { success: false, message } })
const dto = { id: 'c1', title: 'Math', approval_status: 'approved' } as CourseDto

function setup() {
  const items = new Map<string, string>()
  const store = createSessionStore(() => ({
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  }))
  store.set(session)
  return createCoursesGateway(createApiClient({ baseUrl: BASE, store }))
}
const body = (init?: RequestInit) => JSON.parse(String(init?.body))
const rejection = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e as DomainError)

describe('coursesGateway', () => {
  it('list without a filter gets /courses with the bearer token', async () => {
    const calls = stubNetwork(api('GET', '/courses', ok([dto])))
    expect(await setup().list()).toEqual([dto])
    expect(calls[0]!.url.search).toBe('')
    expect(authorization(calls[0]!.init)).toBe('Bearer access-1')
  })

  it('list with mine asks for mine=true', async () => {
    const calls = stubNetwork(api('GET', '/courses', ok([])))
    await setup().list({ mine: true })
    expect(calls[0]!.url.searchParams.get('mine')).toBe('true')
    expect(calls[0]!.url.searchParams.has('pending')).toBe(false)
  })

  it('list with pending asks for pending=true', async () => {
    const calls = stubNetwork(api('GET', '/courses', ok([])))
    await setup().list({ pending: true })
    expect(calls[0]!.url.searchParams.get('pending')).toBe('true')
  })

  it('create posts a body the contract accepts', async () => {
    const calls = stubNetwork(api('POST', '/courses', ok(dto)))
    const input = { title: 'Physics', description: '', capacity: 20, price: 900, startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T11:00:00.000Z' }
    expect(await setup().create(input)).toEqual(dto)
    expect(CreateCourseBody.parse(body(calls[0]!.init))).toEqual(input)
  })

  it('update patches /courses/:id with a body the contract accepts', async () => {
    const calls = stubNetwork(api('PATCH', '/courses/c1', ok(dto)))
    await setup().update('c1', { capacity: 5, registrationOpen: false })
    expect(UpdateCourseBody.parse(body(calls[0]!.init))).toEqual({ capacity: 5, registrationOpen: false })
  })

  it('update sends the schedule as startsAt and endsAt', async () => {
    const calls = stubNetwork(api('PATCH', '/courses/c1', ok(dto)))
    const schedule = { startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T10:00:00.000Z' }
    await setup().update('c1', schedule)
    expect(UpdateCourseBody.parse(body(calls[0]!.init))).toEqual(schedule)
  })

  it('review posts the decision to /courses/:id/approval', async () => {
    const calls = stubNetwork(api('POST', '/courses/c1/approval', ok(dto)))
    await setup().review('c1', true)
    expect(ApprovalBody.parse(body(calls[0]!.init))).toEqual({ approved: true })
  })

  it('cancel posts the reason to /courses/:id/cancel and returns the refund count', async () => {
    const calls = stubNetwork(api('POST', '/courses/c1/cancel', ok(3)))
    expect(await setup().cancel('c1', 'ฝนตก')).toBe(3)
    expect(CancelCourseBody.parse(body(calls[0]!.init))).toEqual({ reason: 'ฝนตก' })
  })

  it.each([
    ['capacity_below_booked', 400],
    ['course_cancelled', 400],
    ['admin01_required', 403],
    ['course_not_found', 404],
  ])('a failed update surfaces %s as the error code', async (message, status) => {
    stubNetwork(api('PATCH', '/courses/c1', fail(status, message)))
    expect((await rejection(setup().update('c1', { capacity: 1 })))?.code).toBe(message)
  })

  it('an id is URL-encoded in the path', async () => {
    const calls = stubNetwork(api('PATCH', '/courses/a%2Fb', ok(dto)))
    await setup().update('a/b', { capacity: 1 })
    expect(calls[0]!.url.pathname).toBe('/courses/a%2Fb')
  })
})

import { createHash } from 'node:crypto'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { createApp } from '../../../src/app'
import { hashEmail, securityLog } from '../../../src/adaptor/http/security-log'
import { course, fakeCourseRepository } from '../courses-fake-repository'
import { accounts, tokenFor } from './fake-auth-provider'
import { fakeAppDeps } from './fake-deps'

accounts.push({ id: 'u-admin01', email: 'admin01@seatsure.test', password: 'pw', fullName: 'Admin 01', role: 'admin' })

const ID = '11111111-1111-4111-8111-111111111111'
const PENDING = '22222222-2222-4222-8222-222222222222'

function setup() {
  const courseRepository = fakeCourseRepository([
    course({ id: ID, teacher_id: 'u-teacher' }),
    course({ id: PENDING, teacher_id: 'u-teacher', approval_status: 'pending', registration_open: false }),
  ])
  return createApp(fakeAppDeps({ courseRepository }))
}
const as = (id: string) => ({ Authorization: `Bearer ${tokenFor(id)}` })

let info: MockInstance<typeof console.info>
beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => info.mockRestore())

/** Every line written so far, parsed. Each call must be exactly one JSON object. */
const lines = () => info.mock.calls.map((call) => {
  expect(call).toHaveLength(1)
  return JSON.parse(call[0] as string) as Record<string, unknown>
})
const output = () => info.mock.calls.map((call) => String(call[0])).join('\n')

describe('securityLog', () => {
  it('securityLog writes one JSON line with a timestamp and the event fields', () => {
    securityLog({ event: 'x', status: 401 })
    expect(info).toHaveBeenCalledTimes(1)
    expect(lines()[0]).toEqual({ ts: expect.any(String), event: 'x', status: 401 })
  })

  it('hashEmail is a 12 hex SHA-256 prefix of the trimmed, lowercased email', () => {
    const expected = createHash('sha256').update('parent@test').digest('hex').slice(0, 12)
    expect(hashEmail(' Parent@Test ')).toBe(expected)
    expect(hashEmail('parent@test')).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe('security events over HTTP', () => {
  it('failed login logs login_failed with the email hash and ip, never the email or password', async () => {
    await request(setup()).post('/auth/login').send({ email: 'Parent@Test', password: 'wrong-secret' })
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'login_failed', email_hash: hashEmail('parent@test'), ip: expect.any(String) },
    ])
    expect(output()).not.toMatch(/parent@test/i)
    expect(output()).not.toContain('wrong-secret')
  })

  it('successful login logs nothing and never the issued tokens', async () => {
    const res = await request(setup()).post('/auth/login').send({ email: 'parent@test', password: 'pw' })
    expect(res.status).toBe(200)
    expect(info).not.toHaveBeenCalled()
  })

  it('401 without a token logs unauthorized with method, route and status', async () => {
    await request(setup()).get('/courses?pending=true')
    expect(lines()).toEqual([{ ts: expect.any(String), event: 'unauthorized', method: 'GET', path: '/courses', status: 401 }])
  })

  it('401 with a bad token never writes the token or the Authorization header', async () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.secret-token-value.sig'
    await request(setup()).get('/me').set('Authorization', `Bearer ${token}`)
    expect(lines()).toEqual([{ ts: expect.any(String), event: 'unauthorized', method: 'GET', path: '/me', status: 401 }])
    expect(output()).not.toContain('secret-token-value')
    expect(output()).not.toMatch(/bearer/i)
  })

  it('403 from the role guard logs forbidden with the actor id and the route pattern, not the id', async () => {
    await request(setup()).post(`/courses/${PENDING}/approval`).set(as('u-teacher')).send({ approved: true })
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'forbidden', method: 'POST', path: '/courses/:id/approval', status: 403, actor: 'u-teacher' },
    ])
    expect(output()).not.toContain(tokenFor('u-teacher'))
  })

  it('403 from a use case logs forbidden without the query string', async () => {
    await request(setup()).get('/courses?pending=true').set(as('u-teacher'))
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'forbidden', method: 'GET', path: '/courses', status: 403, actor: 'u-teacher' },
    ])
  })

  it('admin01 approving logs admin_action course_review with actor, course and outcome ok', async () => {
    await request(setup()).post(`/courses/${PENDING}/approval`).set(as('u-admin01')).send({ approved: true })
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'admin_action', action: 'course_review', decision: 'approve', actor: 'u-admin01', course: PENDING, outcome: 'ok', status: 200 },
    ])
  })

  it('a refused review logs the error code as outcome', async () => {
    await request(setup()).post(`/courses/${ID}/approval`).set(as('u-admin01')).send({ approved: false })
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'admin_action', action: 'course_review', decision: 'reject', actor: 'u-admin01', course: ID, outcome: 'course_not_pending', status: 409 },
    ])
  })

  it('a review by another admin logs one admin_action with admin01_required', async () => {
    await request(setup()).post(`/courses/${PENDING}/approval`).set(as('u-admin')).send({ approved: true })
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'admin_action', action: 'course_review', decision: 'approve', actor: 'u-admin', course: PENDING, outcome: 'admin01_required', status: 403 },
    ])
  })

  it('admin capacity change logs admin_action course_update', async () => {
    await request(setup()).patch(`/courses/${ID}`).set(as('u-admin')).send({ capacity: 4 })
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'admin_action', action: 'course_update', actor: 'u-admin', course: ID, outcome: 'ok', status: 200 },
    ])
  })

  it('a teacher schedule change is not an admin action and logs nothing', async () => {
    await request(setup())
      .patch(`/courses/${ID}`)
      .set(as('u-teacher'))
      .send({ startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T10:00:00.000Z' })
    expect(info).not.toHaveBeenCalled()
  })

  it('admin cancel logs admin_action course_cancel, without the reason', async () => {
    await request(setup()).post(`/courses/${ID}/cancel`).set(as('u-admin')).send({ reason: 'secret reason text' })
    expect(lines()).toEqual([
      { ts: expect.any(String), event: 'admin_action', action: 'course_cancel', actor: 'u-admin', course: ID, outcome: 'ok', status: 200 },
    ])
    expect(output()).not.toContain('secret reason text')
  })

  it('an ordinary successful request logs nothing', async () => {
    await request(setup()).get('/courses').set(as('u-parent'))
    expect(info).not.toHaveBeenCalled()
  })
})

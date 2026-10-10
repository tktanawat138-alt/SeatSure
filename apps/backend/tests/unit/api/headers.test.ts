import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../../src/app'
import { tokenFor } from './fake-auth-provider'
import { fakeAppDeps } from './fake-deps'

// Security review L2: no fingerprinting header, nosniff everywhere, no caching of tokens or PII.
const app = createApp(fakeAppDeps())
const bearer = { Authorization: `Bearer ${tokenFor('u-parent')}` }

describe('security headers', () => {
  it.each([
    ['GET /health', () => request(app).get('/health')],
    ['an unknown route (404)', () => request(app).get('/nope')],
    ['an error response (401)', () => request(app).get('/me')],
    ['POST /auth/login', () => request(app).post('/auth/login').send({ email: 'parent@test', password: 'pw' })],
  ])('%s has no X-Powered-By and sends X-Content-Type-Options nosniff', async (_n, call) => {
    const res = await call()
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it.each([
    ['POST /auth/login', () => request(app).post('/auth/login').send({ email: 'parent@test', password: 'pw' })],
    ['POST /auth/login failing', () => request(app).post('/auth/login').send({ email: 'parent@test', password: 'bad' })],
    ['POST /auth/refresh', () => request(app).post('/auth/refresh').send({ refreshToken: 'refresh-u-parent-1' })],
    ['POST /auth/logout', () => request(app).post('/auth/logout').set(bearer)],
    ['GET /me', () => request(app).get('/me').set(bearer)],
    ['GET /me without a token', () => request(app).get('/me')],
    ['GET /ME/ (case and trailing slash)', () => request(app).get('/ME/').set(bearer)],
  ])('%s sends Cache-Control no-store', async (_n, call) => {
    expect((await call()).headers['cache-control']).toBe('no-store')
  })

  it('GET /health is not marked no-store', async () => {
    expect((await request(app).get('/health')).headers['cache-control']).toBeUndefined()
  })
})

import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../../src/app'
import { fakeAuthProvider, tokenFor } from './fake-auth-provider'

function setup() {
  const authProvider = fakeAuthProvider()
  const app = createApp({ frontendOrigin: 'http://localhost:5173', authProvider })
  return { app, authProvider }
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

describe('POST /auth/login', () => {
  it('valid credentials return 200 with the session', async () => {
    const { app } = setup()
    const res = await request(app).post('/auth/login').send({ email: 'parent@test', password: 'pw' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({ accessToken: tokenFor('u-parent'), expiresAt: 2_000_000_000 })
    expect(typeof res.body.data.refreshToken).toBe('string')
  })

  it('wrong password returns 401 Invalid login credentials', async () => {
    const { app } = setup()
    const res = await request(app).post('/auth/login').send({ email: 'parent@test', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'Invalid login credentials' })
  })

  it('missing password returns 400 with a field error', async () => {
    const { app } = setup()
    const res = await request(app).post('/auth/login').send({ email: 'parent@test' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.errors).toEqual([{ field: 'password', message: expect.any(String) }])
  })
})

describe('POST /auth/refresh', () => {
  it('valid refresh token returns 200 with a new session', async () => {
    const { app } = setup()
    const login = await request(app).post('/auth/login').send({ email: 'parent@test', password: 'pw' })
    const res = await request(app).post('/auth/refresh').send({ refreshToken: login.body.data.refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.data.refreshToken).not.toBe(login.body.data.refreshToken)
  })

  it('unknown refresh token returns 401 not_authenticated', async () => {
    const { app } = setup()
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'nope' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })

  it('missing refresh token returns 400', async () => {
    const { app } = setup()
    const res = await request(app).post('/auth/refresh').send({})
    expect(res.status).toBe(400)
    expect(res.body.errors[0].field).toBe('refreshToken')
  })
})

describe('POST /auth/logout', () => {
  it('signs out the bearer token server-side and returns 200', async () => {
    const { app, authProvider } = setup()
    const res = await request(app).post('/auth/logout').set(bearer(tokenFor('u-parent')))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: null })
    expect(authProvider.signedOut).toEqual([tokenFor('u-parent')])
    const after = await request(app).get('/me').set(bearer(tokenFor('u-parent')))
    expect(after.status).toBe(401)
  })

  it('without a token returns 401 not_authenticated', async () => {
    const { app } = setup()
    const res = await request(app).post('/auth/logout')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })
})

describe('GET /me', () => {
  it('returns the profile of the bearer', async () => {
    const { app } = setup()
    const res = await request(app).get('/me').set(bearer(tokenFor('u-teacher')))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { id: 'u-teacher', email: 'teacher@test', fullName: 'Teacher One', role: 'teacher' },
    })
  })

  it.each([
    ['no Authorization header', undefined],
    ['an invalid token', 'Bearer bogus'],
    ['an empty bearer', 'Bearer '],
    ['a non-bearer scheme', `Basic ${tokenFor('u-teacher')}`],
  ])('with %s returns 401 not_authenticated', async (_case, header) => {
    const { app } = setup()
    const req = request(app).get('/me')
    if (header !== undefined) req.set('Authorization', header)
    const res = await req
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })

  it('a valid token whose profile is gone returns 401 not_authenticated', async () => {
    const { app } = setup()
    const res = await request(app).get('/me').set(bearer(tokenFor('u-orphan')))
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('not_authenticated')
  })
})

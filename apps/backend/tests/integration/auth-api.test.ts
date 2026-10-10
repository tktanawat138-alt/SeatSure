import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { createSupabaseAuthProvider } from '../../src/adaptor/supabase/auth-provider'

// The API over HTTP (supertest, no listening process) with the real Supabase auth adaptor.
const app = createApp({
  frontendOrigin: 'http://localhost:5173',
  authProvider: createSupabaseAuthProvider({
    url: process.env.VITE_SUPABASE_URL!,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
})

const PASSWORD = 'seatsure123'

async function login(email: string) {
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD })
  expect(res.status).toBe(200)
  return res.body.data as { accessToken: string; refreshToken: string; expiresAt: number }
}

const me = (token: string) => request(app).get('/me').set('Authorization', `Bearer ${token}`)

describe('auth API against real Supabase', () => {
  it('login as parent1 returns a session whose token works on /me', async () => {
    const session = await login('parent1@seatsure.test')
    expect(session.accessToken).toEqual(expect.any(String))
    expect(session.refreshToken).toEqual(expect.any(String))
    expect(session.expiresAt).toBeGreaterThan(Date.now() / 1000)

    const res = await me(session.accessToken)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ email: 'parent1@seatsure.test', role: 'parent' })
    expect(res.body.data.fullName).toEqual(expect.any(String))
    expect(res.body.data.id).toEqual(expect.any(String))
  })

  it('login with a wrong password returns 401 Invalid login credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'parent1@seatsure.test', password: 'wrong-password' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'Invalid login credentials' })
  })

  it('/me reports the role of teacher and admin accounts', async () => {
    const teacher = await login('teacher1@seatsure.test')
    expect((await me(teacher.accessToken)).body.data.role).toBe('teacher')
    const admin = await login('admin01@seatsure.test')
    expect((await me(admin.accessToken)).body.data.role).toBe('admin')
  })

  it('refresh issues a new session that works on /me', async () => {
    const session = await login('parent2@seatsure.test')
    const res = await request(app).post('/auth/refresh').send({ refreshToken: session.refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.data.refreshToken).not.toBe(session.refreshToken)
    expect((await me(res.body.data.accessToken)).status).toBe(200)
  })

  it('refresh with a made-up token returns 401 not_authenticated', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-real-refresh-token' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })

  it('logout invalidates the session: the old access and refresh tokens stop working', async () => {
    const session = await login('parent3@seatsure.test')
    const other = await login('parent3@seatsure.test') // a second device stays signed in

    const res = await request(app).post('/auth/logout').set('Authorization', `Bearer ${session.accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: null })

    const after = await me(session.accessToken)
    expect(after.status).toBe(401)
    expect(after.body).toEqual({ success: false, message: 'not_authenticated' })
    const refresh = await request(app).post('/auth/refresh').send({ refreshToken: session.refreshToken })
    expect(refresh.status).toBe(401)

    expect((await me(other.accessToken)).status).toBe(200)
  })

  it('a garbage bearer token returns 401 not_authenticated', async () => {
    const res = await me('garbage.token.value')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })
})

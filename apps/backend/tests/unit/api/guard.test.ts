import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createRequireAuth } from '../../../src/adaptor/http/guard'
import { errorHandler } from '../../../src/adaptor/http/error-handler'
import { createAuth } from '../../../src/use-cases/auth'
import { fakeAuthProvider, tokenFor } from './fake-auth-provider'

function appWith(roles?: Parameters<ReturnType<typeof createRequireAuth>>[0]) {
  const requireAuth = createRequireAuth(createAuth(fakeAuthProvider()).authenticate)
  const app = express()
  app.get('/private', requireAuth(roles), (req, res) => {
    res.json({ success: true, data: { id: req.actor?.id, role: req.actor?.role } })
  })
  app.use(errorHandler)
  return app
}

describe('requireAuth', () => {
  it('without a header returns 401 not_authenticated', async () => {
    const res = await request(appWith()).get('/private')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })

  it('with an expired or invalid token returns 401 not_authenticated', async () => {
    const res = await request(appWith()).get('/private').set('Authorization', 'Bearer expired.jwt.token')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })

  it('with a valid token and no role list sets req.actor', async () => {
    const res = await request(appWith()).get('/private').set('Authorization', `Bearer ${tokenFor('u-parent')}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ id: 'u-parent', role: 'parent' })
  })

  it('with a role not in the list returns 403 forbidden', async () => {
    const res = await request(appWith(['admin'])).get('/private').set('Authorization', `Bearer ${tokenFor('u-parent')}`)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ success: false, message: 'forbidden' })
  })

  it('with a role in the list passes', async () => {
    const res = await request(appWith(['teacher', 'admin']))
      .get('/private')
      .set('Authorization', `bearer ${tokenFor('u-admin')}`)
    expect(res.status).toBe(200)
    expect(res.body.data.role).toBe('admin')
  })
})

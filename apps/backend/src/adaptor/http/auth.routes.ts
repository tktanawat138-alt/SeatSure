import { Router } from 'express'
import type { Auth } from '../../use-cases/auth'
import { LoginBody, RefreshBody, type Envelope, type Me, type Session } from './contract'
import { actorOf, type RequireAuth } from './guard'

export function authRoutes(auth: Auth, requireAuth: RequireAuth): Router {
  const router = Router()

  router.post('/auth/login', async (req, res) => {
    const { email, password } = LoginBody.parse(req.body)
    const body: Envelope<Session> = { success: true, data: await auth.login(email, password) }
    res.json(body)
  })

  router.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = RefreshBody.parse(req.body)
    const body: Envelope<Session> = { success: true, data: await auth.refresh(refreshToken) }
    res.json(body)
  })

  router.post('/auth/logout', requireAuth(), async (req, res) => {
    await auth.logout(actorOf(req))
    const body: Envelope<null> = { success: true, data: null }
    res.json(body)
  })

  router.get('/me', requireAuth(), async (req, res) => {
    const body: Envelope<Me> = { success: true, data: await auth.me(actorOf(req)) }
    res.json(body)
  })

  return router
}

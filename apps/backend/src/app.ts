import cors from 'cors'
import express from 'express'
import { authRoutes } from './adaptor/http/auth.routes'
import { errorHandler } from './adaptor/http/error-handler'
import { createRequireAuth } from './adaptor/http/guard'
import type { AuthProvider } from './interfaces/auth-provider'
import { createAuth } from './use-cases/auth'

export interface AppDeps {
  frontendOrigin: string
  authProvider: AuthProvider
}

export function createApp(deps: AppDeps): express.Express {
  const auth = createAuth(deps.authProvider)
  const requireAuth = createRequireAuth(auth.authenticate)

  const app = express()
  app.use(
    cors({
      origin: (origin, done) => done(null, origin === deps.frontendOrigin ? origin : false),
    }),
  )
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { ok: true } })
  })
  app.use(authRoutes(auth, requireAuth))

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Not found' })
  })
  app.use(errorHandler)
  return app
}

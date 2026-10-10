import cors from 'cors'
import express from 'express'
import { authRoutes } from './adaptor/http/auth.routes'
import { bookingsRoutes, type BookingsDeps } from './adaptor/http/bookings.routes'
import { coursesRoutes, type CoursesDeps } from './adaptor/http/courses.routes'
import { paymentsRoutes, type PaymentsDeps } from './adaptor/http/payments.routes'
import { errorHandler } from './adaptor/http/error-handler'
import { createRequireAuth } from './adaptor/http/guard'
import { accessLog } from './adaptor/http/security-log'
import type { AuthProvider } from './interfaces/auth-provider'
import { createAuth } from './use-cases/auth'

export interface AppDeps extends CoursesDeps, BookingsDeps, PaymentsDeps {
  frontendOrigin: string
  authProvider: AuthProvider
}

export function createApp(deps: AppDeps): express.Express {
  const auth = createAuth(deps.authProvider)
  const requireAuth = createRequireAuth(auth.authenticate)

  const app = express()
  app.use(accessLog)
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
  app.use(coursesRoutes(deps, requireAuth))
  app.use(bookingsRoutes(deps, requireAuth))
  app.use(paymentsRoutes(deps, requireAuth))

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Not found' })
  })
  app.use(errorHandler)
  return app
}

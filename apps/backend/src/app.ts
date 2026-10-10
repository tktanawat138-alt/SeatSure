import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export interface AppDeps {
  frontendOrigin: string
}

type Failure = { success: false; message: string; errors?: unknown }

// Every error leaves the API in the same envelope. Validation failures are 400;
// anything unexpected is a 500 whose detail is logged, never sent.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const body: Failure = { success: false, message: 'Validation failed', errors: err.issues }
    res.status(400).json(body)
    return
  }
  if (err?.type === 'entity.parse.failed') {
    const body: Failure = { success: false, message: 'Invalid JSON body' }
    res.status(400).json(body)
    return
  }
  console.error('Unhandled error:', err instanceof Error ? err.message : 'unknown')
  const body: Failure = { success: false, message: 'Internal server error' }
  res.status(500).json(body)
}

export function createApp(deps: AppDeps): express.Express {
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

  app.use((_req, res) => {
    const body: Failure = { success: false, message: 'Not found' }
    res.status(404).json(body)
  })
  app.use(errorHandler)
  return app
}

import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { DomainError } from '../../entities/domain-error'

type Failure = { success: false; message: string; errors?: { field: string; message: string }[] }

function statusOf(code: string): number {
  if (code === 'not_authenticated' || code === 'Invalid login credentials') return 401
  if (code === 'forbidden' || code === 'admin01_required') return 403
  if (code === 'rate_limited') return 429
  if (code.endsWith('_not_found')) return 404
  return 400
}

// Every error leaves the API in the same envelope. Domain errors carry their code as the
// message; anything unexpected is a 500 whose detail is logged, never sent.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    const body: Failure = { success: false, message: err.code }
    res.status(statusOf(err.code)).json(body)
    return
  }
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
    const body: Failure = { success: false, message: 'Validation failed', errors }
    res.status(400).json(body)
    return
  }
  if (err?.type === 'entity.parse.failed') {
    const body: Failure = { success: false, message: 'Invalid JSON body' }
    res.status(400).json(body)
    return
  }
  const status = err?.status ?? err?.statusCode
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    const body: Failure = { success: false, message: typeof err.message === 'string' ? err.message : 'Bad request' }
    res.status(status).json(body)
    return
  }
  console.error('Unhandled error:', err instanceof Error ? err.message : 'unknown')
  const body: Failure = { success: false, message: 'Internal server error' }
  res.status(500).json(body)
}

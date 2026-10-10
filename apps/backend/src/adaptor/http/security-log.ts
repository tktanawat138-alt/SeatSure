import { createHash } from 'node:crypto'
import type { Request, RequestHandler, Response } from 'express'

/**
 * Security event log (security review M7): one JSON line per event on stdout, for the log
 * collector. Only ids, route patterns, status codes and error codes go in. Never tokens,
 * passwords, request bodies, the Authorization header or an email in clear.
 */
type Field = string | number | boolean | undefined

export function securityLog(event: { event: string } & Record<string, Field>): void {
  console.info(JSON.stringify({ ts: new Date().toISOString(), ...event }))
}

/** Short SHA-256 prefix of the normalised email: correlates attempts without storing the address. */
export const hashEmail = (email: string): string =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12)

/** The error handler stores the failure code here so a finished response can be logged with it. */
export const errorCodeOf = (res: Response): string | undefined => res.locals.errorCode
export function rememberErrorCode(res: Response, code: string): void {
  res.locals.errorCode = code
}

const logged = (res: Response) => res.locals.securityLogged === true

/** The matched route pattern (`/courses/:id`), never the raw URL with ids or the query string. */
const routeOf = (req: Request): string => (req.route?.path as string | undefined) ?? req.path

/**
 * App-wide: logs every 401 and 403 once the response is sent. A 401 from `POST /auth/login` is a
 * failed login and is logged as `login_failed` with the email hash and the client ip.
 */
export const accessLog: RequestHandler = (req, res, next) => {
  res.on('finish', () => {
    if ((res.statusCode !== 401 && res.statusCode !== 403) || logged(res)) return
    const path = routeOf(req)
    if (req.method === 'POST' && path === '/auth/login' && res.statusCode === 401) {
      const email: unknown = req.body?.email
      securityLog({ event: 'login_failed', email_hash: typeof email === 'string' ? hashEmail(email) : undefined, ip: req.ip })
      return
    }
    securityLog({
      event: res.statusCode === 401 ? 'unauthorized' : 'forbidden',
      method: req.method,
      path,
      status: res.statusCode,
      actor: req.actor?.id,
    })
  })
  next()
}

/**
 * Route-level, after `requireAuth`: logs an admin action on a course with its outcome (`ok` or
 * the error code). Only admins are audited; the course id comes from the path.
 */
export function auditCourseAction(action: string, detail: (req: Request) => Record<string, Field> = () => ({})): RequestHandler {
  return (req, res, next) => {
    if (req.actor?.role === 'admin') {
      const fields = { action, ...detail(req), actor: req.actor.id, course: String(req.params.id) }
      res.locals.securityLogged = true
      res.on('finish', () => {
        const ok = res.statusCode < 400
        securityLog({ event: 'admin_action', ...fields, outcome: ok ? 'ok' : (errorCodeOf(res) ?? 'error'), status: res.statusCode })
      })
    }
    next()
  }
}

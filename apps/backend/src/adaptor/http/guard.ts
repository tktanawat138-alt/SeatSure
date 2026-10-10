import type { RequestHandler } from 'express'
import type { Actor, Role } from '../../entities/actor'
import { DomainError } from '../../entities/domain-error'

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      actor?: Actor
    }
  }
}

const BEARER = /^Bearer\s+(\S+)$/i

/** Returns `requireAuth(roles?)`: 401 not_authenticated without a valid bearer, 403 forbidden for other roles. */
export function createRequireAuth(authenticate: (token: string) => Promise<Actor>) {
  return (roles?: Role[]): RequestHandler =>
    async (req, _res, next) => {
      const token = BEARER.exec(req.get('authorization') ?? '')?.[1]
      if (!token) throw new DomainError('not_authenticated')
      const actor = await authenticate(token)
      // Set before the role check so a refused request is still logged with who made it.
      req.actor = actor
      if (roles && !roles.includes(actor.role)) throw new DomainError('forbidden')
      next()
    }
}

export type RequireAuth = ReturnType<typeof createRequireAuth>

/** The actor set by requireAuth. Use only on routes behind it. */
export function actorOf(req: { actor?: Actor }): Actor {
  if (!req.actor) throw new DomainError('not_authenticated')
  return req.actor
}

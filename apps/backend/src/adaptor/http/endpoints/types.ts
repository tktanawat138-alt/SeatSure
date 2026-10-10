import type { ZodType } from 'zod'
import type { Role } from '../../../entities/actor'

/**
 * One API operation, described once. The OpenAPI spec that Fern renders is generated from these
 * (`npm run docs:openapi` in apps/backend), so this registry is the single source of truth for the
 * HTTP surface; request/response shapes come from `../contract.ts`.
 */
export interface Endpoint {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  /** Express-style path, e.g. `/bookings/:id/confirm-payment`. */
  path: string
  operationId: string
  summary: string
  /** Business rules and edge cases in plain words (shown in the docs). */
  description?: string
  tag: 'Health' | 'Auth' | 'Courses' | 'Bookings' | 'Payments'
  /** `public` needs no token; `any` needs a valid token; a role list restricts the roles. */
  auth: 'public' | 'any' | Role[]
  request?: { body: ZodType; contentType?: string }
  /** Schema of `data` in the success envelope; null when `data` is null. */
  response: ZodType | null
  /** Error codes (`message`) this operation can return, with their HTTP status. */
  errors: { status: number; code: string; description?: string }[]
}

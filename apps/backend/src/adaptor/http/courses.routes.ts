import { Router } from 'express'
import type { RequireAuth } from './guard'

/** Ports the courses use cases need. Filled in by the courses group. */
export type CoursesDeps = Record<never, never>

export function coursesRoutes(_deps: CoursesDeps, _requireAuth: RequireAuth): Router {
  return Router()
}

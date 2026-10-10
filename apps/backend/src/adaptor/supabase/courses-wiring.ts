import type { CoursesDeps } from '../http/courses.routes'
import type { SupabaseConfig } from './config'

/** Builds the courses ports over Supabase. Filled in by the courses group. */
export function wireCourses(_config: SupabaseConfig): CoursesDeps {
  return {}
}

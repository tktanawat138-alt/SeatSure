import type { CoursesDeps } from '../http/courses.routes'
import type { SupabaseConfig } from './config'
import { createSupabaseCourseRepository } from './course-repository'

/** Builds the courses ports over Supabase. */
export function wireCourses(config: SupabaseConfig): CoursesDeps {
  return { courseRepository: createSupabaseCourseRepository(config) }
}

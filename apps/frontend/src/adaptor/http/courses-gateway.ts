import type { CourseDto, ApprovalBody, CancelCourseBody, CreateCourseBody, UpdateCourseBody } from '@contract'
import type { CoursesGateway } from '@/interfaces/courses-gateway'
import { apiClient, type ApiClient } from './client'

export function createCoursesGateway(client: ApiClient): CoursesGateway {
  const path = (courseId: string) => `/courses/${encodeURIComponent(courseId)}`

  return {
    list(filter = {}) {
      const query = new URLSearchParams()
      if (filter.mine) query.set('mine', 'true')
      if (filter.pending) query.set('pending', 'true')
      const suffix = query.size > 0 ? `?${query}` : ''
      return client.request<CourseDto[]>('GET', `/courses${suffix}`)
    },
    create: (input) => client.request<CourseDto>('POST', '/courses', input satisfies CreateCourseBody),
    update: (courseId, changes) => client.request<CourseDto>('PATCH', path(courseId), changes satisfies UpdateCourseBody),
    review: (courseId, approved) =>
      client.request<CourseDto>('POST', `${path(courseId)}/approval`, { approved } satisfies ApprovalBody),
    cancel: (courseId, reason) => client.request<number>('POST', `${path(courseId)}/cancel`, { reason } satisfies CancelCourseBody),
  }
}

export const coursesGateway = createCoursesGateway(apiClient)

import { Router } from 'express'
import { z } from 'zod'
import { DomainError } from '../../entities/domain-error'
import type { CourseRepository } from '../../interfaces/course-repository'
import { createCourses } from '../../use-cases/courses'
import { ApprovalBody, CancelCourseBody, CreateCourseBody, UpdateCourseBody, type CourseDto, type Envelope } from './contract'
import { actorOf, type RequireAuth } from './guard'

/** Ports the courses use cases need. */
export interface CoursesDeps {
  courseRepository: CourseRepository
}

const flag = z.enum(['true', 'false']).optional()
const ListQuery = z.object({ pending: flag, mine: flag })

/** A path id that is not a uuid cannot name a course. */
const courseId = (raw: unknown): string => {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw new DomainError('course_not_found')
  return parsed.data
}

export function coursesRoutes(deps: CoursesDeps, requireAuth: RequireAuth): Router {
  const router = Router()
  const courses = createCourses(deps.courseRepository)

  router.get('/courses', requireAuth(), async (req, res) => {
    const query = ListQuery.parse(req.query)
    const actor = actorOf(req)
    const list = await courses.listCourses(actor, {
      pending: query.pending === 'true',
      teacherId: query.mine === 'true' ? actor.id : undefined,
    })
    const body: Envelope<CourseDto[]> = { success: true, data: list }
    res.json(body)
  })

  router.post('/courses', requireAuth(['teacher']), async (req, res) => {
    const body: Envelope<CourseDto> = {
      success: true,
      data: await courses.createCourse(actorOf(req), CreateCourseBody.parse(req.body)),
    }
    res.json(body)
  })

  router.patch('/courses/:id', requireAuth(['teacher', 'admin']), async (req, res) => {
    const id = courseId(req.params.id)
    const body: Envelope<CourseDto> = {
      success: true,
      data: await courses.updateCourse(actorOf(req), id, UpdateCourseBody.parse(req.body)),
    }
    res.json(body)
  })

  router.post('/courses/:id/approval', requireAuth(['admin']), async (req, res) => {
    const id = courseId(req.params.id)
    const { approved } = ApprovalBody.parse(req.body)
    const body: Envelope<CourseDto> = { success: true, data: await courses.reviewCourse(actorOf(req), id, approved) }
    res.json(body)
  })

  router.post('/courses/:id/cancel', requireAuth(['admin']), async (req, res) => {
    const id = courseId(req.params.id)
    const { reason } = CancelCourseBody.parse(req.body)
    const body: Envelope<number> = { success: true, data: await courses.cancelCourse(actorOf(req), id, reason) }
    res.json(body)
  })

  return router
}

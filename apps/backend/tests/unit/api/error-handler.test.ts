import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { errorHandler } from '../../../src/adaptor/http/error-handler'
import { DomainError } from '../../../src/entities/domain-error'

function throwing(error: unknown) {
  const app = express()
  app.get('/boom', () => {
    throw error
  })
  app.use(errorHandler)
  return app
}

describe('errorHandler', () => {
  it.each([
    ['not_authenticated', 401],
    ['Invalid login credentials', 401],
    ['forbidden', 403],
    ['rate_limited', 429],
    ['course_not_found', 404],
    ['booking_not_found', 404],
    ['course_full', 400],
  ])('DomainError %s maps to %i with the code as message', async (code, status) => {
    const res = await request(throwing(new DomainError(code))).get('/boom')
    expect(res.status).toBe(status)
    expect(res.body).toEqual({ success: false, message: code })
  })

  it('ZodError maps to 400 with field errors, root-level issues get an empty field', async () => {
    const schema = z
      .object({ a: z.object({ b: z.string() }), c: z.number().optional() })
      .refine((v) => v.c !== undefined, { message: 'c is required' })
    const result = schema.safeParse({ a: { b: 1 } })
    const res = await request(throwing(result.error)).get('/boom')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe('Validation failed')
    expect(res.body.errors).toContainEqual({ field: 'a.b', message: expect.any(String) })

    const root = schema.safeParse({ a: { b: 'x' } })
    const res2 = await request(throwing(root.error)).get('/boom')
    expect(res2.body.errors).toEqual([{ field: '', message: 'c is required' }])
  })

  it('unknown errors map to 500 without leaking the message', async () => {
    const res = await request(throwing(new Error('secret token abc'))).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ success: false, message: 'Internal server error' })
  })
})

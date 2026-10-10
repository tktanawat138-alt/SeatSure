import { z } from 'zod'
import type { Endpoint } from './types'

export const healthEndpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/health',
    operationId: 'health',
    summary: 'Liveness check',
    description: 'Answers `{ ok: true }` when the API process is up. Does not check Supabase.',
    tag: 'Health',
    auth: 'public',
    response: z.object({ ok: z.boolean() }),
    errors: [],
  },
]

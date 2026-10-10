// Builds the OpenAPI 3.1 document that Fern renders as the API reference.
// Source of truth: the endpoint registry (src/adaptor/http/endpoints) and the zod schemas in
// src/adaptor/http/contract.ts. Run `npm run docs:openapi` (or `task docs:openapi`) after changing either.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import * as contract from '../src/adaptor/http/contract'
import { endpoints as registry, type Endpoint } from '../src/adaptor/http/endpoints'

export const OPENAPI_PATH = join(import.meta.dirname, '../../../docs/fern/openapi/openapi.json')

type Json = Record<string, unknown>

export interface OpenApiDocument {
  openapi: string
  info: { title: string; version: string; description: string }
  servers: { url: string; description: string }[]
  tags: { name: string; description: string }[]
  paths: Record<string, Record<string, unknown>>
  components: { securitySchemes: Record<string, unknown>; schemas: Record<string, unknown> }
}

const TAGS: Record<Endpoint['tag'], string> = {
  Health: 'Liveness check.',
  Auth: 'Sign in, refresh, sign out and the current user.',
  Courses: 'Course catalogue, creation, approval, updates and cancellation.',
  Bookings: 'Seat holds, a parent\'s bookings and a course roster.',
  Payments: 'Bank transfer proof, payment confirmation, admin payment overview and refund report.',
}

/** What each error code means. Codes not listed here are described by the endpoint entry itself. */
const GENERIC_ERRORS: Record<string, string> = {
  'Validation failed': 'The body or a parameter failed validation; `errors` lists each field.',
  'Invalid JSON body': 'The request body is not valid JSON.',
  not_authenticated: 'Missing, malformed, expired or revoked bearer token.',
  forbidden: 'The signed-in role may not call this operation.',
}

// Named schemas: every exported zod schema of contract.ts becomes `components.schemas.<Name>`
// (`CourseDto` -> `Course`), so responses reference it instead of repeating it.
const names = z.registry<{ id: string }>()
for (const [name, value] of Object.entries(contract)) {
  if (value instanceof z.ZodType) names.add(value, { id: name.replace(/Dto$/, '') })
}

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean)
  if (!node || typeof node !== 'object') return node
  const out: Json = {}
  for (const [k, v] of Object.entries(node)) {
    if (k === '$schema') continue
    // zod expands date-time and safe-integer bounds into noise that the docs do not need.
    if (k === 'pattern' && (node as Json).format === 'date-time') continue
    if (k === 'maximum' && v === Number.MAX_SAFE_INTEGER) continue
    out[k] = k === '$ref' && typeof v === 'string' ? v.replace('#/$defs/', '#/components/schemas/') : clean(v)
  }
  return out
}

/** JSON Schema for a zod schema; named schemas are collected into `schemas` and referenced. */
function schemaOf(schema: z.ZodType, io: 'input' | 'output', schemas: Json): Json {
  const { $defs, ...rest } = z.toJSONSchema(schema, { metadata: names, io, reused: 'inline', unrepresentable: 'any' }) as Json
  for (const [id, def] of Object.entries(($defs ?? {}) as Json)) schemas[id] ??= clean(def)
  return clean(rest) as Json
}

const success = (data: Json): Json => ({
  type: 'object',
  required: ['success', 'data'],
  properties: { success: { type: 'boolean', enum: [true] }, data },
})

interface ErrorEntry {
  status: number
  code: string
  description?: string
}

/** The entry's own errors plus the ones every operation of its kind has (validation, 401, 403). */
function errorsOf(e: Endpoint): ErrorEntry[] {
  const all: ErrorEntry[] = [...e.errors]
  const add = (status: number, code: string) => {
    if (!all.some((x) => x.status === status && x.code === code)) all.push({ status, code })
  }
  if (e.request) add(400, 'Validation failed')
  if (e.auth !== 'public') add(401, 'not_authenticated')
  if (Array.isArray(e.auth)) add(403, 'forbidden')
  return all.sort((a, b) => a.status - b.status)
}

function accessText(auth: Endpoint['auth']): string {
  if (auth === 'public') return 'Public, no token needed.'
  if (auth === 'any') return 'Requires a bearer token (any role).'
  return `Requires a bearer token with role: ${auth.join(', ')}.`
}

function describe(e: Endpoint, errors: ErrorEntry[]): string {
  const lines = [e.description?.trim(), accessText(e.auth)].filter(Boolean) as string[]
  if (errors.length > 0) {
    lines.push(
      'Errors (the `message` of the failure envelope):\n\n' +
        errors
          .map((x) => `- \`${x.status}\` \`${x.code}\`${x.description ?? GENERIC_ERRORS[x.code] ? `: ${x.description ?? GENERIC_ERRORS[x.code]}` : ''}`)
          .join('\n'),
    )
  }
  return lines.join('\n\n')
}

function operation(e: Endpoint, schemas: Json): Json {
  const errors = errorsOf(e)
  const op: Json = { tags: [e.tag], operationId: e.operationId, summary: e.summary, description: describe(e, errors) }

  const params = [...e.path.matchAll(/:(\w+)/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }))
  if (params.length > 0) op.parameters = params

  if (e.request) {
    const contentType = e.request.contentType ?? 'application/json'
    let schema = schemaOf(e.request.body, 'input', schemas)
    if (contentType !== 'application/json' && Object.keys(schema).length === 0) schema = { type: 'string', format: 'binary' }
    op.requestBody = { required: true, content: { [contentType]: { schema } } }
  }

  const data = e.response ? schemaOf(e.response, 'output', schemas) : { type: 'null' }
  const responses: Json = {
    '200': { description: 'Success', content: { 'application/json': { schema: success(data) } } },
  }
  for (const status of [...new Set(errors.map((x) => x.status))]) {
    responses[String(status)] = {
      description: errors
        .filter((x) => x.status === status)
        .map((x) => `\`${x.code}\``)
        .join(', '),
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Failure' } } },
    }
  }
  op.responses = responses
  op.security = e.auth === 'public' ? [] : [{ bearerAuth: [] }]
  return op
}

export function buildOpenApi(endpoints: Endpoint[]): OpenApiDocument {
  const schemas: Json = {
    Failure: {
      type: 'object',
      description: 'Every error leaves the API in this envelope. `message` is the error code (or `Validation failed`).',
      required: ['success', 'message'],
      properties: {
        success: { type: 'boolean', enum: [false] },
        message: { type: 'string' },
        errors: { type: 'array', items: { $ref: '#/components/schemas/FieldError' } },
      },
    },
    FieldError: {
      type: 'object',
      required: ['field', 'message'],
      properties: { field: { type: 'string' }, message: { type: 'string' } },
    },
  }

  const paths: Record<string, Record<string, unknown>> = {}
  for (const e of endpoints) {
    const path = e.path.replace(/:(\w+)/g, '{$1}')
    paths[path] ??= {}
    paths[path][e.method] = operation(e, schemas)
  }

  const used = new Set(endpoints.map((e) => e.tag))
  return {
    openapi: '3.1.0',
    info: {
      title: 'SeatSure API',
      version: '0.1.0',
      description:
        'HTTP API of SeatSure. Every success response is `{ "success": true, "data": ... }`; every failure is `{ "success": false, "message": "<code>", "errors"?: [...] }`. Generated from the endpoint registry; do not edit by hand.',
    },
    servers: [{ url: 'http://localhost:3001', description: 'Local development (`task up`)' }],
    tags: (Object.keys(TAGS) as Endpoint['tag'][]).filter((t) => used.has(t)).map((name) => ({ name, description: TAGS[name] })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'The `accessToken` from `POST /auth/login` or `POST /auth/refresh`.',
        },
      },
      schemas: Object.fromEntries(Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b))),
    },
  }
}

export const serializeOpenApi = (doc: OpenApiDocument): string => `${JSON.stringify(doc, null, 2)}\n`

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(dirname(OPENAPI_PATH), { recursive: true })
  writeFileSync(OPENAPI_PATH, serializeOpenApi(buildOpenApi(registry)))
  console.log(`wrote ${OPENAPI_PATH}`)
}

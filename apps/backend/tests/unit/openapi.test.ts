import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp, type AppDeps } from '../../src/app'
import { endpoints, type Endpoint } from '../../src/adaptor/http/endpoints'
import { buildOpenApi, OPENAPI_PATH, serializeOpenApi } from '../../scripts/gen-openapi'
import { fakeAuthProvider } from './api/fake-auth-provider'

const key = (method: string, path: string) => `${method.toUpperCase()} ${path}`

// Ports of the groups are not needed to list routes: any property a router reads off `deps` resolves
// to an inert stub, so this test keeps working as groups add their own ports.
function stub(): unknown {
  const fn = () => stub()
  return new Proxy(fn, { get: (_t, prop) => (prop === 'then' ? undefined : stub()), apply: () => stub() })
}
function appDeps(): AppDeps {
  const base = { frontendOrigin: 'http://localhost:5173', authProvider: fakeAuthProvider() }
  return new Proxy(base, { get: (t, prop) => (prop in t ? t[prop as keyof typeof t] : stub()) }) as unknown as AppDeps
}

interface Layer {
  route?: { path: string; stack: { method?: string }[] }
  handle?: { stack?: Layer[] }
}

/** `METHOD /path` for every route mounted on the app. Routers are mounted at the root (`app.use(router)`). */
function mountedRoutes(): string[] {
  const app = createApp(appDeps()) as unknown as { router: { stack: Layer[] } }
  const found: string[] = []
  const walk = (stack: Layer[]) => {
    for (const layer of stack) {
      if (layer.route) {
        // Each handler of a route is a layer with the same method; count the route once per method.
        const methods = new Set(layer.route.stack.flatMap((l) => (l.method ? [l.method] : [])))
        for (const method of methods) found.push(key(method, layer.route.path))
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack)
      }
    }
  }
  walk(app.router.stack)
  return found.sort()
}

describe('openapi spec', () => {
  const doc = buildOpenApi(endpoints)

  it('matches docs/fern/openapi/openapi.json (run `task docs:openapi` after changing an endpoint)', () => {
    let committed = ''
    try {
      committed = readFileSync(OPENAPI_PATH, 'utf8')
    } catch {
      // handled by the assertion below
    }
    expect(
      serializeOpenApi(doc) === committed,
      `docs/fern/openapi/openapi.json is missing or stale. Run \`task docs:openapi\` and commit the result.`,
    ).toBe(true)
  })

  it('has exactly one registry entry for every route mounted on the app, and vice versa', () => {
    const mounted = mountedRoutes()
    const registered = endpoints.map((e) => key(e.method, e.path)).sort()

    const duplicated = registered.filter((r, i) => registered.indexOf(r) !== i)
    expect(duplicated, `registry entries declared more than once: ${duplicated.join(', ')}`).toEqual([])

    const mountedTwice = mounted.filter((r, i) => mounted.indexOf(r) !== i)
    expect(mountedTwice, `routes mounted more than once: ${mountedTwice.join(', ')}`).toEqual([])

    const notDocumented = mounted.filter((r) => !registered.includes(r))
    expect(
      notDocumented,
      `routes mounted on createApp without a registry entry (add them to adaptor/http/endpoints/<group>.ts): ${notDocumented.join(', ')}`,
    ).toEqual([])

    const notMounted = registered.filter((r) => !mounted.includes(r))
    expect(
      notMounted,
      `registry entries with no mounted route (route removed or path/method differs): ${notMounted.join(', ')}`,
    ).toEqual([])
  })

  describe.each(endpoints.map((e): [string, Endpoint] => [key(e.method, e.path), e]))('%s', (_name, e) => {
    it('has a summary, an operationId and error codes', () => {
      expect(e.summary.trim(), 'summary is empty').not.toBe('')
      expect(e.operationId.trim(), 'operationId is empty').not.toBe('')
      if (e.tag !== 'Health') expect(e.errors.length, 'list at least one error (status + code)').toBeGreaterThan(0)
    })
  })

  it('has unique operationIds', () => {
    const ids = endpoints.map((e) => e.operationId)
    const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(duplicated, `operationId used by more than one entry: ${duplicated.join(', ')}`).toEqual([])
  })

  it('has the OpenAPI top-level sections', () => {
    expect(doc.openapi).toMatch(/^3\.1\./)
    expect(doc.info.title).toBeTruthy()
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0)
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' })
    expect(doc.components.schemas).toBeTruthy()
  })

  it('documents every endpoint under its path with {param} syntax, tag and bearer security', () => {
    for (const e of endpoints) {
      const path = e.path.replace(/:(\w+)/g, '{$1}')
      const op = (doc.paths[path] as Record<string, any> | undefined)?.[e.method]
      expect(op, `${key(e.method, e.path)} missing from the document`).toBeTruthy()
      expect(op.operationId).toBe(e.operationId)
      expect(op.tags).toEqual([e.tag])
      expect(op.security).toEqual(e.auth === 'public' ? [] : [{ bearerAuth: [] }])
      expect(op.description).toContain(e.errors[0] ? e.errors[0].code : '')
      expect(op.responses['200'].content['application/json'].schema.properties.success).toBeTruthy()
    }
  })

  it('resolves every $ref', () => {
    const refs: string[] = []
    const visit = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(visit)
      else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k === '$ref' && typeof v === 'string') refs.push(v)
          else visit(v)
        }
      }
    }
    visit(doc)
    const unresolved = refs.filter((ref) => {
      if (!ref.startsWith('#/')) return true
      let cur: unknown = doc
      for (const part of ref.slice(2).split('/')) cur = (cur as Record<string, unknown> | undefined)?.[part]
      return cur === undefined
    })
    expect(unresolved, `unresolved $ref: ${unresolved.join(', ')}`).toEqual([])
  })
})

// Keeps the committed path honest if the folder is moved.
describe('openapi path', () => {
  it('points inside docs/fern/openapi', () => {
    expect(OPENAPI_PATH).toBe(join(import.meta.dirname, '../../../../docs/fern/openapi/openapi.json'))
  })
})

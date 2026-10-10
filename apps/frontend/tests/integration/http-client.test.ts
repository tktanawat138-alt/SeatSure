import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@contract'
import { DomainError } from '@/entities/domain-error'
import { createApiClient } from '@/adaptor/http/client'
import { createAuthGateway } from '@/adaptor/http/auth-gateway'
import { createSessionStore } from '@/adaptor/http/session-store'
import { api, authorization, stubNetwork } from './stub-network'

afterEach(() => vi.unstubAllGlobals())

const BASE = 'http://api.test'
const session = (n: number): Session => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresAt: 2_000_000_000 })
const ok = (data: unknown) => ({ body: { success: true, data } })
const fail = (status: number, message: string) => ({ status, body: { success: false, message } })

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

function setup(initial: Session | null = null, timeoutMs?: number) {
  const storage = memoryStorage()
  const store = createSessionStore(() => storage)
  if (initial) store.set(initial)
  const client = createApiClient({ baseUrl: BASE, store, timeoutMs })
  return { store, client }
}

const rejection = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e as DomainError)

/** GET /courses answers 200 only to the current token `access-<good>`. */
const coursesFor = (good: number) =>
  api('GET', '/courses', (init) => (authorization(init) === `Bearer access-${good}` ? ok(['c1']) : fail(401, 'not_authenticated')))

describe('apiClient', () => {
  it('request when signed out sends no Authorization header', async () => {
    const calls = stubNetwork(api('GET', '/courses', ok([])))
    const { client } = setup()
    await client.request('GET', '/courses')
    expect(authorization(calls[0]!.init)).toBeNull()
    expect(calls[0]!.url.href).toBe(`${BASE}/courses`)
  })

  it('request when signed in sends the bearer token and unwraps the envelope data', async () => {
    stubNetwork(coursesFor(1))
    const { client } = setup(session(1))
    expect(await client.request('GET', '/courses')).toEqual(['c1'])
  })

  it('request with a body sends JSON', async () => {
    const calls = stubNetwork(api('POST', '/bookings', ok({ id: 'b1' })))
    const { client } = setup()
    await client.request('POST', '/bookings', { courseId: 'c1' })
    expect(new Headers(calls[0]!.init?.headers).get('content-type')).toBe('application/json')
    expect(calls[0]!.init?.body).toBe(JSON.stringify({ courseId: 'c1' }))
  })

  it('401 refreshes once and retries the original request with the new token', async () => {
    const calls = stubNetwork(coursesFor(2), api('POST', '/auth/refresh', ok(session(2))))
    const { client, store } = setup(session(1))

    expect(await client.request('GET', '/courses')).toEqual(['c1'])

    expect(calls.map((c) => c.url.pathname)).toEqual(['/courses', '/auth/refresh', '/courses'])
    expect(authorization(calls[1]!.init)).toBeNull()
    expect(calls[1]!.init?.body).toBe(JSON.stringify({ refreshToken: 'refresh-1' }))
    expect(store.get()).toEqual(session(2))
  })

  it('parallel 401s share a single refresh', async () => {
    const calls = stubNetwork(coursesFor(2), api('POST', '/auth/refresh', ok(session(2))))
    const { client } = setup(session(1))

    const results = await Promise.all([1, 2, 3].map(() => client.request('GET', '/courses')))

    expect(results).toEqual([['c1'], ['c1'], ['c1']])
    expect(calls.filter((c) => c.url.pathname === '/auth/refresh')).toHaveLength(1)
  })

  it('refresh failure clears the store and rejects with not_authenticated', async () => {
    const calls = stubNetwork(coursesFor(2), api('POST', '/auth/refresh', fail(401, 'not_authenticated')))
    const { client, store } = setup(session(1))

    const error = await rejection(client.request('GET', '/courses'))

    expect(error).toBeInstanceOf(DomainError)
    expect(error?.code).toBe('not_authenticated')
    expect(store.get()).toBeNull()
    expect(calls.map((c) => c.url.pathname)).toEqual(['/courses', '/auth/refresh'])
  })

  it('a retry that is still 401 clears the store and does not loop', async () => {
    const calls = stubNetwork(coursesFor(99), api('POST', '/auth/refresh', ok(session(2))))
    const { client, store } = setup(session(1))

    const error = await rejection(client.request('GET', '/courses'))

    expect(error?.code).toBe('not_authenticated')
    expect(store.get()).toBeNull()
    expect(calls.map((c) => c.url.pathname)).toEqual(['/courses', '/auth/refresh', '/courses'])
  })

  it.each([400, 403])('a %i from refresh also clears the store and rejects with not_authenticated', async (status) => {
    stubNetwork(coursesFor(2), api('POST', '/auth/refresh', fail(status, 'invalid_grant')))
    const { client, store } = setup(session(1))
    expect((await rejection(client.request('GET', '/courses')))?.code).toBe('not_authenticated')
    expect(store.get()).toBeNull()
  })

  it.each([
    [500, 'Internal server error'],
    [429, 'rate_limited'],
  ])('a %i from refresh keeps the session and rejects with the server code', async (status, message) => {
    stubNetwork(coursesFor(2), api('POST', '/auth/refresh', fail(status, message)))
    const { client, store } = setup(session(1))
    expect((await rejection(client.request('GET', '/courses')))?.code).toBe(message)
    expect(store.get()).toEqual(session(1))
  })

  it('a network failure during refresh keeps the session', async () => {
    const { client, store } = setup(session(1))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input.endsWith('/auth/refresh')
          ? Promise.reject(new TypeError('fetch failed'))
          : new Response(JSON.stringify({ success: false, message: 'not_authenticated' }), { status: 401 }),
      ),
    )
    expect((await rejection(client.request('GET', '/courses')))?.code).toBe('network_error')
    expect(store.get()).toEqual(session(1))
  })

  it('after another tab rotated the token, a 401 retry uses the stored newer token without a refresh', async () => {
    const storage = memoryStorage()
    const otherTab = createSessionStore(() => storage)
    const store = createSessionStore(() => storage)
    store.set(session(1))
    const client = createApiClient({ baseUrl: BASE, store })
    const calls = stubNetwork(
      api('GET', '/courses', (init) => {
        if (authorization(init) === 'Bearer access-2') return ok(['c1'])
        otherTab.set(session(2)) // tab A rotates while this request is in flight
        return fail(401, 'not_authenticated')
      }),
      api('POST', '/auth/refresh', fail(401, 'not_authenticated')),
    )

    expect(await client.request('GET', '/courses')).toEqual(['c1'])
    expect(calls.map((c) => c.url.pathname)).toEqual(['/courses', '/courses'])
  })

  it('after another tab rotated the token, a refresh uses the newer refresh token', async () => {
    const storage = memoryStorage()
    const otherTab = createSessionStore(() => storage)
    const store = createSessionStore(() => storage)
    store.set(session(1))
    otherTab.set(session(2))
    const client = createApiClient({ baseUrl: BASE, store })
    const calls = stubNetwork(coursesFor(3), api('POST', '/auth/refresh', ok(session(3))))

    expect(await client.request('GET', '/courses')).toEqual(['c1'])
    expect(authorization(calls[0]!.init)).toBe('Bearer access-2')
    expect(calls[1]!.init?.body).toBe(JSON.stringify({ refreshToken: 'refresh-2' }))
    expect(otherTab.get()).toEqual(session(3))
  })

  it('a 401 without a session does not refresh and maps the message', async () => {
    const calls = stubNetwork(api('POST', '/auth/login', fail(401, 'Invalid login credentials')))
    const { client } = setup()

    const error = await rejection(client.request('POST', '/auth/login', { email: 'a', password: 'b' }))

    expect(error?.code).toBe('Invalid login credentials')
    expect(calls).toHaveLength(1)
  })

  it('an envelope error maps to DomainError with the message as code', async () => {
    stubNetwork(api('POST', '/bookings', fail(400, 'course_full')))
    const { client, store } = setup(session(1))

    const error = await rejection(client.request('POST', '/bookings', {}))

    expect(error).toBeInstanceOf(DomainError)
    expect(error?.code).toBe('course_full')
    expect(store.get()).toEqual(session(1))
  })

  it('a network failure rejects with network_error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))))
    const { client } = setup()
    expect((await rejection(client.request('GET', '/courses')))?.code).toBe('network_error')
  })

  it('a non-JSON response rejects with network_error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    const { client } = setup()
    expect((await rejection(client.request('GET', '/courses')))?.code).toBe('network_error')
  })

  it('a request that outlives the timeout rejects with timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))),
      ),
    )
    const { client } = setup(null, 20)
    expect((await rejection(client.request('GET', '/courses')))?.code).toBe('timeout')
  })
})

describe('sessionStore', () => {
  it('set persists to storage and a new store reads it back', () => {
    const storage = memoryStorage()
    createSessionStore(() => storage).set(session(1))
    expect(createSessionStore(() => storage).get()).toEqual(session(1))
  })

  it('clear removes the session and notifies subscribers until they unsubscribe', () => {
    const storage = memoryStorage()
    const store = createSessionStore(() => storage)
    const seen: (Session | null)[] = []
    const unsubscribe = store.subscribe((s) => seen.push(s))
    store.set(session(1))
    store.clear()
    unsubscribe()
    store.set(session(2))
    expect(seen).toEqual([session(1), null])
    expect(store.get()).toEqual(session(2))
  })

  it('survives localStorage throwing on every access, keeping the session in memory', () => {
    const boom = () => {
      throw new Error('SecurityError')
    }
    const store = createSessionStore(() => ({ getItem: boom, setItem: boom, removeItem: boom }))
    expect(store.get()).toBeNull()
    store.set(session(1))
    expect(store.get()).toEqual(session(1))
    store.clear()
    expect(store.get()).toBeNull()
  })

  it('survives the localStorage getter itself throwing', () => {
    const store = createSessionStore(() => {
      throw new Error('blocked')
    })
    store.set(session(1))
    expect(store.get()).toEqual(session(1))
  })

  it('two stores sharing storage: a rotation by one is read by the other', () => {
    const storage = memoryStorage()
    const tabA = createSessionStore(() => storage)
    const tabB = createSessionStore(() => storage)
    tabA.set(session(1))
    expect(tabB.get()).toEqual(session(1))
    tabA.set(session(2))
    expect(tabB.get()).toEqual(session(2))
    tabA.clear()
    expect(tabB.get()).toBeNull()
  })

  it('keeps the session in memory when storage reads work but writes throw', () => {
    const store = createSessionStore(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => undefined,
    }))
    store.set(session(1))
    expect(store.get()).toEqual(session(1))
  })

  it('notifies subscribers when another tab changes the session key', () => {
    const win = new EventTarget()
    vi.stubGlobal('window', win)
    const storage = memoryStorage()
    const store = createSessionStore(() => storage)
    const seen: (Session | null)[] = []
    store.subscribe((s) => seen.push(s))

    storage.setItem('seatsure.session', JSON.stringify(session(2))) // written by another tab
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'seatsure.session' }))
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated' }))
    storage.removeItem('seatsure.session')
    win.dispatchEvent(Object.assign(new Event('storage'), { key: null })) // localStorage.clear()

    expect(seen).toEqual([session(2), null])
  })

  it('ignores corrupt stored data', () => {
    const storage = memoryStorage()
    storage.setItem('seatsure.session', '{not json')
    expect(createSessionStore(() => storage).get()).toBeNull()
    storage.setItem('seatsure.session', JSON.stringify({ accessToken: 1 }))
    expect(createSessionStore(() => storage).get()).toBeNull()
    storage.setItem('seatsure.session', JSON.stringify({ ...session(1), refreshToken: '' }))
    expect(createSessionStore(() => storage).get()).toBeNull()
  })
})

describe('authGateway', () => {
  it('signIn posts the credentials without Authorization and stores the session', async () => {
    const calls = stubNetwork(api('POST', '/auth/login', ok(session(1))))
    const { client, store } = setup()
    await createAuthGateway(client, store).signIn('parent1@seatsure.test', 'pw')
    expect(authorization(calls[0]!.init)).toBeNull()
    expect(calls[0]!.init?.body).toBe(JSON.stringify({ email: 'parent1@seatsure.test', password: 'pw' }))
    expect(store.get()).toEqual(session(1))
  })

  it('signIn with a wrong password rejects with Invalid login credentials and stores nothing', async () => {
    stubNetwork(api('POST', '/auth/login', fail(401, 'Invalid login credentials')))
    const { client, store } = setup()
    const error = await rejection(createAuthGateway(client, store).signIn('a@b.c', 'bad'))
    expect(error?.code).toBe('Invalid login credentials')
    expect(store.get()).toBeNull()
  })

  it('signOut posts logout with the token, then clears the store', async () => {
    const calls = stubNetwork(api('POST', '/auth/logout', ok(null)))
    const { client, store } = setup(session(1))
    await createAuthGateway(client, store).signOut()
    expect(authorization(calls[0]!.init)).toBe('Bearer access-1')
    expect(store.get()).toBeNull()
  })

  it('signOut clears the store even when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))))
    const { client, store } = setup(session(1))
    await createAuthGateway(client, store).signOut()
    expect(store.get()).toBeNull()
  })

  it('signOut without a session makes no request', async () => {
    const calls = stubNetwork()
    const { client, store } = setup()
    await createAuthGateway(client, store).signOut()
    expect(calls).toHaveLength(0)
  })

  it('me returns the current user', async () => {
    const user = { id: 'u1', email: 'parent1@seatsure.test', fullName: 'Parent', role: 'parent' }
    stubNetwork(api('GET', '/me', (init) => (authorization(init) === 'Bearer access-1' ? ok(user) : fail(401, 'not_authenticated'))))
    const { client, store } = setup(session(1))
    expect(await createAuthGateway(client, store).me()).toEqual(user)
  })
})

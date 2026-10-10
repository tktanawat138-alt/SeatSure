import type { Envelope, Session } from '@contract'
import { DomainError } from '@/entities/domain-error'
import { sessionStore, type SessionStore } from './session-store'

export interface RequestOptions {
  signal?: AbortSignal
}

interface Reply {
  status: number
  body: Envelope<unknown>
}

/**
 * HTTP middleware for the backend API. Adds the bearer token, refreshes once on 401 (parallel
 * 401s share one refresh) and retries once, and forgets the session when that fails. Failures
 * become DomainError(code): the envelope message, 'network_error' or 'timeout'. Never logs tokens.
 */
export function createApiClient({
  baseUrl,
  store,
  timeoutMs = 15_000,
}: {
  baseUrl: string
  store: SessionStore
  timeoutMs?: number
}) {
  let refreshing: Promise<Session> | null = null

  async function send(method: string, path: string, body: unknown, token: string | null, opts: RequestOptions): Promise<Reply> {
    const headers: Record<string, string> = {}
    // A Blob (or File) goes as the raw body with its own type; anything else as JSON.
    const raw = body instanceof Blob
    if (raw) headers['content-type'] = body.type || 'application/octet-stream'
    else if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout

    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
        signal,
      })
    } catch {
      throw new DomainError(timeout.aborted ? 'timeout' : 'network_error')
    }
    try {
      return { status: response.status, body: (await response.json()) as Envelope<unknown> }
    } catch {
      throw new DomainError(timeout.aborted ? 'timeout' : 'network_error')
    }
  }

  function unwrap<T>({ body }: Reply): T {
    if (body?.success === true) return body.data as T
    if (body?.success === false && typeof body.message === 'string') throw new DomainError(body.message)
    throw new DomainError('network_error')
  }

  function signedOut(): never {
    store.clear()
    throw new DomainError('not_authenticated')
  }

  /** One refresh at a time; callers that hit 401 meanwhile wait for the same one. */
  function refresh(refreshToken: string): Promise<Session> {
    refreshing ??= send('POST', '/auth/refresh', { refreshToken }, null, {})
      .then((reply) => {
        // Any 4xx means the refresh token is gone. 429, 5xx and network errors are passing
        // trouble: keep the session and let the caller retry later.
        if (reply.status >= 400 && reply.status < 500 && reply.status !== 429) signedOut()
        const session = unwrap<Session>(reply)
        store.set(session)
        return session
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  return {
    async request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
      const session = store.get()
      const reply = await send(method, path, body, session?.accessToken ?? null, opts)
      if (reply.status !== 401 || !session) return unwrap<T>(reply)

      // Another request may have refreshed already; then just retry with the newer token.
      const latest = store.get()
      if (!latest) signedOut()
      const next = latest.accessToken !== session.accessToken ? latest : await refresh(latest.refreshToken)
      const retried = await send(method, path, body, next.accessToken, opts)
      if (retried.status === 401) signedOut()
      return unwrap<T>(retried)
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

/**
 * The API base URL. Only development falls back to the local API; a production build without
 * VITE_API_URL fails at startup instead of sending credentials to the visitor's own localhost.
 */
export function resolveApiBase(env: { DEV: boolean; PROD: boolean; VITE_API_URL?: string }): string {
  if (env.VITE_API_URL) return env.VITE_API_URL
  if (env.DEV) return 'http://localhost:3001'
  throw new Error('VITE_API_URL is not set. Set it to the backend API URL when building for production.')
}

export const apiClient = createApiClient({
  baseUrl: resolveApiBase(import.meta.env),
  store: sessionStore,
})

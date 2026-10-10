import { vi } from 'vitest'

type Reply = { status?: number; body: unknown }
export type Route = (url: URL, init?: RequestInit) => Reply | undefined

/** Replaces the global fetch. Each route returns a reply for the requests it recognises. */
export function stubNetwork(...routes: Route[]) {
  const calls: { url: URL; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
      calls.push({ url, init })
      const reply = routes.map((route) => route(url, init)).find(Boolean)
      if (!reply) throw new Error(`unexpected request: ${url.pathname}`)
      return new Response(JSON.stringify(reply.body), {
        status: reply.status ?? 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
  return calls
}

export const table = (name: string, reply: Reply): Route => (url) =>
  url.pathname === `/rest/v1/${name}` ? reply : undefined

export const rpc = (name: string, reply: Reply): Route => (url) =>
  url.pathname === `/rest/v1/rpc/${name}` ? reply : undefined

type Handler = Reply | ((init?: RequestInit) => Reply)

/** A backend API route. The reply may be a function of the request, e.g. to check its headers. */
export const api = (method: string, path: string, reply: Handler): Route => (url, init) =>
  url.pathname === path && (init?.method ?? 'GET') === method ? (typeof reply === 'function' ? reply(init) : reply) : undefined

/** The Authorization header a stubbed request carried, or null. */
export const authorization = (init?: RequestInit) => new Headers(init?.headers).get('authorization')

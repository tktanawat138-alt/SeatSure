import { createClient, isAuthError, type Session as SupabaseSession } from '@supabase/supabase-js'
import type { Role } from '../../entities/actor'
import { DomainError } from '../../entities/domain-error'
import type { AuthProvider, AuthSession } from '../../interfaces/auth-provider'

export interface SupabaseAuthConfig {
  url: string
  anonKey: string
  serviceRoleKey: string
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

/** Supabase answered "no" (4xx), as opposed to being unreachable or failing (status 0 or 5xx). */
const isRejection = (error: unknown) =>
  isAuthError(error) && typeof error.status === 'number' && error.status >= 400 && error.status < 500

/** Never includes the error message from Supabase when it could echo a token. */
const unavailable = (step: string, error: unknown) =>
  new Error(`Supabase auth ${step} failed${isAuthError(error) && error.status ? ` (status ${error.status})` : ''}`)

/** Maps a sign-in or refresh failure: 429 is rate_limited, other 4xx `rejected`, the rest unexpected. */
export function authFailure(step: string, error: unknown, rejected: string): Error {
  if (isAuthError(error) && error.status === 429) return new DomainError('rate_limited')
  if (isRejection(error)) return new DomainError(rejected)
  return unavailable(step, error)
}

function toSession(session: SupabaseSession | null): AuthSession {
  if (!session) throw new DomainError('not_authenticated')
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
  }
}

export function createSupabaseAuthProvider(config: SupabaseAuthConfig): AuthProvider {
  const service = createClient(config.url, config.serviceRoleKey, clientOptions)
  // signIn and refresh keep the session on the client that made the call, so each call gets
  // its own anon client: concurrent requests never share auth state.
  const anon = () => createClient(config.url, config.anonKey, clientOptions)

  return {
    async signIn(email, password) {
      const { data, error } = await anon().auth.signInWithPassword({ email, password })
      if (error) throw authFailure('sign-in', error, 'Invalid login credentials')
      return toSession(data.session)
    },

    async refresh(refreshToken) {
      const { data, error } = await anon().auth.refreshSession({ refresh_token: refreshToken })
      if (error) throw authFailure('refresh', error, 'not_authenticated')
      return toSession(data.session)
    },

    async signOut(accessToken) {
      // 'local' ends only this session; the user's other devices stay signed in.
      const { error } = await service.auth.admin.signOut(accessToken, 'local')
      if (error && !isRejection(error)) throw unavailable('sign-out', error)
    },

    async verify(accessToken) {
      const { data, error } = await service.auth.getUser(accessToken)
      if (error) {
        if (isRejection(error)) throw new DomainError('not_authenticated')
        throw unavailable('verify', error)
      }
      return { id: data.user.id, email: data.user.email ?? '' }
    },

    async profile(id) {
      const { data, error } = await service.from('profiles').select('full_name, role').eq('id', id).maybeSingle()
      if (error) throw new Error(`profile lookup failed: ${error.code ?? 'unknown'}`)
      // A valid token whose account has no profile (e.g. after a database reset).
      if (!data) throw new DomainError('not_authenticated')
      return { fullName: data.full_name as string, role: data.role as Role }
    },
  }
}

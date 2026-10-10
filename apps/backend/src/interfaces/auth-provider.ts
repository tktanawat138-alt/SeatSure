import type { Role } from '../entities/actor'

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch seconds
}

/**
 * Identity service. Implementations throw DomainError('Invalid login credentials') from signIn,
 * DomainError('not_authenticated') when a token or profile is not valid, and
 * DomainError('rate_limited') when signIn or refresh is throttled.
 */
export interface AuthProvider {
  signIn(email: string, password: string): Promise<AuthSession>
  refresh(refreshToken: string): Promise<AuthSession>
  /** Ends the session server-side, so the access and refresh tokens stop working. */
  signOut(accessToken: string): Promise<void>
  verify(accessToken: string): Promise<{ id: string; email: string }>
  profile(id: string): Promise<{ fullName: string; role: Role }>
}

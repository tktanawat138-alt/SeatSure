import type { CurrentUser } from '@/entities/current-user'

export interface AuthGateway {
  /** Stores the session on success; rejects with DomainError('Invalid login credentials'). */
  signIn(email: string, password: string): Promise<void>
  /** Ends the session on the server when it can, and always forgets it locally. */
  signOut(): Promise<void>
  me(): Promise<CurrentUser>
}

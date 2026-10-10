import type { Actor } from '../entities/actor'
import { DomainError } from '../entities/domain-error'
import type { AuthProvider } from '../interfaces/auth-provider'

export function createAuth(provider: AuthProvider) {
  return {
    login: (email: string, password: string) => provider.signIn(email, password),
    refresh: (refreshToken: string) => provider.refresh(refreshToken),
    logout: (actor: Actor) => provider.signOut(actor.token),

    async authenticate(token: string): Promise<Actor> {
      if (!token) throw new DomainError('not_authenticated')
      const user = await provider.verify(token)
      const { role } = await provider.profile(user.id)
      return { id: user.id, email: user.email, role, token }
    },

    async me(actor: Actor) {
      const { fullName, role } = await provider.profile(actor.id)
      return { id: actor.id, email: actor.email, fullName, role }
    },
  }
}

export type Auth = ReturnType<typeof createAuth>

import type { Session } from '@contract'
import type { CurrentUser } from '@/entities/current-user'
import type { AuthGateway } from '@/interfaces/auth-gateway'
import { apiClient, type ApiClient } from './client'
import { sessionStore, type SessionStore } from './session-store'

export function createAuthGateway(client: ApiClient, store: SessionStore): AuthGateway {
  return {
    async signIn(email, password) {
      store.clear() // never send an old token with a login
      store.set(await client.request<Session>('POST', '/auth/login', { email, password }))
    },

    async signOut() {
      try {
        if (store.get()) await client.request('POST', '/auth/logout')
      } catch {
        // Offline or already expired: forgetting the tokens locally still signs out.
      } finally {
        store.clear()
      }
    },

    me: () => client.request<CurrentUser>('GET', '/me'),
  }
}

export const authGateway = createAuthGateway(apiClient, sessionStore)

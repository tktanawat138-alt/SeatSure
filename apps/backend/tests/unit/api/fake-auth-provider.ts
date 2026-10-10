import { DomainError } from '../../../src/entities/domain-error'
import type { AuthProvider, AuthSession } from '../../../src/interfaces/auth-provider'
import type { Role } from '../../../src/entities/actor'

interface Account {
  id: string
  email: string
  password: string
  fullName: string
  role: Role
}

export const accounts: Account[] = [
  { id: 'u-parent', email: 'parent@test', password: 'pw', fullName: 'Parent One', role: 'parent' },
  { id: 'u-teacher', email: 'teacher@test', password: 'pw', fullName: 'Teacher One', role: 'teacher' },
  { id: 'u-admin', email: 'admin@test', password: 'pw', fullName: 'Admin One', role: 'admin' },
  // Signed-in account whose profile row is gone.
  { id: 'u-orphan', email: 'orphan@test', password: 'pw', fullName: '', role: 'parent' },
]

/** Token for an account: `token-<id>`. Refresh tokens: `refresh-<id>`. */
export const tokenFor = (id: string) => `token-${id}`

/** In-memory AuthProvider. Records sign-outs; revoked tokens stop verifying. */
export function fakeAuthProvider() {
  const revoked = new Set<string>()
  const signedOut: string[] = []
  let issued = 0
  const sessionFor = (id: string): AuthSession => ({
    accessToken: tokenFor(id),
    refreshToken: `refresh-${id}-${++issued}`,
    expiresAt: 2_000_000_000,
  })

  const provider: AuthProvider & { signedOut: string[] } = {
    signedOut,
    async signIn(email, password) {
      if (email === 'busy@test') throw new DomainError('rate_limited')
      const account = accounts.find((a) => a.email === email && a.password === password)
      if (!account) throw new DomainError('Invalid login credentials')
      return sessionFor(account.id)
    },
    async refresh(refreshToken) {
      const account = accounts.find((a) => refreshToken.startsWith(`refresh-${a.id}-`))
      if (!account || revoked.has(refreshToken)) throw new DomainError('not_authenticated')
      return sessionFor(account.id)
    },
    async signOut(accessToken) {
      signedOut.push(accessToken)
      revoked.add(accessToken)
    },
    async verify(accessToken) {
      const account = accounts.find((a) => tokenFor(a.id) === accessToken)
      if (!account || revoked.has(accessToken)) throw new DomainError('not_authenticated')
      return { id: account.id, email: account.email }
    },
    async profile(id) {
      const account = accounts.find((a) => a.id === id && a.id !== 'u-orphan')
      if (!account) throw new DomainError('not_authenticated')
      return { fullName: account.fullName, role: account.role }
    },
  }
  return provider
}

import { describe, expect, it } from 'vitest'
import type { CurrentUser } from '@/entities/current-user'
import type { AuthGateway } from '@/interfaces/auth-gateway'
import { createLoadMe } from '@/use-cases/load-me'
import { createSignIn } from '@/use-cases/sign-in'
import { createSignOut } from '@/use-cases/sign-out'

const user: CurrentUser = { id: 'u1', email: 'a@b.c', fullName: 'A', role: 'parent' }

function fakeGateway() {
  const log: string[] = []
  const gateway: AuthGateway = {
    signIn: async (email, password) => void log.push(`signIn ${email} ${password}`),
    signOut: async () => void log.push('signOut'),
    me: async () => user,
  }
  return { gateway, log }
}

describe('auth use cases', () => {
  it('signIn passes the credentials to the gateway', async () => {
    const { gateway, log } = fakeGateway()
    await createSignIn(gateway)('a@b.c', 'pw')
    expect(log).toEqual(['signIn a@b.c pw'])
  })

  it('signOut asks the gateway to end the session', async () => {
    const { gateway, log } = fakeGateway()
    await createSignOut(gateway)()
    expect(log).toEqual(['signOut'])
  })

  it('loadMe returns the current user', async () => {
    const { gateway } = fakeGateway()
    expect(await createLoadMe(gateway)()).toEqual(user)
  })
})

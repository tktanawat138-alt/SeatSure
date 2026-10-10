import { describe, expect, it } from 'vitest'
import { DomainError } from '../../../src/entities/domain-error'
import { createAuth } from '../../../src/use-cases/auth'
import { fakeAuthProvider, tokenFor } from '../api/fake-auth-provider'

describe('auth use cases', () => {
  const auth = createAuth(fakeAuthProvider())

  it('login with a wrong password rejects with DomainError Invalid login credentials', async () => {
    const error = await auth.login('parent@test', 'nope').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe('Invalid login credentials')
  })

  it('login with valid credentials returns the session', async () => {
    const session = await auth.login('parent@test', 'pw')
    expect(session.accessToken).toBe(tokenFor('u-parent'))
  })

  it('authenticate builds the actor from the token and profile', async () => {
    const actor = await auth.authenticate(tokenFor('u-teacher'))
    expect(actor).toEqual({ id: 'u-teacher', email: 'teacher@test', role: 'teacher', token: tokenFor('u-teacher') })
  })

  it('authenticate with an unknown token rejects with not_authenticated', async () => {
    await expect(auth.authenticate('bogus')).rejects.toMatchObject({ code: 'not_authenticated' })
  })

  it('me returns id, email, full name and role', async () => {
    const actor = await auth.authenticate(tokenFor('u-admin'))
    expect(await auth.me(actor)).toEqual({ id: 'u-admin', email: 'admin@test', fullName: 'Admin One', role: 'admin' })
  })
})

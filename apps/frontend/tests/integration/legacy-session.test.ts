import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { api, stubNetwork } from './stub-network'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const session = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 2_000_000_000 }

// Removed in Task 8 with supabase-js.
describe('legacy supabase-js session', () => {
  it('signIn and signOut through the API also forget the legacy session locally', async () => {
    const legacySignOut = vi.spyOn(supabase.auth, 'signOut').mockRejectedValue(new Error('ignored'))
    stubNetwork(
      api('POST', '/auth/login', { body: { success: true, data: session } }),
      api('POST', '/auth/logout', { body: { success: true, data: null } }),
    )
    const { signIn, signOut } = await import('@/app/deps')

    await signIn('parent1@seatsure.test', 'pw')
    expect(legacySignOut).toHaveBeenCalledTimes(1)
    expect(legacySignOut).toHaveBeenLastCalledWith({ scope: 'local' })

    await signOut()
    expect(legacySignOut).toHaveBeenCalledTimes(2)
    expect(legacySignOut).toHaveBeenLastCalledWith({ scope: 'local' })
  })
})

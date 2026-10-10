import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { authFailure } from '../../../src/adaptor/supabase/auth-provider'
import { DomainError } from '../../../src/entities/domain-error'

const codeOf = (error: Error) => (error instanceof DomainError ? error.code : 'unexpected')

describe('authFailure', () => {
  it('429 from Supabase maps to rate_limited on sign-in and refresh', () => {
    const tooMany = new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit')
    expect(codeOf(authFailure('sign-in', tooMany, 'Invalid login credentials'))).toBe('rate_limited')
    expect(codeOf(authFailure('refresh', tooMany, 'not_authenticated'))).toBe('rate_limited')
  })

  it('other 4xx map to the rejection code', () => {
    const bad = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')
    expect(codeOf(authFailure('sign-in', bad, 'Invalid login credentials'))).toBe('Invalid login credentials')
    expect(codeOf(authFailure('refresh', bad, 'not_authenticated'))).toBe('not_authenticated')
  })

  it('unreachable or 5xx is an unexpected error that does not echo the Supabase message', () => {
    const down = new AuthRetryableFetchError('secret detail', 503)
    const error = authFailure('sign-in', down, 'Invalid login credentials')
    expect(error).not.toBeInstanceOf(DomainError)
    expect(error.message).not.toContain('secret detail')
  })
})

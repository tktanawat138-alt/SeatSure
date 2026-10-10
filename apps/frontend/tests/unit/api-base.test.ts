import { describe, expect, it } from 'vitest'
import { resolveApiBase } from '@/adaptor/http/client'

// Security review L9: a production build must never fall back to the visitor's own localhost.
describe('resolveApiBase', () => {
  it('resolveApiBase with VITE_API_URL returns it, in production and development', () => {
    expect(resolveApiBase({ PROD: true, DEV: false, VITE_API_URL: 'https://api.example.com' })).toBe('https://api.example.com')
    expect(resolveApiBase({ PROD: false, DEV: true, VITE_API_URL: 'http://127.0.0.1:4000' })).toBe('http://127.0.0.1:4000')
  })

  it('resolveApiBase in development without VITE_API_URL falls back to the local API', () => {
    expect(resolveApiBase({ PROD: false, DEV: true })).toBe('http://localhost:3001')
    expect(resolveApiBase({ PROD: false, DEV: true, VITE_API_URL: '' })).toBe('http://localhost:3001')
  })

  it('resolveApiBase in a production build without VITE_API_URL throws a clear error', () => {
    expect(() => resolveApiBase({ PROD: true, DEV: false })).toThrow(/VITE_API_URL/)
    expect(() => resolveApiBase({ PROD: true, DEV: false, VITE_API_URL: '' })).toThrow(/VITE_API_URL/)
  })
})

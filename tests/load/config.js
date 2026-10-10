import http from 'k6/http'
import { check, fail } from 'k6'

// Local only: these scripts log in as seeded accounts and create load. Pointing them at a real
// deployment needs an explicit ALLOW_REMOTE=1.
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(BASE_URL)
if (!isLocal && __ENV.ALLOW_REMOTE !== '1') {
  fail(`Refusing to load test ${BASE_URL}. Set ALLOW_REMOTE=1 only for an environment you own.`)
}

export const PASSWORD = __ENV.SEED_PASSWORD || 'seatsure123'
export const parentEmail = (n) => `parent${((n - 1) % 10) + 1}@seatsure.test`

const JSON_HEADERS = { 'Content-Type': 'application/json' }
export const bearer = (token) => ({ headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } })

/** Logs in through the API and returns the session, or fails the check. */
export function login(email, password = PASSWORD) {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password }), {
    headers: JSON_HEADERS,
    tags: { name: 'POST /auth/login' },
  })
  const ok = check(res, {
    'login 200': (r) => r.status === 200,
    'login envelope has a session': (r) => r.json('data.accessToken') !== undefined,
  })
  return ok ? res.json('data') : null
}

/** Every API response must use the envelope. */
export const isEnvelope = (res) => {
  try {
    const body = res.json()
    return typeof body.success === 'boolean' && (body.success ? 'data' in body : typeof body.message === 'string')
  } catch {
    return false
  }
}

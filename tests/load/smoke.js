import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { BASE_URL, bearer, isEnvelope, login } from './config.js'

// One user walks the main read path. Fast sanity check before the heavier scenarios.
export const options = {
  vus: 1,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
}

export default function () {
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } })
    check(res, { 'health 200': (r) => r.status === 200, 'health envelope': isEnvelope })
  })

  const session = login('parent1@seatsure.test')
  if (!session) return

  group('me', () => {
    const res = http.get(`${BASE_URL}/me`, { ...bearer(session.accessToken), tags: { name: 'GET /me' } })
    check(res, {
      'me 200': (r) => r.status === 200,
      'me is a parent': (r) => r.json('data.role') === 'parent',
    })
  })

  group('unauthenticated is refused', () => {
    const res = http.get(`${BASE_URL}/me`, { tags: { name: 'GET /me (no token)' }, responseCallback: http.expectedStatuses(401) })
    check(res, { 'me without token is 401': (r) => r.status === 401, '401 envelope': isEnvelope })
  })
  sleep(1)
}

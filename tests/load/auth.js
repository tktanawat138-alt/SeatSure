import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, bearer, login, parentEmail } from './config.js'

// Many users sign in at once, read their profile and refresh the token.
export const options = {
  stages: [
    { duration: '15s', target: 10 },
    { duration: '30s', target: 25 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:POST /auth/login}': ['p(95)<800'],
    'http_req_duration{name:GET /me}': ['p(95)<400'],
    'http_req_duration{name:POST /auth/refresh}': ['p(95)<800'],
    checks: ['rate>0.99'],
  },
}

export default function () {
  const session = login(parentEmail(__VU))
  if (!session) {
    sleep(1) // a failing user retries slowly; a tight loop would only pile on
    return
  }

  const me = http.get(`${BASE_URL}/me`, { ...bearer(session.accessToken), tags: { name: 'GET /me' } })
  check(me, { 'me 200': (r) => r.status === 200 })

  const refreshed = http.post(`${BASE_URL}/auth/refresh`, JSON.stringify({ refreshToken: session.refreshToken }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /auth/refresh' },
  })
  check(refreshed, { 'refresh 200': (r) => r.status === 200 })
  sleep(1)
}

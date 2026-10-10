import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../../src/app'
import { fakeAuthProvider } from './fake-auth-provider'

const deps = () => ({ frontendOrigin: 'http://localhost:5173', authProvider: fakeAuthProvider() })

describe('GET /health', () => {
  it('returns 200 with the success envelope', async () => {
    const app = createApp(deps())
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { ok: true } })
  })

  it('allows only the configured frontend origin via CORS', async () => {
    const app = createApp(deps())
    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    const other = await request(app).get('/health').set('Origin', 'http://evil.example')
    expect(other.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('answers unknown routes and bad JSON with the failure envelope', async () => {
    const app = createApp(deps())
    const missing = await request(app).get('/nope')
    expect(missing.status).toBe(404)
    expect(missing.body).toEqual({ success: false, message: 'Not found' })
    const bad = await request(app).post('/health').set('Content-Type', 'application/json').send('{oops')
    expect(bad.status).toBe(400)
    expect(bad.body.success).toBe(false)
  })

  it('keeps the failure envelope and 4xx status for client errors like an oversized body', async () => {
    const app = createApp(deps())
    const big = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ pad: 'x'.repeat(200_000) }))
    expect(big.status).toBe(413)
    expect(big.body.success).toBe(false)
    expect(typeof big.body.message).toBe('string')
  })
})

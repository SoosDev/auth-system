import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { rateLimit, rateLimitStore } from '../../src/modules/rate-limit/rate-limit.middleware.js'

async function fakeAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  request.user = { userId: 'user-1', sessionId: 'session-1', roles: ['user'] }
}

function buildTestApp() {
  const app = Fastify()

  app.get('/ip-limited', {
    preHandler: [rateLimit({ key: 'ip', limit: 3, window: 60 })]
  }, async () => ({ ok: true }))

  app.get('/user-limited', {
    preHandler: [fakeAuth, rateLimit({ key: 'user', limit: 2, window: 60 })]
  }, async () => ({ ok: true }))

  app.get('/session-limited', {
    preHandler: [fakeAuth, rateLimit({ key: 'session', limit: 2, window: 60 })]
  }, async () => ({ ok: true }))

  // Intentionally missing authenticate — used to verify the error case
  app.get('/user-no-auth', {
    preHandler: [rateLimit({ key: 'user', limit: 5, window: 60 })]
  }, async () => ({ ok: true }))

  return app
}

let app: ReturnType<typeof buildTestApp>

beforeEach(async () => {
  rateLimitStore.reset()
  app = buildTestApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('rateLimit middleware — IP key', () => {
  it('allows requests under the limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/ip-limited' })
    expect(res.statusCode).toBe(200)
  })

  it('returns 429 when the limit is exceeded', async () => {
    for (let i = 0; i < 3; i++) await app.inject({ method: 'GET', url: '/ip-limited' })
    const res = await app.inject({ method: 'GET', url: '/ip-limited' })
    expect(res.statusCode).toBe(429)
    expect(res.json().error).toBe('Too Many Requests')
  })

  it('sets X-RateLimit-Limit header on every response', async () => {
    const res = await app.inject({ method: 'GET', url: '/ip-limited' })
    expect(res.headers['x-ratelimit-limit']).toBe('3')
  })

  it('sets X-RateLimit-Remaining header on every response', async () => {
    const res = await app.inject({ method: 'GET', url: '/ip-limited' })
    expect(res.headers['x-ratelimit-remaining']).toBe('2')
  })

  it('sets Retry-After and X-RateLimit-Reset headers on 429', async () => {
    for (let i = 0; i < 3; i++) await app.inject({ method: 'GET', url: '/ip-limited' })
    const res = await app.inject({ method: 'GET', url: '/ip-limited' })
    expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(0)
    expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(0)
  })

  it('sets X-RateLimit-Reset header on every response', async () => {
    const res = await app.inject({ method: 'GET', url: '/ip-limited' })
    expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(0)
  })
})

describe('rateLimit middleware — user key', () => {
  it('allows requests under the limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/user-limited' })
    expect(res.statusCode).toBe(200)
  })

  it('returns 429 when the user limit is exceeded', async () => {
    for (let i = 0; i < 2; i++) await app.inject({ method: 'GET', url: '/user-limited' })
    const res = await app.inject({ method: 'GET', url: '/user-limited' })
    expect(res.statusCode).toBe(429)
  })

  it('returns 500 when user key is used without authenticate before it', async () => {
    const res = await app.inject({ method: 'GET', url: '/user-no-auth' })
    expect(res.statusCode).toBe(500)
    expect(res.json().message).toContain('requires authenticate middleware')
  })
})

describe('rateLimit middleware — session key', () => {
  it('allows requests under the limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/session-limited' })
    expect(res.statusCode).toBe(200)
  })

  it('user and session keys are tracked independently', async () => {
    // exhaust the user limit
    for (let i = 0; i < 2; i++) await app.inject({ method: 'GET', url: '/user-limited' })
    // session counter should be unaffected
    const res = await app.inject({ method: 'GET', url: '/session-limited' })
    expect(res.statusCode).toBe(200)
  })

  it('returns 429 when the session limit is exceeded', async () => {
    for (let i = 0; i < 2; i++) await app.inject({ method: 'GET', url: '/session-limited' })
    const res = await app.inject({ method: 'GET', url: '/session-limited' })
    expect(res.statusCode).toBe(429)
  })
})

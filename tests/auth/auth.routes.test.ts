import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/db/index.js'
import { users, sessions, userRoles } from '../../src/db/schema.js'

let app: Awaited<ReturnType<typeof buildServer>>

beforeAll(async () => {
  app = buildServer()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(userRoles)
  await db.delete(users)
})

describe('POST /auth/register', () => {
  it('creates a new user and returns 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: { email: 'test@example.com', password: 'password123' },
    })
    expect(response.statusCode).toBe(201)
    expect(response.json().message).toBe('User registered successfully')
  })

  it('returns 409 when email already exists', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const response = await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    expect(response.statusCode).toBe(409)
  })

  it('returns 400 when email is missing', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/register', body: { password: 'password123' } })
    expect(response.statusCode).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('returns access and refresh tokens on valid credentials', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const response = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
  })

  it('returns 401 on wrong password', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const response = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'wrong' } })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 for non-existent email', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'nobody@example.com', password: 'password123' } })
    expect(response.statusCode).toBe(401)
  })
})

describe('POST /auth/refresh', () => {
  it('returns new tokens and rotates the refresh token', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const loginRes = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const { refreshToken } = loginRes.json()

    const refreshRes = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken } })
    expect(refreshRes.statusCode).toBe(200)
    const body = refreshRes.json()
    expect(typeof body.accessToken).toBe('string')
    expect(body.refreshToken).not.toBe(refreshToken)
  })

  it('revokes ALL user sessions when an old (rotated) token is replayed — reuse detection', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const loginRes1 = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const loginRes2 = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const { refreshToken: token1 } = loginRes1.json()
    const { refreshToken: token2 } = loginRes2.json()

    const rotateRes = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken: token1 } })
    expect(rotateRes.statusCode).toBe(200)

    const reuseRes = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken: token1 } })
    expect(reuseRes.statusCode).toBe(401)

    const token2RefreshRes = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken: token2 } })
    expect(token2RefreshRes.statusCode).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('revokes session so refresh token no longer works', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const loginRes = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const { accessToken, refreshToken } = loginRes.json()

    const logoutRes = await app.inject({ method: 'POST', url: '/auth/logout', headers: { Authorization: `Bearer ${accessToken}` } })
    expect(logoutRes.statusCode).toBe(200)

    const refreshRes = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken } })
    expect(refreshRes.statusCode).toBe(401)
  })
})

describe('POST /auth/logout-all', () => {
  it('revokes all sessions for the user', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const login1 = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const login2 = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const { accessToken, refreshToken: rt1 } = login1.json()
    const { refreshToken: rt2 } = login2.json()

    const logoutAllRes = await app.inject({ method: 'POST', url: '/auth/logout-all', headers: { Authorization: `Bearer ${accessToken}` } })
    expect(logoutAllRes.statusCode).toBe(200)

    const r1 = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken: rt1 } })
    const r2 = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken: rt2 } })
    expect(r1.statusCode).toBe(401)
    expect(r2.statusCode).toBe(401)
  })
})

describe('GET /me', () => {
  it('returns user info when authenticated', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const loginRes = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const { accessToken } = loginRes.json()

    const meRes = await app.inject({ method: 'GET', url: '/me', headers: { Authorization: `Bearer ${accessToken}` } })
    expect(meRes.statusCode).toBe(200)
    expect(meRes.json().user.roles).toContain('user')
  })

  it('returns 401 without a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/me' })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when session has been revoked (liveness check)', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const loginRes = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const { accessToken } = loginRes.json()

    await app.inject({ method: 'POST', url: '/auth/logout', headers: { Authorization: `Bearer ${accessToken}` } })

    const meRes = await app.inject({ method: 'GET', url: '/me', headers: { Authorization: `Bearer ${accessToken}` } })
    expect(meRes.statusCode).toBe(401)
  })
})

describe('GET /admin/dashboard (RBAC)', () => {
  it('returns 403 for a regular user', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'password123' } })
    const loginRes = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'password123' } })
    const { accessToken } = loginRes.json()

    const response = await app.inject({ method: 'GET', url: '/admin/dashboard', headers: { Authorization: `Bearer ${accessToken}` } })
    expect(response.statusCode).toBe(403)
  })
})

describe('POST /me/change-password', () => {
  it('invalidates all sessions after password change', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', body: { email: 'test@example.com', password: 'oldpassword1' } })
    const loginRes = await app.inject({ method: 'POST', url: '/auth/login', body: { email: 'test@example.com', password: 'oldpassword1' } })
    const { accessToken, refreshToken } = loginRes.json()

    const changeRes = await app.inject({
      method: 'POST', url: '/me/change-password',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { currentPassword: 'oldpassword1', newPassword: 'newpassword1' },
    })
    expect(changeRes.statusCode).toBe(200)

    const refreshRes = await app.inject({ method: 'POST', url: '/auth/refresh', body: { refreshToken } })
    expect(refreshRes.statusCode).toBe(401)
  })
})

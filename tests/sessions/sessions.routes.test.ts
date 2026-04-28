import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/db/index.js'
import { users, sessions, userRoles } from '../../src/db/schema.js'

let app: Awaited<ReturnType<typeof buildServer>>

beforeAll(async () => { app = buildServer(); await app.ready() })
afterAll(async () => { await app.close() })
beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(userRoles)
  await db.delete(users)
})

async function registerAndLogin(email: string) {
  await app.inject({ method: 'POST', url: '/auth/register', body: { email, password: 'password123' } })
  const res = await app.inject({ method: 'POST', url: '/auth/login', body: { email, password: 'password123' } })
  return res.json() as { accessToken: string; refreshToken: string }
}

describe('GET /sessions', () => {
  it('returns the active sessions for the current user', async () => {
    const { accessToken } = await registerAndLogin('test@example.com')
    const response = await app.inject({ method: 'GET', url: '/sessions', headers: { Authorization: `Bearer ${accessToken}` } })
    expect(response.statusCode).toBe(200)
    expect(response.json().sessions).toHaveLength(1)
  })
})

describe('DELETE /sessions/:id', () => {
  it('revokes the specified session', async () => {
    const { accessToken } = await registerAndLogin('test@example.com')
    const sessionsRes = await app.inject({ method: 'GET', url: '/sessions', headers: { Authorization: `Bearer ${accessToken}` } })
    const sessionId = sessionsRes.json().sessions[0].id

    const deleteRes = await app.inject({ method: 'DELETE', url: `/sessions/${sessionId}`, headers: { Authorization: `Bearer ${accessToken}` } })
    expect(deleteRes.statusCode).toBe(200)
  })

  it("returns 404 when trying to revoke another user's session", async () => {
    const { accessToken: tokenA } = await registerAndLogin('a@example.com')
    const { accessToken: tokenB } = await registerAndLogin('b@example.com')

    const bSessions = await app.inject({ method: 'GET', url: '/sessions', headers: { Authorization: `Bearer ${tokenB}` } })
    const bSessionId = bSessions.json().sessions[0].id

    const deleteRes = await app.inject({ method: 'DELETE', url: `/sessions/${bSessionId}`, headers: { Authorization: `Bearer ${tokenA}` } })
    expect(deleteRes.statusCode).toBe(404)
  })
})

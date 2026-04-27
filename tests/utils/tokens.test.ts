import { describe, it, expect } from 'vitest'
import { signAccessToken, verifyAccessToken } from '../../src/utils/tokens.js'

const TEST_PAYLOAD = {
  userId: 'user-123',
  sessionId: 'session-456',
  roles: ['user'],
}

describe('signAccessToken', () => {
  it('returns a non-empty string', async () => {
    const token = await signAccessToken(TEST_PAYLOAD)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('is a JWT with three dot-separated parts', async () => {
    const token = await signAccessToken(TEST_PAYLOAD)
    expect(token.split('.')).toHaveLength(3)
  })
})

describe('verifyAccessToken', () => {
  it('returns the payload for a valid token', async () => {
    const token = await signAccessToken(TEST_PAYLOAD)
    const payload = await verifyAccessToken(token)
    expect(payload.userId).toBe('user-123')
    expect(payload.sessionId).toBe('session-456')
    expect(payload.roles).toEqual(['user'])
  })

  it('throws for an invalid token', async () => {
    await expect(verifyAccessToken('invalid.token.here')).rejects.toThrow()
  })
})

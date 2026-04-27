import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/utils/hash.js'

describe('hashPassword', () => {
  it('returns a string different from the input', async () => {
    const hash = await hashPassword('mypassword')
    expect(hash).not.toBe('mypassword')
    expect(typeof hash).toBe('string')
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('samepassword')
    const hash2 = await hashPassword('samepassword')
    expect(hash1).not.toBe(hash2)
  })
})

describe('verifyPassword', () => {
  it('returns true when password matches', async () => {
    const hash = await hashPassword('correct-password')
    expect(await verifyPassword(hash, 'correct-password')).toBe(true)
  })

  it('returns false when password does not match', async () => {
    const hash = await hashPassword('correct-password')
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false)
  })
})

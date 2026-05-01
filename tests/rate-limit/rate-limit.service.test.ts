import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RateLimitStore } from '../../src/modules/rate-limit/rate-limit.service.js'

let store: RateLimitStore

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  store = new RateLimitStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RateLimitStore', () => {
  it('allows requests under the limit', () => {
    const result = store.check('key1', 5, 60)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks when the limit is reached', () => {
    for (let i = 0; i < 5; i++) store.check('key1', 5, 60)
    const result = store.check('key1', 5, 60)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns resetAt as the window end in Unix seconds', () => {
    const now = Math.floor(Date.now() / 1000)
    const result = store.check('key1', 5, 60)
    expect(result.resetAt).toBe(now + 60)
  })

  it('slides the window after one window duration and decays previous count', () => {
    for (let i = 0; i < 5; i++) store.check('key1', 5, 60)
    expect(store.check('key1', 5, 60).allowed).toBe(false)

    vi.setSystemTime(new Date('2026-01-01T00:01:00.000Z'))
    expect(store.check('key1', 5, 60).allowed).toBe(false)

    vi.setSystemTime(new Date('2026-01-01T00:01:30.000Z'))
    expect(store.check('key1', 5, 60).allowed).toBe(true)
  })

  it('resets previous count when multiple windows have elapsed', () => {
    for (let i = 0; i < 5; i++) store.check('key1', 5, 60)
    vi.setSystemTime(new Date('2026-01-01T00:03:00.000Z'))
    const result = store.check('key1', 5, 60)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('tracks different keys independently', () => {
    for (let i = 0; i < 5; i++) store.check('key1', 5, 60)
    const result = store.check('key2', 5, 60)
    expect(result.allowed).toBe(true)
  })

  it('reset() clears all state so previously exhausted keys are fresh', () => {
    for (let i = 0; i < 5; i++) store.check('key1', 5, 60)
    expect(store.check('key1', 5, 60).allowed).toBe(false)
    store.reset()
    expect(store.check('key1', 5, 60).allowed).toBe(true)
  })

  it('decrements remaining counter correctly across consecutive requests', () => {
    const first = store.check('key1', 5, 60)
    expect(first.allowed).toBe(true)
    expect(first.remaining).toBe(4)

    const second = store.check('key1', 5, 60)
    expect(second.allowed).toBe(true)
    expect(second.remaining).toBe(3)

    const third = store.check('key1', 5, 60)
    expect(third.allowed).toBe(true)
    expect(third.remaining).toBe(2)

    const fourth = store.check('key1', 5, 60)
    expect(fourth.allowed).toBe(true)
    expect(fourth.remaining).toBe(1)

    const fifth = store.check('key1', 5, 60)
    expect(fifth.allowed).toBe(true)
    expect(fifth.remaining).toBe(0)

    const sixth = store.check('key1', 5, 60)
    expect(sixth.allowed).toBe(false)
    expect(sixth.remaining).toBe(0)
  })
})

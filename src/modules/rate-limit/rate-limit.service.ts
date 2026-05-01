export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

interface Entry {
  currentCount: number
  previousCount: number
  windowStart: number
}

export class RateLimitStore {
  private entries = new Map<string, Entry>()

  check(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Math.floor(Date.now() / 1000)

    if (!this.entries.has(key)) {
      this.entries.set(key, { currentCount: 0, previousCount: 0, windowStart: now })
    }

    const entry = this.entries.get(key)!
    const windowEnd = entry.windowStart + windowSeconds

    if (now >= windowEnd) {
      const windowsElapsed = Math.floor((now - entry.windowStart) / windowSeconds)
      if (windowsElapsed === 1) {
        entry.previousCount = entry.currentCount
        entry.windowStart = entry.windowStart + windowSeconds
      } else {
        entry.previousCount = 0
        entry.windowStart = Math.floor(now / windowSeconds) * windowSeconds
      }
      entry.currentCount = 0
    }

    const overlapRatio = (entry.windowStart + windowSeconds - now) / windowSeconds
    const effectiveCount = entry.currentCount + entry.previousCount * overlapRatio
    const resetAt = entry.windowStart + windowSeconds

    if (effectiveCount >= limit) {
      return { allowed: false, remaining: 0, resetAt }
    }

    entry.currentCount++
    return {
      allowed: true,
      // Floor is conservative since effectiveCount includes floating-point previous-window
      // contribution from decay. remaining can be 0 even when technically 1 more request allowed.
      remaining: Math.max(0, Math.floor(limit - effectiveCount - 1)),
      resetAt,
    }
  }

  reset(): void {
    this.entries.clear()
  }
}

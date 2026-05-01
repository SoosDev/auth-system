import { FastifyRequest, FastifyReply } from 'fastify'
import { RateLimitStore } from './rate-limit.service.js'

export type RateLimitKey = 'ip' | 'user' | 'session'

export interface RateLimitOptions {
  key: RateLimitKey
  limit: number
  window: number
}

// Shared singleton — all rateLimit() calls accumulate against the same store.
// Any integration test file exercising a rate-limited route MUST call
// rateLimitStore.reset() in beforeEach to prevent cross-test state bleed.
export const rateLimitStore = new RateLimitStore()

function resolveKey(request: FastifyRequest, keyType: RateLimitKey): string {
  switch (keyType) {
    case 'ip':
      return request.ip
    case 'user':
      if (!request.user) throw new Error('rateLimit(key="user") requires authenticate middleware before it in the preHandler chain')
      return `user:${request.user.userId}`
    case 'session':
      if (!request.user) throw new Error('rateLimit(key="session") requires authenticate middleware before it in the preHandler chain')
      return `session:${request.user.sessionId}`
  }
}

export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitHandler(request: FastifyRequest, reply: FastifyReply) {
    const key = resolveKey(request, options.key)
    const result = rateLimitStore.check(key, options.limit, options.window)
    const retryAfter = Math.max(0, result.resetAt - Math.floor(Date.now() / 1000))

    reply.header('X-RateLimit-Limit', options.limit)
    reply.header('X-RateLimit-Remaining', result.remaining)
    reply.header('X-RateLimit-Reset', result.resetAt)

    if (!result.allowed) {
      reply.header('Retry-After', retryAfter)
      return reply.status(429).send({ error: 'Too Many Requests' })
    }
  }
}

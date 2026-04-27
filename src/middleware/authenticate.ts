import { FastifyRequest, FastifyReply } from 'fastify'
import { and, eq, isNull, gt } from 'drizzle-orm'
import { verifyAccessToken } from '../utils/tokens.js'
import { db } from '../db/index.js'
import { sessions } from '../db/schema.js'

export interface SessionValidator {
  isValid(sessionId: string): Promise<boolean>
}

export class DbSessionValidator implements SessionValidator {
  async isValid(sessionId: string): Promise<boolean> {
    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(
        eq(sessions.id, sessionId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ))
      .limit(1)
    return !!session
  }
}

const defaultValidator: SessionValidator = new DbSessionValidator()

export function createAuthenticateHandler(validator: SessionValidator = defaultValidator) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' })
    }

    let payload: Awaited<ReturnType<typeof verifyAccessToken>>
    try {
      payload = await verifyAccessToken(authHeader.slice(7))
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired access token' })
    }

    const valid = await validator.isValid(payload.sessionId)
    if (!valid) {
      return reply.status(401).send({ error: 'Session has been revoked or expired' })
    }

    request.user = payload
  }
}

export const authenticate = createAuthenticateHandler()

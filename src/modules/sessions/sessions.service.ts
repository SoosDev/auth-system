import { and, eq, isNull, gt } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { sessions } from '../../db/schema.js'

function makeError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

export async function getActiveSessions(userId: string) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(
      eq(sessions.userId, userId),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date()),
    ))
}

export async function revokeSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1)

  if (!session) throw makeError('Session not found', 404)

  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId))
}

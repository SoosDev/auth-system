import { eq, and, isNull } from 'drizzle-orm'
import { createHash } from 'crypto'
import { db } from '../../db/index.js'
import { users, sessions, roles, userRoles } from '../../db/schema.js'
import { hashPassword, verifyPassword } from '../../utils/hash.js'
import { signAccessToken } from '../../utils/tokens.js'
import { generateRefreshToken } from '../../utils/crypto.js'

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function authEvent(event: string, fields: Record<string, string | undefined>) {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  console.warn(`AUTH_EVENT: ${event} ${parts}`)
}

function makeError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

async function getUserRoleNames(userId: string): Promise<string[]> {
  const rows = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
  return rows.map((r) => r.roleName)
}

export async function revokeAllUserSessions(userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
}

export async function registerUser(email: string, password: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) throw makeError('Email already in use', 409)

  const passwordHash = await hashPassword(password)
  const [newUser] = await db.insert(users).values({ email, passwordHash }).returning()

  const [userRole] = await db.select().from(roles).where(eq(roles.name, 'user')).limit(1)
  if (userRole) {
    await db.insert(userRoles).values({ userId: newUser.id, roleId: userRole.id })
  }

  return newUser
}

export async function loginUser(
  email: string,
  password: string,
  userAgent?: string,
  ipAddress?: string,
) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$dummysaltwillnotwork'
  const passwordValid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(dummyHash, password).catch(() => false)

  if (!user || !passwordValid) {
    authEvent('LOGIN_FAILURE', { email, ip: ipAddress ?? undefined })
    throw makeError('Invalid credentials', 401)
  }

  const userRoleNames = await getUserRoleNames(user.id)

  const refreshToken = generateRefreshToken()
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS ?? 30))

  const [session] = await db.insert(sessions).values({
    userId: user.id,
    refreshTokenHash,
    expiresAt,
    userAgent,
    ipAddress,
  }).returning()

  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId: session.id,
    roles: userRoleNames,
  })

  return { accessToken, refreshToken, sessionId: session.id }
}

export async function refreshSession(incomingRefreshToken: string) {
  const incomingHash = hashRefreshToken(incomingRefreshToken)

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, incomingHash))
    .limit(1)

  if (!session) {
    const [reuseSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.previousRefreshTokenHash, incomingHash))
      .limit(1)

    if (reuseSession) {
      await revokeAllUserSessions(reuseSession.userId)
      authEvent('REFRESH_TOKEN_REUSE', { userId: reuseSession.userId, sessionId: reuseSession.id })
    }

    throw makeError('Invalid refresh token', 401)
  }

  const now = new Date()
  if (session.revokedAt !== null || session.expiresAt < now) {
    throw makeError('Session expired or revoked', 401)
  }

  const newRefreshToken = generateRefreshToken()
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken)
  const newExpiresAt = new Date()
  newExpiresAt.setDate(newExpiresAt.getDate() + Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS ?? 30))

  await db.update(sessions).set({
    refreshTokenHash: newRefreshTokenHash,
    previousRefreshTokenHash: incomingHash,
    expiresAt: newExpiresAt,
  }).where(eq(sessions.id, session.id))

  const userRoleNames = await getUserRoleNames(session.userId)

  const accessToken = await signAccessToken({
    userId: session.userId,
    sessionId: session.id,
    roles: userRoleNames,
  })

  return { accessToken, refreshToken: newRefreshToken }
}

export async function logoutSession(sessionId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId))
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw makeError('User not found', 404)

  const valid = await verifyPassword(user.passwordHash, currentPassword)
  if (!valid) throw makeError('Current password is incorrect', 401)

  const newPasswordHash = await hashPassword(newPassword)

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId))
    await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, userId))
  })
}

import { SignJWT, jwtVerify } from 'jose'

export interface AccessTokenPayload {
  userId: string
  sessionId: string
  roles: string[]
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const expiry = process.env.ACCESS_TOKEN_EXPIRY ?? '15m'
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(getSecret())
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return {
    userId: payload['userId'] as string,
    sessionId: payload['sessionId'] as string,
    roles: payload['roles'] as string[],
  }
}

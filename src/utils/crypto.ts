import { randomBytes } from 'crypto'

export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex')
}

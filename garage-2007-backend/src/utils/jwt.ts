import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface JwtPayload {
  sub: number
  tgId: number
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '2h' })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & JwtPayload
    if (typeof decoded.sub !== 'number' || typeof decoded.tgId !== 'number') {
      return null
    }
    return { sub: decoded.sub, tgId: decoded.tgId }
  } catch {
    return null
  }
}

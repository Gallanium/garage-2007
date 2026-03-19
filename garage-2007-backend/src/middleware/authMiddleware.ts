import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt.js'
import { AppError } from './errorHandler.js'

export interface AuthUser {
  id: number
  tgId: number
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)
  const payload = verifyToken(token)
  if (!payload) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token')
  }

  req.user = { id: payload.sub, tgId: payload.tgId }
  next()
}

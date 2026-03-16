import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors,
    })
    return
  }

  logger.error({ err }, 'Unhandled error')

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'Internal server error',
  })
}

import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'
import { ZodError } from 'zod'
import { isPrismaUniqueConstraintError } from '../utils/prismaErrors.js'

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
    if (err.statusCode >= 500) {
      logger.error({ code: err.code, statusCode: err.statusCode, message: err.message }, 'app_error')
    } else if (err.statusCode === 401 || err.statusCode === 403) {
      logger.warn({ code: err.code, statusCode: err.statusCode }, 'auth_error')
    } else {
      logger.debug({ code: err.code, statusCode: err.statusCode }, 'client_error')
    }
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    })
    return
  }

  if (err instanceof ZodError) {
    logger.debug({ errors: err.errors }, 'validation_error')
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors,
    })
    return
  }

  if (isPrismaUniqueConstraintError(err, ['idempotency_key'])) {
    logger.warn({ err }, 'idempotent_request_conflict')
    res.status(409).json({
      success: false,
      error: 'IDEMPOTENT_REQUEST',
      message: 'This action has already been processed',
    })
    return
  }

  if (isPrismaUniqueConstraintError(err, ['telegram_payment_id'])) {
    logger.warn({ err }, 'duplicate_payment_conflict')
    res.status(409).json({
      success: false,
      error: 'DUPLICATE_PAYMENT',
      message: 'This payment has already been processed',
    })
    return
  }

  if (isPrismaUniqueConstraintError(err)) {
    logger.warn({ err }, 'unique_constraint_conflict')
    res.status(409).json({
      success: false,
      error: 'CONFLICT',
      message: 'Unique constraint conflict',
    })
    return
  }

  // Handle body-parser errors (payload too large, malformed JSON)
  if ('type' in err) {
    const errWithType = err as Error & { type?: string; status?: number }
    if (errWithType.type === 'entity.too.large') {
      res.status(413).json({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds size limit',
      })
      return
    }
    if (errWithType.type === 'entity.parse.failed') {
      res.status(400).json({
        success: false,
        error: 'INVALID_JSON',
        message: 'Malformed JSON in request body',
      })
      return
    }
  }

  // Handle SyntaxError from JSON parsing
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'INVALID_JSON',
      message: 'Malformed JSON in request body',
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

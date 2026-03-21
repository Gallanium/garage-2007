/**
 * Optimistic Concurrency Control (OCC) helpers for GameSave updates.
 *
 * Uses `updateMany` with a version check so that concurrent writes
 * result in a VERSION_CONFLICT rather than a silent last-write-wins.
 */
import { AppError } from '../middleware/errorHandler.js'
import { logger } from './logger.js'
import type { prisma } from './prisma.js'
import type { GameSave } from '@prisma/client'

// ── Constants ────────────────────────────────────────────────────────────────

export const OCC_MAX_RETRIES = 3

// ── Types ────────────────────────────────────────────────────────────────────

export type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Optimistic-lock update on GameSave via `updateMany` with version check.
 * Returns the updated GameSave by merging data into the original record.
 * Throws AppError(409, VERSION_CONFLICT) when the row version has changed.
 */
export async function updateGameSaveWithLock(
  tx: TxClient,
  userId: number,
  gs: GameSave,
  data: Record<string, unknown>,
): Promise<GameSave> {
  const result = await tx.gameSave.updateMany({
    where: { userId, version: gs.version },
    data: { ...data, version: gs.version + 1 },
  })

  if (result.count === 0) {
    throw new AppError(409, 'VERSION_CONFLICT', 'Optimistic lock conflict — retry')
  }

  // Return merged result (avoids second read)
  return { ...gs, ...data, version: gs.version + 1 } as GameSave
}

/**
 * Execute a transactional operation with optimistic lock retry.
 * On VERSION_CONFLICT, retries up to OCC_MAX_RETRIES times.
 */
export async function withOccRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < OCC_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof AppError && err.code === 'VERSION_CONFLICT' && attempt < OCC_MAX_RETRIES - 1) {
        logger.warn({ attempt: attempt + 1 }, 'OCC version conflict, retrying')
        continue
      }
      throw err
    }
  }
  throw new AppError(409, 'VERSION_CONFLICT', 'Optimistic lock conflict — max retries exceeded')
}

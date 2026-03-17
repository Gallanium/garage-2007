import type { Request, Response } from 'express'
import { loadState, createInitialState } from '../services/gameStateService.js'
import { processSync, processAction } from '../services/gameActionService.js'

export async function getState(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id

  const result = await loadState(userId)

  // New player — create initial state
  if (!result.gameState) {
    const gameState = await createInitialState(userId)
    res.json({ gameState, serverTime: Date.now() })
    return
  }

  res.json(result)
}

export async function syncGame(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { clicksSinceLastSync, clientTimestamp } = req.body as {
    clicksSinceLastSync: number
    clientTimestamp: number
  }

  const result = await processSync(userId, clicksSinceLastSync, clientTimestamp)
  res.json(result)
}

export async function performAction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { type, payload, idempotencyKey } = req.body as {
    type: string
    payload: Record<string, unknown>
    idempotencyKey?: string
  }

  const result = await processAction(userId, type, payload, idempotencyKey)
  res.json(result)
}

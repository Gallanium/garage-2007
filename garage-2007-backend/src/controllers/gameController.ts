import type { Request, Response } from 'express'

// Placeholder controllers — full implementation in Phase 3

export async function getState(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  // TODO: gameStateService.loadState(userId)
  res.json({ gameState: null, serverTime: Date.now(), userId })
}

export async function syncGame(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { clicksSinceLastSync } = req.body as { clicksSinceLastSync: number }
  // TODO: gameActionService.processSync(userId, clicksSinceLastSync)
  res.json({ gameState: null, serverTime: Date.now(), userId, clicksSinceLastSync })
}

export async function performAction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { type, payload, idempotencyKey } = req.body as {
    type: string
    payload: Record<string, unknown>
    idempotencyKey?: string
  }
  // TODO: gameActionService.processAction(userId, type, payload, idempotencyKey)
  res.json({ success: true, gameState: null, actionResult: {}, userId, type, payload })
}

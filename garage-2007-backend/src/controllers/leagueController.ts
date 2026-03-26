import type { Request, Response } from 'express'
import { getLeagueStatus as getStatus, getLeaderboard as getBoard } from '../services/leagueService.js'
import { logger } from '../utils/logger.js'

export async function getLeagueStatus(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const result = await getStatus(userId)
  logger.info({ userId, tier: result.currentTier.name, rank: result.rank }, 'league_status')
  res.json(result)
}

export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const result = await getBoard(userId)
  logger.info({ userId, top100Count: result.top100.length, playerRank: result.playerRank }, 'leaderboard')
  res.json(result)
}

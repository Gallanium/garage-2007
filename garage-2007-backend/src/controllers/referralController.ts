import type { Request, Response } from 'express'
import { getReferralStatus as getStatus, generateReferralCode as genCode } from '../services/referralService.js'
import { logger } from '../utils/logger.js'

export async function getReferralStatus(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const result = await getStatus(userId)
  logger.info({ userId, activeReferrals: result.activeReferrals }, 'referral_status')
  res.json(result)
}

export async function generateCode(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const code = await genCode(userId)
  res.json({ code })
}

import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { leagueLimiter } from '../middleware/rateLimiter.js'
import { getLeagueStatus, getLeaderboard } from '../controllers/leagueController.js'

const router = Router()
router.get('/status', authMiddleware, leagueLimiter, getLeagueStatus)
router.get('/leaderboard', authMiddleware, leagueLimiter, getLeaderboard)
export default router

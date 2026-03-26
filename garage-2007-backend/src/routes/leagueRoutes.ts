import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { stateLimiter } from '../middleware/rateLimiter.js'
import { getLeagueStatus, getLeaderboard } from '../controllers/leagueController.js'

const router = Router()
router.get('/status', authMiddleware, stateLimiter, getLeagueStatus)
router.get('/leaderboard', authMiddleware, stateLimiter, getLeaderboard)
export default router

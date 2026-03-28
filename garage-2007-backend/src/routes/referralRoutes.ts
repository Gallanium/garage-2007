import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { stateLimiter, purchaseLimiter } from '../middleware/rateLimiter.js'
import { getReferralStatus, generateCode } from '../controllers/referralController.js'

const router = Router()

router.get('/status', authMiddleware, stateLimiter, getReferralStatus)
router.post('/generate-code', authMiddleware, purchaseLimiter, generateCode)

export default router

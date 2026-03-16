import { Router } from 'express'
import { getState, syncGame, performAction } from '../controllers/gameController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { stateLimiter, syncLimiter, actionLimiter } from '../middleware/rateLimiter.js'
import { validate } from '../middleware/requestValidator.js'
import { syncSchema, actionSchema } from '../validation/gameSchemas.js'

const router = Router()

router.get('/state', authMiddleware, stateLimiter, getState)
router.post('/sync', authMiddleware, syncLimiter, validate(syncSchema), syncGame)
router.post('/action', authMiddleware, actionLimiter, validate(actionSchema), performAction)

export default router

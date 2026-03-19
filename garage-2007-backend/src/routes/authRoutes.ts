import { Router } from 'express'
import { telegramAuth } from '../controllers/authController.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { validate } from '../middleware/requestValidator.js'
import { telegramAuthSchema } from '../validation/authSchemas.js'

const router = Router()

router.post('/telegram', authLimiter, validate(telegramAuthSchema), telegramAuth)

export default router

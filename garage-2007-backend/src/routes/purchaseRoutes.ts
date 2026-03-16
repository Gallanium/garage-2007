import { Router } from 'express'
import { createInvoice, handleWebhook } from '../controllers/purchaseController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { purchaseLimiter } from '../middleware/rateLimiter.js'
import { validate } from '../middleware/requestValidator.js'
import { createInvoiceSchema } from '../validation/purchaseSchemas.js'

const router = Router()

router.post('/create-invoice', authMiddleware, purchaseLimiter, validate(createInvoiceSchema), createInvoice)
router.post('/webhook', handleWebhook)

export default router

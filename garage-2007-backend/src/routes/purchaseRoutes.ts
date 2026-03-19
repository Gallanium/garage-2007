import { Router } from 'express'
import { createInvoice, handleWebhook } from '../controllers/purchaseController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { purchaseLimiter, webhookLimiter } from '../middleware/rateLimiter.js'
import { webhookIpWhitelist } from '../middleware/webhookIpWhitelist.js'
import { validate } from '../middleware/requestValidator.js'
import { createInvoiceSchema } from '../validation/purchaseSchemas.js'

const router = Router()

router.post('/create-invoice', authMiddleware, purchaseLimiter, validate(createInvoiceSchema), createInvoice)
router.post('/webhook', webhookIpWhitelist, webhookLimiter, handleWebhook)

export default router

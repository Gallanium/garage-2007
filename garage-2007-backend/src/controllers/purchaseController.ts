import type { Request, Response } from 'express'
import { createStarsInvoice, handlePreCheckoutQuery, processSuccessfulPayment } from '../services/purchaseService.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../middleware/errorHandler.js'
import type { NutsPackId } from '@shared/types/purchase.js'

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const { packId } = req.body as { packId: NutsPackId }

  const invoiceUrl = await createStarsInvoice(packId)
  res.json({ invoiceUrl })
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Verify webhook secret
  const secretHeader = req.headers['x-telegram-bot-api-secret-token']
  if (secretHeader !== env.WEBHOOK_SECRET) {
    logger.warn('Webhook request with invalid secret')
    throw new AppError(403, 'FORBIDDEN', 'Invalid webhook secret')
  }

  const update = req.body as Record<string, unknown>

  // Handle pre_checkout_query
  if (update.pre_checkout_query && typeof update.pre_checkout_query === 'object') {
    const query = update.pre_checkout_query as Record<string, unknown>
    const queryId = query.id
    const invoicePayload = query.invoice_payload

    if (typeof queryId !== 'string' || typeof invoicePayload !== 'string') {
      logger.warn({ update: 'pre_checkout_query' }, 'Malformed pre_checkout_query — missing id or invoice_payload')
      res.status(200).send()
      return
    }

    await handlePreCheckoutQuery(queryId, invoicePayload)
    res.status(200).send()
    return
  }

  // Handle successful_payment (inside message)
  if (update.message && typeof update.message === 'object') {
    const message = update.message as Record<string, unknown>

    if (message.successful_payment && typeof message.successful_payment === 'object') {
      const payment = message.successful_payment as Record<string, unknown>
      const from = message.from as Record<string, unknown> | undefined
      const chargeId = payment.telegram_payment_charge_id
      const invoicePayload = payment.invoice_payload
      const senderId = from?.id

      if (typeof chargeId !== 'string' || typeof invoicePayload !== 'string' || typeof senderId !== 'number') {
        logger.warn({ update: 'successful_payment' }, 'Malformed successful_payment — missing required fields')
        res.status(200).send()
        return
      }

      await processSuccessfulPayment(chargeId, invoicePayload, senderId)
      res.status(200).send()
      return
    }
  }

  // Unknown update type — acknowledge without processing
  res.status(200).send()
}

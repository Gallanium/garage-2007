import type { Request, Response } from 'express'
import { createStarsInvoice, handlePreCheckoutQuery, processSuccessfulPayment } from '../services/purchaseService.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../middleware/errorHandler.js'
import type { NutsPackId } from '@shared/types/purchase.js'

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { packId } = req.body as { packId: NutsPackId }

  const invoiceUrl = await createStarsInvoice(userId, packId)
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
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query as {
      id: string
      invoice_payload: string
    }
    await handlePreCheckoutQuery(query.id, query.invoice_payload)
    res.status(200).send()
    return
  }

  // Handle successful_payment (inside message)
  const message = update.message as Record<string, unknown> | undefined
  if (message?.successful_payment) {
    const payment = message.successful_payment as {
      telegram_payment_charge_id: string
      invoice_payload: string
    }
    const from = message.from as { id: number }

    await processSuccessfulPayment(
      payment.telegram_payment_charge_id,
      payment.invoice_payload,
      from.id,
    )
    res.status(200).send()
    return
  }

  // Unknown update type — just acknowledge
  res.status(200).send()
}

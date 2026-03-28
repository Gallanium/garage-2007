import type { Request, Response } from 'express'
import { createStarsInvoice, handlePreCheckoutQuery, processSuccessfulPayment } from '../services/purchaseService.js'
import { logger } from '../utils/logger.js'
import { webhookUpdateSchema } from '../validation/purchaseSchemas.js'
import type { NutsPackId } from '@shared/types/purchase.js'

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const { packId } = req.body as { packId: NutsPackId }
  const userId = req.user!.id

  const invoiceUrl = await createStarsInvoice(packId, userId)
  res.json({ invoiceUrl })
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const parsed = webhookUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, 'Webhook body failed Zod validation')
    res.status(200).send()
    return
  }

  const update = parsed.data

  // Handle pre_checkout_query
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query
    await handlePreCheckoutQuery(
      query.id,
      query.invoice_payload,
      query.from.id,
      query.total_amount,
      query.currency,
    )
    res.status(200).send()
    return
  }

  // Handle successful_payment (inside message)
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment
    const senderId = update.message.from?.id

    if (typeof senderId !== 'number') {
      logger.warn({ update: 'successful_payment' }, 'Malformed successful_payment — missing from.id')
      res.status(200).send()
      return
    }

    await processSuccessfulPayment(
      payment.telegram_payment_charge_id,
      payment.invoice_payload,
      senderId,
      payment.total_amount,
      payment.currency,
    )
    res.status(200).send()
    return
  }

  // Unknown update type — acknowledge without processing
  res.status(200).send()
}

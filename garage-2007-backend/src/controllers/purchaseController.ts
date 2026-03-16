import type { Request, Response } from 'express'

// Placeholder controllers — full implementation in Phase 4

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id
  const { packId } = req.body as { packId: string }
  // TODO: purchaseService.createStarsInvoice(userId, packId)
  res.json({ invoiceUrl: null, userId, packId })
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // TODO: validate webhook secret, process pre_checkout_query / successful_payment
  res.status(200).send()
}

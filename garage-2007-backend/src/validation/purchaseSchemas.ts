import { z } from 'zod'

export const createInvoiceSchema = z.object({
  packId: z.enum(['nuts_100', 'nuts_500', 'nuts_1500']),
}).strict()

const telegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
}).passthrough()

export const preCheckoutQuerySchema = z.object({
  id: z.string(),
  from: telegramUserSchema,
  currency: z.string(),
  total_amount: z.number().int(),
  invoice_payload: z.string(),
}).passthrough()

export const successfulPaymentSchema = z.object({
  currency: z.string(),
  total_amount: z.number().int(),
  invoice_payload: z.string(),
  telegram_payment_charge_id: z.string(),
}).passthrough()

export const webhookUpdateSchema = z.object({
  pre_checkout_query: preCheckoutQuerySchema.optional(),
  message: z.object({
    from: telegramUserSchema.optional(),
    successful_payment: successfulPaymentSchema.optional(),
  }).passthrough().optional(),
}).passthrough()

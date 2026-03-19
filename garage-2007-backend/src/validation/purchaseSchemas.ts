import { z } from 'zod'

export const createInvoiceSchema = z.object({
  packId: z.enum(['nuts_100', 'nuts_500', 'nuts_1500']),
}).strict()

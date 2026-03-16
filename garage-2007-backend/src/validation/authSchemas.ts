import { z } from 'zod'

export const telegramAuthSchema = z.object({
  initData: z.string().min(1),
}).strict()

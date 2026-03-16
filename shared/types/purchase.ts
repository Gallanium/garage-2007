// shared/types/purchase.ts
// Types for Telegram Stars purchase flow.

export interface NutsPack {
  stars: number
  nuts: number
  label: string
}

export type NutsPackId = 'nuts_100' | 'nuts_500' | 'nuts_1500'

export interface PurchaseResult {
  success: boolean
  nutsAmount?: number
  error?: string
}

export interface InvoicePayload {
  packId: NutsPackId
  userId: number
  idempotencyKey: string
}

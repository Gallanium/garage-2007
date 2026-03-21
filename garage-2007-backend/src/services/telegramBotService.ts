import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const BOT_API_BASE = 'https://api.telegram.org/bot'

/** Default timeout for Bot API calls (8 seconds) */
const DEFAULT_TIMEOUT_MS = 8_000

/** Stricter timeout for answerPreCheckoutQuery (Telegram waits max 10s) */
const PRECHECKOUT_TIMEOUT_MS = 5_000

async function callBotApi(
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const url = `${BOT_API_BASE}${env.BOT_TOKEN}/${method}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(timeoutMs),
  })

  const data = await res.json() as { ok: boolean; result?: unknown; description?: string }

  if (!data.ok) {
    logger.error({ method, description: data.description }, 'Telegram Bot API error')
    throw new Error(`Bot API error: ${data.description ?? 'Unknown error'}`)
  }

  return data.result
}

export async function createInvoiceLink(params: {
  title: string
  description: string
  payload: string
  currency: string
  prices: Array<{ label: string; amount: number }>
}): Promise<string> {
  const result = await callBotApi('createInvoiceLink', params)
  return result as string
}

export async function answerPreCheckoutQuery(
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
): Promise<void> {
  await callBotApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
    ...(errorMessage ? { error_message: errorMessage } : {}),
  }, PRECHECKOUT_TIMEOUT_MS)
}

export async function refundStarPayment(
  userId: number,
  telegramPaymentChargeId: string,
): Promise<void> {
  await callBotApi('refundStarPayment', {
    user_id: userId,
    telegram_payment_charge_id: telegramPaymentChargeId,
  })
}

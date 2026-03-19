// src/hooks/useTelegram.ts
import {
  useLaunchParams,
  hapticFeedbackImpactOccurred,
  hapticFeedbackNotificationOccurred,
  mountBackButton,
  unmountBackButton,
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  invoice,
} from '@telegram-apps/sdk-react'
import { useEffect } from 'react'

// ── User data ────────────────────────────────────────────────────────────────

export interface TelegramUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
}

// Внутренний тип: поля user после camelCase-трансформации valibot (useLaunchParams(true))
interface TgUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
  [key: string]: unknown
}

/** Данные текущего пользователя Telegram или null вне TMA.
 *  Использует useLaunchParams(true) для получения camelCase-полей user. */
export function useTelegramUser(): TelegramUser | null {
  try {
    // true = camelCase: user.firstName / lastName / photoUrl (вместо snake_case first_name etc.)
    const lp = useLaunchParams(true)
    const u = lp.tgWebAppData?.user as TgUser | undefined
    if (!u) return null
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      photoUrl: u.photoUrl,
    }
  } catch {
    return null
  }
}

// ── Haptic feedback ──────────────────────────────────────────────────────────

export interface TelegramHaptic {
  impactLight: () => void
  impactMedium: () => void
  notificationSuccess: () => void
  notificationError: () => void
}

/** Haptic feedback API. Вне Telegram — no-op функции. */
export function useTelegramHaptic(): TelegramHaptic {
  return {
    impactLight: () => {
      try {
        if (hapticFeedbackImpactOccurred.isAvailable()) {
          hapticFeedbackImpactOccurred('light')
        }
      } catch { /* вне Telegram — no-op */ }
    },
    impactMedium: () => {
      try {
        if (hapticFeedbackImpactOccurred.isAvailable()) {
          hapticFeedbackImpactOccurred('medium')
        }
      } catch { /* вне Telegram — no-op */ }
    },
    notificationSuccess: () => {
      try {
        if (hapticFeedbackNotificationOccurred.isAvailable()) {
          hapticFeedbackNotificationOccurred('success')
        }
      } catch { /* вне Telegram — no-op */ }
    },
    notificationError: () => {
      try {
        if (hapticFeedbackNotificationOccurred.isAvailable()) {
          hapticFeedbackNotificationOccurred('error')
        }
      } catch { /* вне Telegram — no-op */ }
    },
  }
}

// ── Invoice ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'paid' | 'failed' | 'pending' | 'cancelled'

/** Opens a Telegram Stars invoice. Returns status or null if unavailable. */
export async function openTelegramInvoice(url: string): Promise<InvoiceStatus | null> {
  try {
    if (invoice.open.isAvailable()) {
      return await invoice.open(url, 'url') as InvoiceStatus
    }
    if (import.meta.env.DEV) {
      console.log('[DEV] Mock invoice open:', url)
      return 'paid'
    }
    return null
  } catch {
    return 'failed'
  }
}

// ── Back button ──────────────────────────────────────────────────────────────

/** Управляет нативной кнопкой «Назад» в Telegram.
 *  @param visible — показать/скрыть кнопку
 *  @param onBack  — callback при нажатии */
export function useTelegramBackButton(visible: boolean, onBack: () => void): void {
  useEffect(() => {
    try {
      if (!mountBackButton.isAvailable()) return
      mountBackButton()
      return () => { try { unmountBackButton() } catch { /* no-op */ } }
    } catch { /* вне Telegram — no-op */ }
  }, [])

  useEffect(() => {
    try {
      if (visible) {
        if (showBackButton.isAvailable()) showBackButton()
      } else {
        if (hideBackButton.isAvailable()) hideBackButton()
      }
    } catch { /* вне Telegram — no-op */ }
  }, [visible])

  useEffect(() => {
    try {
      if (!onBackButtonClick.isAvailable()) return
      return onBackButtonClick(onBack)
    } catch { /* вне Telegram — no-op */ }
  }, [onBack])
}

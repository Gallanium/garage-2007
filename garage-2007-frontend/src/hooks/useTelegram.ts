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
      if (hapticFeedbackImpactOccurred.isAvailable()) {
        hapticFeedbackImpactOccurred('light')
      }
    },
    impactMedium: () => {
      if (hapticFeedbackImpactOccurred.isAvailable()) {
        hapticFeedbackImpactOccurred('medium')
      }
    },
    notificationSuccess: () => {
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('success')
      }
    },
    notificationError: () => {
      if (hapticFeedbackNotificationOccurred.isAvailable()) {
        hapticFeedbackNotificationOccurred('error')
      }
    },
  }
}

// ── Back button ──────────────────────────────────────────────────────────────

/** Управляет нативной кнопкой «Назад» в Telegram.
 *  @param visible — показать/скрыть кнопку
 *  @param onBack  — callback при нажатии */
export function useTelegramBackButton(visible: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!mountBackButton.isAvailable()) return
    mountBackButton()
    return () => {
      unmountBackButton()
    }
  }, [])

  useEffect(() => {
    if (visible) {
      if (showBackButton.isAvailable()) showBackButton()
    } else {
      if (hideBackButton.isAvailable()) hideBackButton()
    }
  }, [visible])

  useEffect(() => {
    if (!onBackButtonClick.isAvailable()) return
    return onBackButtonClick(onBack)
  }, [onBack])
}

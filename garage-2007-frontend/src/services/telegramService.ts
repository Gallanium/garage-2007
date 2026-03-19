// src/services/telegramService.ts
import {
  init,
  mockTelegramEnv,
  isTMA,
  mountMiniAppSync,
  setMiniAppHeaderColor,
  setMiniAppBackgroundColor,
  mountViewport,
  expandViewport,
  retrieveRawInitData,
  retrieveLaunchParams,
} from '@telegram-apps/sdk-react'

/** Инициализация Telegram Mini Apps SDK (v3.x).
 *  В dev-режиме без реального Telegram — активирует mock-окружение.
 *  Вне Telegram — graceful fallback (игра продолжает работать). */
export function initTelegram(): void {
  // В dev-режиме без Telegram — подключаем mock
  if (import.meta.env.DEV && !isTMA()) {
    // mockTelegramEnv v3.x принимает launchParams в формате URLSearchParams
    mockTelegramEnv({
      launchParams: new URLSearchParams({
        tgWebAppVersion: '7.2',
        tgWebAppPlatform: 'tdesktop',
        tgWebAppThemeParams: JSON.stringify({
          accent_text_color: '#E6B800',
          bg_color: '#111827',
          button_color: '#E6B800',
          button_text_color: '#000000',
          header_bg_color: '#111827',
          hint_color: '#9CA3AF',
          link_color: '#E6B800',
          secondary_bg_color: '#1F2937',
          section_bg_color: '#1F2937',
          section_header_text_color: '#9CA3AF',
          subtitle_text_color: '#9CA3AF',
          text_color: '#F9FAFB',
        }),
        tgWebAppData: new URLSearchParams([
          ['user', JSON.stringify({
            id: 123456789,
            first_name: 'Dev',
            last_name: 'User',
            username: 'devuser',
            language_code: 'ru',
            is_premium: false,
          })],
          ['hash', 'mock_hash_dev_only'],
          ['auth_date', String(Math.floor(Date.now() / 1000))],
          ['signature', 'mock_signature'],
        ]).toString(),
      }).toString(),
    })
  }

  try {
    init()

    // Тёмная тема под палитру игры
    if (mountMiniAppSync.isAvailable()) {
      mountMiniAppSync()
    }
    if (setMiniAppHeaderColor.isAvailable()) {
      setMiniAppHeaderColor('#111827')
    }
    if (setMiniAppBackgroundColor.isAvailable()) {
      setMiniAppBackgroundColor('#111827')
    }

    // Полноэкранный режим
    if (mountViewport.isAvailable()) {
      mountViewport().then(() => {
        if (expandViewport.isAvailable()) {
          expandViewport()
        }
      })
    }
  } catch (e) {
    console.warn('[TelegramService] init failed (non-TMA env):', e)
  }
}

/** Работаем внутри реального Telegram (не mock и не браузер)? */
export { isTMA as isTelegramEnv }

/** Получить initData для серверной валидации */
export function getInitData(): string | null {
  try {
    return retrieveRawInitData() ?? null
  } catch {
    return null
  }
}

/** ID текущего пользователя Telegram */
export function getTelegramUserId(): number | null {
  try {
    const params = retrieveLaunchParams(true)
    return (params as Record<string, unknown>).initData
      ? ((params as Record<string, unknown>).initData as Record<string, unknown>).user
        ? (((params as Record<string, unknown>).initData as Record<string, unknown>).user as Record<string, unknown>).id as number
        : null
      : null
  } catch {
    return null
  }
}

// ============================================
// СЕРВИС ЛОКАЛЬНОГО ХРАНИЛИЩА
// Garage 2007 — idle-кликер для Telegram Mini Apps
//
// Отвечает за:
// - Сохранение / загрузку прогресса игрока в localStorage
// - Валидацию структуры сохранённых данных
// - Расчёт оффлайн-дохода по timestamps
// - Версионирование формата данных (для будущих миграций)
//
// Архитектурное решение:
//   localStorage используется как локальный кэш между сессиями.
//   В продакшене серверные данные имеют приоритет при конфликтах
//   (см. GDD, серверная валидация). Здесь хранится «оптимистичная»
//   копия, которая синхронизируется с бэкендом каждые 30 секунд.
// ============================================

import type { SaveData } from '@shared/types/game.ts'
import { calculateOfflineEarnings as calculateOfflineEarningsShared } from '@shared/formulas/offlineEarnings.ts'

// Re-export shared types for backward compatibility
export type { PlayerData, SavedUpgrades, SavedWorkers, PlayerStats, SaveData } from '@shared/types/game.ts'

// ============================================
// КОНСТАНТЫ
// ============================================

/** Ключ в localStorage для сохранения прогресса */
export const STORAGE_KEY = 'garage2007_save_data'

/**
 * Версия формата данных.
 * При изменении структуры SaveData — инкрементируй и добавляй
 * миграцию в loadGame(), чтобы старые сохранения корректно обновлялись.
 */
export const SAVE_VERSION = 7

// ============================================
// НАЧАЛЬНЫЕ ЗНАЧЕНИЯ
// ============================================

const DEFAULT_SAVE_DATA: SaveData = {
  version: SAVE_VERSION,
  timestamp: 0,
  playerData: {
    balance: 0,
    nuts: 0,
    totalClicks: 0,
    garageLevel: 1,
    milestonesPurchased: [],
  },
  upgrades: {
    clickPower: { level: 0, cost: 100 },
    workSpeed: { level: 0, cost: 500 },
  },
  workers: {
    apprentice: { count: 0, cost: 500 },
    mechanic: { count: 0, cost: 5_000 },
    master: { count: 0, cost: 50_000 },
    brigadier: { count: 0, cost: 500_000 },
    director: { count: 0, cost: 5_000_000 },
  },
  stats: {
    totalEarned: 0,
    sessionCount: 0,
    lastSessionDate: '',
    peakClickIncome: 0,
    totalPlayTimeSeconds: 0,
    bestStreak: 0,
  },
  achievements: {},
  dailyRewards: {
    lastClaimTimestamp: 0,
    currentStreak: 0,
  },
  rewardedVideo: {
    lastWatchedTimestamp: 0,
    totalWatches: 0,
  },
  boosts: { active: [] },
  events: { activeEvent: null, cooldownEnd: 0 },
  decorations: { owned: [], active: [] },
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function deepMerge<T extends object>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target }

  for (const key of Object.keys(source) as Array<keyof T>) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    const sourceVal = source[key]
    const targetVal = target[key]

    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown> & object,
        sourceVal as Partial<Record<string, unknown> & object>,
      ) as T[keyof T]
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T]
    }
  }

  return result
}

function isValidSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  if (typeof obj.version !== 'number') return false
  if (typeof obj.timestamp !== 'number') return false

  if (typeof obj.playerData !== 'object' || obj.playerData === null) return false
  const pd = obj.playerData as Record<string, unknown>
  if (typeof pd.balance !== 'number') return false
  if (typeof pd.totalClicks !== 'number') return false
  if (typeof pd.garageLevel !== 'number') return false

  if (typeof obj.upgrades !== 'object' || obj.upgrades === null) return false
  const up = obj.upgrades as Record<string, unknown>
  if (typeof up.clickPower !== 'object' || up.clickPower === null) return false
  if (typeof up.workSpeed !== 'object' || up.workSpeed === null) return false

  if (typeof obj.workers !== 'object' || obj.workers === null) return false
  const wk = obj.workers as Record<string, unknown>
  if (typeof wk.apprentice !== 'object' || wk.apprentice === null) return false
  if (typeof wk.mechanic !== 'object' || wk.mechanic === null) return false

  if (typeof obj.stats !== 'object' || obj.stats === null) return false

  return true
}

// ============================================
// ПУБЛИЧНЫЕ ФУНКЦИИ
// ============================================

export function saveGameFull(data: SaveData): boolean {
  try {
    const toSave = { ...data, version: SAVE_VERSION, timestamp: Date.now() }
    const json = JSON.stringify(toSave)
    localStorage.setItem(STORAGE_KEY, json)
    return true
  } catch (error) {
    console.error('[StorageService] Ошибка сохранения:', error)
    return false
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw === null) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)

    if (!isValidSaveData(parsed)) {
      console.warn(
        '[StorageService] Структура сохранения невалидна, данные отброшены',
      )
      return null
    }

    const merged = deepMerge(DEFAULT_SAVE_DATA, parsed) as SaveData

    // --- Миграция v2 → v3: functionalUpgradesPurchased → milestonesPurchased ---
    if (merged.version < 3) {
      const oldData = parsed as unknown as Record<string, unknown>
      const oldPlayerData = oldData.playerData as Record<string, unknown> | undefined
      if (oldPlayerData && Array.isArray(oldPlayerData.functionalUpgradesPurchased)) {
        merged.playerData.milestonesPurchased = oldPlayerData.functionalUpgradesPurchased as number[]
      }
      merged.version = 3
    }

    // --- Миграция v3 → v4: foreman → brigadier, удаление manager ---
    if (merged.version < 4) {
      const oldWorkers = (parsed as unknown as Record<string, unknown>).workers as Record<string, unknown> | undefined
      if (oldWorkers) {
        const foreman = oldWorkers.foreman as { count: number; cost: number } | undefined
        if (foreman && !oldWorkers.brigadier) {
          merged.workers.brigadier = { count: foreman.count, cost: foreman.cost }
        }
      }
      merged.version = 4
    }

    // --- Миграция v4 → v5: добавление поля boosts ---
    if (merged.version < 5) {
      merged.boosts = { active: [] }
      merged.version = 5
    }

    // --- Миграция v5 → v6: добавление поля events ---
    if (merged.version < 6) {
      merged.events = { activeEvent: null, cooldownEnd: 0 }
      merged.version = 6
    }

    // --- Миграция v6 → v7: добавление поля decorations ---
    if (merged.version < 7) {
      merged.decorations = { owned: [], active: [] }
      merged.version = 7
    }

    return merged
  } catch (error) {
    console.error('[StorageService] Ошибка загрузки:', error)
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[StorageService] Ошибка удаления сохранения:', error)
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function getLastSaveTime(): number | null {
  const save = loadGame()
  return save ? save.timestamp : null
}

/**
 * Wrapper around shared calculateOfflineEarnings.
 * Converts timestamp to elapsed seconds, then delegates to shared formula.
 */
export function calculateOfflineEarnings(
  passiveIncomePerSec: number,
  lastSaveTimestamp: number,
  maxOfflineHours: number = 24,
): number {
  if (lastSaveTimestamp <= 0) return 0
  const elapsedSeconds = (Date.now() - lastSaveTimestamp) / 1000
  return calculateOfflineEarningsShared(passiveIncomePerSec, elapsedSeconds, maxOfflineHours)
}

// ============================================
// ДЕФОЛТНЫЙ ЭКСПОРТ — ОБЪЕКТ-СЕРВИС
// ============================================

const storageService = {
  saveGameFull,
  loadGame,
  clearSave,
  hasSave,
  getLastSaveTime,
  calculateOfflineEarnings,
} as const

export default storageService

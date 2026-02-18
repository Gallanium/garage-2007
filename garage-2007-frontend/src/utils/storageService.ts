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
export const SAVE_VERSION = 1

/** Минимальный интервал оффлайна для начисления дохода (60 секунд) */
const MIN_OFFLINE_SECONDS = 60

/** Количество секунд в одном часе */
const SECONDS_PER_HOUR = 3600

// ============================================
// ТИПЫ
// ============================================

/** Данные игрока, сохраняемые между сессиями */
export interface PlayerData {
  balance: number
  nuts: number
  totalClicks: number
  garageLevel: number
}

/** Сохраняемое состояние апгрейдов */
export interface SavedUpgrades {
  clickPower: { level: number; cost: number }
  workSpeed: { level: number; cost: number }
}

/** Сохраняемое состояние работников */
export interface SavedWorkers {
  apprentice: { count: number; cost: number }
  mechanic: { count: number; cost: number }
}

/** Агрегированная статистика игрока */
export interface PlayerStats {
  /** Всего заработано рублей за всё время */
  totalEarned: number
  /** Количество игровых сессий */
  sessionCount: number
  /** ISO-строка даты последней сессии */
  lastSessionDate: string
}

/**
 * Полная структура сохранения.
 *
 * Версионируется через поле `version` — при изменении схемы
 * необходимо написать миграцию в `loadGame()`.
 */
export interface SaveData {
  version: number
  /** Unix-timestamp момента сохранения (мс) */
  timestamp: number
  playerData: PlayerData
  upgrades: SavedUpgrades
  workers: SavedWorkers
  stats: PlayerStats
}

// ============================================
// НАЧАЛЬНЫЕ ЗНАЧЕНИЯ
// ============================================

/**
 * Дефолтная структура сохранения.
 * Используется как fallback при мердже частичных данных
 * и при валидации загруженного JSON.
 */
const DEFAULT_SAVE_DATA: SaveData = {
  version: SAVE_VERSION,
  timestamp: 0,
  playerData: {
    balance: 0,
    nuts: 0,
    totalClicks: 0,
    garageLevel: 1,
  },
  upgrades: {
    clickPower: { level: 0, cost: 100 },
    workSpeed: { level: 0, cost: 500 },
  },
  workers: {
    apprentice: { count: 0, cost: 500 },
    mechanic: { count: 0, cost: 5_000 },
  },
  stats: {
    totalEarned: 0,
    sessionCount: 0,
    lastSessionDate: '',
  },
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Глубокий мердж двух объектов.
 *
 * Рекурсивно объединяет `source` в `target`.
 * Примитивы из `source` перезаписывают значения в `target`.
 * Вложенные объекты мерджатся рекурсивно.
 *
 * @param target - базовый объект (не мутируется)
 * @param source - объект с обновлениями
 * @returns новый объект — результат мерджа
 */
function deepMerge<T extends object>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target }

  for (const key of Object.keys(source) as Array<keyof T>) {
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

/**
 * Проверяет, что загруженный объект соответствует структуре SaveData.
 *
 * Валидирует наличие обязательных полей верхнего уровня
 * и ключевых вложенных полей. Не проверяет типы значений
 * детально — это задача серверной валидации через zod.
 *
 * @param data - произвольный объект из JSON.parse
 * @returns true если структура корректна
 */
function isValidSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false

  const obj = data as Record<string, unknown>

  // Верхний уровень
  if (typeof obj.version !== 'number') return false
  if (typeof obj.timestamp !== 'number') return false

  // playerData
  if (typeof obj.playerData !== 'object' || obj.playerData === null) return false
  const pd = obj.playerData as Record<string, unknown>
  if (typeof pd.balance !== 'number') return false
  if (typeof pd.totalClicks !== 'number') return false
  if (typeof pd.garageLevel !== 'number') return false

  // upgrades
  if (typeof obj.upgrades !== 'object' || obj.upgrades === null) return false
  const up = obj.upgrades as Record<string, unknown>
  if (typeof up.clickPower !== 'object' || up.clickPower === null) return false
  if (typeof up.workSpeed !== 'object' || up.workSpeed === null) return false

  // workers
  if (typeof obj.workers !== 'object' || obj.workers === null) return false
  const wk = obj.workers as Record<string, unknown>
  if (typeof wk.apprentice !== 'object' || wk.apprentice === null) return false
  if (typeof wk.mechanic !== 'object' || wk.mechanic === null) return false

  // stats
  if (typeof obj.stats !== 'object' || obj.stats === null) return false

  return true
}

// ============================================
// ПУБЛИЧНЫЕ ФУНКЦИИ
// ============================================

/**
 * Сохраняет прогресс игрока в localStorage.
 *
 * Принимает частичные данные, мерджит их с текущим сохранением
 * (или с дефолтами, если сохранения нет), проставляет `version`
 * и `timestamp`, затем записывает JSON-строку в localStorage.
 *
 * @param data - частичные данные для обновления
 * @returns `true` при успешной записи, `false` при ошибке
 *
 * @example
 * ```ts
 * saveGame({
 *   playerData: { balance: 1500, nuts: 0, totalClicks: 42, garageLevel: 2 },
 *   upgrades: { clickPower: { level: 3, cost: 152 }, workSpeed: { level: 0, cost: 500 } },
 * })
 * ```
 */
export function saveGame(data: Partial<SaveData>): boolean {
  try {
    // Берём текущее сохранение как базу (или дефолт)
    const existing = loadGame() ?? { ...DEFAULT_SAVE_DATA }

    // Мерджим новые данные поверх существующих
    const merged = deepMerge(existing, data) as SaveData

    // Проставляем мета-поля
    merged.version = SAVE_VERSION
    merged.timestamp = Date.now()

    const json = JSON.stringify(merged)
    localStorage.setItem(STORAGE_KEY, json)

    console.log(
      `[StorageService] Игра сохранена (${(json.length / 1024).toFixed(1)} KB)`,
    )
    return true
  } catch (error) {
    console.error('[StorageService] Ошибка сохранения:', error)
    return false
  }
}

/**
 * Загружает прогресс игрока из localStorage.
 *
 * Парсит JSON, валидирует структуру через {@link isValidSaveData},
 * и мерджит с дефолтами, чтобы гарантировать наличие всех полей
 * (на случай, если сохранение было сделано старой версией).
 *
 * @returns объект SaveData или `null`, если сохранения нет / оно повреждено
 *
 * @example
 * ```ts
 * const save = loadGame()
 * if (save) {
 *   console.log('Баланс:', save.playerData.balance)
 * }
 * ```
 */
export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw === null) {
      console.log('[StorageService] Сохранение не найдено')
      return null
    }

    const parsed: unknown = JSON.parse(raw)

    if (!isValidSaveData(parsed)) {
      console.warn(
        '[StorageService] Структура сохранения невалидна, данные отброшены',
      )
      return null
    }

    // Мерджим с дефолтами — добавляет поля, которых могло не быть
    // в старых версиях сохранения (forward-compatibility)
    const merged = deepMerge(DEFAULT_SAVE_DATA, parsed) as SaveData

    console.log(
      `[StorageService] Сохранение загружено (v${merged.version}, ` +
        `${new Date(merged.timestamp).toLocaleString('ru-RU')})`,
    )

    return merged
  } catch (error) {
    console.error('[StorageService] Ошибка загрузки:', error)
    return null
  }
}

/**
 * Удаляет сохранение из localStorage.
 *
 * Используется для полного сброса прогресса (кнопка «Сброс» в UI).
 * После вызова {@link hasSave} вернёт `false`.
 */
export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('[StorageService] Сохранение удалено')
  } catch (error) {
    console.error('[StorageService] Ошибка удаления сохранения:', error)
  }
}

/**
 * Проверяет, существует ли сохранение в localStorage.
 *
 * Не выполняет парсинг и валидацию — только проверяет наличие ключа.
 * Для полной проверки целостности используй {@link loadGame}.
 *
 * @returns `true` если ключ присутствует в localStorage
 */
export function hasSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Возвращает Unix-timestamp (мс) последнего сохранения.
 *
 * Выполняет полную загрузку и валидацию через {@link loadGame},
 * поэтому для частых проверок лучше кэшировать результат.
 *
 * @returns timestamp в миллисекундах или `null` если сохранения нет
 */
export function getLastSaveTime(): number | null {
  const save = loadGame()
  return save ? save.timestamp : null
}

/**
 * Вычисляет доход, накопленный за время отсутствия игрока.
 *
 * Берёт timestamp из последнего сохранения, вычисляет разницу
 * с текущим моментом и умножает на пассивный доход в секунду.
 *
 * Ограничения:
 * - Начисление только если прошло >= 1 минуты (защита от эксплойтов)
 * - Максимум `maxOfflineHours` часов (по умолчанию 24, GDD раздел 6)
 * - Возвращает 0 если нет сохранения или пассивный доход <= 0
 *
 * @param passiveIncomePerSec - текущий пассивный доход (₽/сек)
 * @param maxOfflineHours     - лимит оффлайн-начисления в часах (по умолчанию 24)
 * @returns сумма оффлайн-дохода в рублях, округлённая до 2 знаков
 *
 * @example
 * ```ts
 * const earnings = calculateOfflineEarnings(5.5) // 5.5 ₽/сек
 * if (earnings > 0) {
 *   showOfflinePopup(earnings)
 * }
 * ```
 */
export function calculateOfflineEarnings(
  passiveIncomePerSec: number,
  maxOfflineHours: number = 24,
): number {
  if (passiveIncomePerSec <= 0) return 0

  const lastTimestamp = getLastSaveTime()
  if (lastTimestamp === null || lastTimestamp === 0) return 0

  const now = Date.now()
  const elapsedSeconds = (now - lastTimestamp) / 1000

  // Минимальный порог — 1 минута
  if (elapsedSeconds < MIN_OFFLINE_SECONDS) return 0

  // Ограничиваем максимальным временем
  const maxSeconds = maxOfflineHours * SECONDS_PER_HOUR
  const clampedSeconds = Math.min(elapsedSeconds, maxSeconds)

  const earnings = clampedSeconds * passiveIncomePerSec

  console.log(
    `[StorageService] Оффлайн-доход: ${earnings.toFixed(2)} ₽ ` +
      `(${(clampedSeconds / 60).toFixed(0)} мин × ${passiveIncomePerSec} ₽/сек)`,
  )

  return parseFloat(earnings.toFixed(2))
}

// ============================================
// ДЕФОЛТНЫЙ ЭКСПОРТ — ОБЪЕКТ-СЕРВИС
// ============================================

/**
 * Объект-сервис с именованными методами.
 *
 * Удобен при передаче сервиса целиком, например в DI-контейнер
 * или в конфигурацию store middleware:
 *
 * ```ts
 * import storageService from './storageService'
 * storageService.saveGame({ playerData: { ... } })
 * ```
 */
const storageService = {
  saveGame,
  loadGame,
  clearSave,
  hasSave,
  getLastSaveTime,
  calculateOfflineEarnings,
} as const

export default storageService
import { create } from 'zustand'
import {
  saveGame,
  loadGame,
  calculateOfflineEarnings,
  clearSave,
} from '../utils/storageService'

// ============================================
// КОНСТАНТЫ ЭКОНОМИКИ (из GDD раздел 6.3)
// ============================================

/** Коэффициент роста стоимости апгрейдов: Cost(n) = BaseCost × 1.15^n */
const UPGRADE_COST_MULTIPLIER = 1.15

/** Базовая стоимость апгрейда клика (GDD раздел 4.2A) */
const CLICK_UPGRADE_BASE_COST = 100

/** Базовая стоимость апгрейда скорости работы (GDD раздел 4.2C) */
const WORK_SPEED_BASE_COST = 500

/** Бонус скорости работы за каждый уровень: +10% (GDD раздел 4.2C) */
const WORK_SPEED_BONUS_PER_LEVEL = 0.10

/**
 * Пороги стоимости улучшения гаража (GDD раздел 5).
 * Ключ — текущий уровень, значение — стоимость перехода на следующий.
 */
export const GARAGE_LEVEL_THRESHOLDS: Record<number, number> = {
  1: 10_000,
  2: 50_000,
  3: 200_000,
  4: 1_000_000,
}

// ============================================
// ТИПЫ
// ============================================

/** Идентификаторы типов работников */
export type WorkerType = 'apprentice' | 'mechanic'

/** Идентификаторы типов апгрейдов */
export type UpgradeType = 'clickPower' | 'workSpeed'

/** Данные одного апгрейда */
export interface UpgradeData {
  /** Текущий уровень апгрейда (0 = не куплен) */
  level: number
  /** Стоимость следующего уровня */
  cost: number
  /** Базовая стоимость для пересчёта формулы */
  baseCost: number
}

/** Данные одного типа работника */
export interface WorkerData {
  /** Количество нанятых работников данного типа */
  count: number
  /** Стоимость найма следующего работника */
  cost: number
  /** Базовая стоимость для пересчёта формулы */
  baseCost: number
  /** Базовый доход в секунду одного работника (до бонусов скорости) */
  baseIncomePerSec: number
  /** Максимальное количество работников данного типа (GDD раздел 4.2B) */
  maxCount: number
}

/** Слайс состояния апгрейдов */
export interface UpgradesState {
  clickPower: UpgradeData
  workSpeed: UpgradeData
}

/** Слайс состояния работников */
export interface WorkersState {
  apprentice: WorkerData
  mechanic: WorkerData
}

/**
 * Интерфейс состояния игры.
 * Содержит все данные о прогрессе игрока, включая мета-поля
 * для системы сохранения и аналитики.
 */
interface GameState {
  /** Текущий баланс игрока в рублях */
  balance: number
  /** Доход за один клик */
  clickValue: number
  /** Общее количество кликов за всё время */
  totalClicks: number
  /** Текущий уровень гаража (1-20) */
  garageLevel: number
  /** Суммарный пассивный доход в секунду (с учётом бонуса скорости) */
  passiveIncomePerSecond: number
  /** Состояние апгрейдов */
  upgrades: UpgradesState
  /** Состояние работников */
  workers: WorkersState

  // --- Поля для системы сохранения ---

  /** Премиум валюта (гайки) — покупается за Telegram Stars */
  nuts: number
  /** Суммарный заработок за всё время (для лиг и аналитики) */
  totalEarned: number
  /** Количество игровых сессий */
  sessionCount: number
  /** ISO-дата последней сессии */
  lastSessionDate: string
  /** Флаг завершения загрузки — UI показывает лоадер, пока false */
  isLoaded: boolean

  // --- Данные оффлайн-дохода (для модалки Welcome Back) ---

  /** Сумма оффлайн-дохода, начисленного при загрузке (₽). 0 = не было оффлайна */
  lastOfflineEarnings: number
  /** Время отсутствия в секундах (для отображения в модалке) */
  lastOfflineTimeAway: number
}

/**
 * Интерфейс действий (actions).
 * Методы для изменения состояния игры.
 */
interface GameActions {
  /** Обработчик клика по гаражу */
  handleClick: () => void

  /**
   * Покупка апгрейда дохода за клик (устаревший)
   * @deprecated Используй purchaseClickUpgrade()
   */
  purchaseUpgrade: (cost: number, newClickValue: number) => boolean

  /** Покупка улучшения дохода за клик */
  purchaseClickUpgrade: () => boolean

  /** Покупка улучшения скорости работы (+10% к пассивному доходу) */
  purchaseWorkSpeedUpgrade: () => boolean

  /** Найм работника указанного типа */
  hireWorker: (workerType: WorkerType) => boolean

  /** Запуск интервала пассивного дохода. Возвращает cleanup */
  startPassiveIncome: () => () => void

  /** Сброс игры к начальным значениям (для отладки) */
  resetGame: () => void

  // --- Действия системы сохранения ---

  /**
   * Сохраняет текущий прогресс в localStorage.
   * Вызывается автоматически каждые 30 сек и при значимых действиях.
   */
  saveProgress: () => void

  /**
   * Загружает прогресс из localStorage при старте.
   * Вычисляет и начисляет оффлайн-доход.
   * Устанавливает isLoaded = true по завершении.
   */
  loadProgress: () => void

  /**
   * Начисляет оффлайн-доход на баланс и totalEarned.
   * @param amount — сумма оффлайн-дохода в рублях
   */
  addOfflineEarnings: (amount: number) => void

  /** Сбрасывает данные оффлайн-дохода после показа модалки */
  clearOfflineEarnings: () => void

  /** Улучшение гаража до следующего уровня (списывает деньги) */
  upgradeGarage: () => boolean
}

/** Полный тип хранилища */
type GameStore = GameState & GameActions

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Вычисляет стоимость апгрейда по формуле из GDD (раздел 6.3):
 * Cost(n) = BaseCost × 1.15^n
 */
function calculateUpgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * Math.pow(UPGRADE_COST_MULTIPLIER, level))
}

/**
 * Вычисляет суммарный пассивный доход в секунду с учётом бонуса скорости.
 * Формула: сумма(count × baseIncomePerSec) × (1 + workSpeedLevel × 0.10)
 */
function calculatePassiveIncome(workers: WorkersState, workSpeedLevel: number): number {
  const baseIncome =
    workers.apprentice.count * workers.apprentice.baseIncomePerSec +
    workers.mechanic.count * workers.mechanic.baseIncomePerSec

  const speedMultiplier = 1 + workSpeedLevel * WORK_SPEED_BONUS_PER_LEVEL

  return parseFloat((baseIncome * speedMultiplier).toFixed(2))
}

// ============================================
// НАЧАЛЬНОЕ СОСТОЯНИЕ
// ============================================

const initialState: GameState = {
  balance: 0,
  clickValue: 1,
  totalClicks: 0,
  garageLevel: 1,
  passiveIncomePerSecond: 0,

  upgrades: {
    clickPower: {
      level: 0,
      cost: CLICK_UPGRADE_BASE_COST,
      baseCost: CLICK_UPGRADE_BASE_COST,
    },
    workSpeed: {
      level: 0,
      cost: WORK_SPEED_BASE_COST,
      baseCost: WORK_SPEED_BASE_COST,
    },
  },

  workers: {
    apprentice: {
      count: 0,
      cost: 500,
      baseCost: 500,
      baseIncomePerSec: 0.5,
      maxCount: 10,
    },
    mechanic: {
      count: 0,
      cost: 5_000,
      baseCost: 5_000,
      baseIncomePerSec: 5,
      maxCount: 10,
    },
  },

  // Поля системы сохранения
  nuts: 0,
  totalEarned: 0,
  sessionCount: 0,
  lastSessionDate: new Date().toISOString(),
  isLoaded: false,

  // Данные оффлайн-дохода
  lastOfflineEarnings: 0,
  lastOfflineTimeAway: 0,
}

// ============================================
// STORE
// ============================================

/**
 * Zustand хранилище для игрового состояния.
 *
 * Архитектурные решения:
 * - Формулы экономики строго по GDD (раздел 6.3)
 * - passiveIncomePerSecond пересчитывается при изменении работников / скорости
 * - baseCost хранится отдельно для корректного Cost(n) = BaseCost × 1.15^n
 * - startPassiveIncome возвращает cleanup для useEffect
 * - saveProgress / loadProgress интегрируют storageService
 * - totalEarned обновляется при каждом начислении дохода (клик, пассив, оффлайн)
 */
export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  // ============================================
  // КЛИК ПО ГАРАЖУ
  // ============================================

  handleClick: () => {
    const { clickValue } = get()
    set((state) => ({
      balance: state.balance + clickValue,
      totalClicks: state.totalClicks + 1,
      totalEarned: state.totalEarned + clickValue,
    }))
  },

  // ============================================
  // LEGACY-МЕТОД (обратная совместимость)
  // ============================================

  purchaseUpgrade: (cost: number, newClickValue: number) => {
    const { balance } = get()
    if (balance < cost) return false

    set((state) => ({
      balance: state.balance - cost,
      clickValue: newClickValue,
    }))
    return true
  },

  // ============================================
  // ПОКУПКА АПГРЕЙДА КЛИКА
  // ============================================

  purchaseClickUpgrade: () => {
    const { balance, upgrades } = get()
    const { clickPower } = upgrades

    if (balance < clickPower.cost) {
      console.warn(`[ClickUpgrade] Недостаточно средств: нужно ${clickPower.cost} ₽, есть ${balance} ₽`)
      return false
    }

    const newLevel = clickPower.level + 1
    const newCost = calculateUpgradeCost(clickPower.baseCost, newLevel)

    set((state) => ({
      balance: state.balance - clickPower.cost,
      clickValue: state.clickValue + 1,
      upgrades: {
        ...state.upgrades,
        clickPower: {
          ...state.upgrades.clickPower,
          level: newLevel,
          cost: newCost,
        },
      },
    }))

    console.log(`[ClickUpgrade] Уровень ${newLevel}, следующая стоимость: ${newCost} ₽`)
    return true
  },

  // ============================================
  // ПОКУПКА АПГРЕЙДА СКОРОСТИ РАБОТЫ
  // ============================================

  purchaseWorkSpeedUpgrade: () => {
    const { balance, upgrades, workers } = get()
    const { workSpeed } = upgrades

    if (balance < workSpeed.cost) {
      console.warn(`[WorkSpeed] Недостаточно средств: нужно ${workSpeed.cost} ₽, есть ${balance} ₽`)
      return false
    }

    const newLevel = workSpeed.level + 1
    const newCost = calculateUpgradeCost(workSpeed.baseCost, newLevel)
    const newPassiveIncome = calculatePassiveIncome(workers, newLevel)

    set((state) => ({
      balance: state.balance - workSpeed.cost,
      passiveIncomePerSecond: newPassiveIncome,
      upgrades: {
        ...state.upgrades,
        workSpeed: {
          ...state.upgrades.workSpeed,
          level: newLevel,
          cost: newCost,
        },
      },
    }))

    console.log(`[WorkSpeed] Уровень ${newLevel}, пассивный доход: ${newPassiveIncome} ₽/сек`)
    return true
  },

  // ============================================
  // НАЙМ РАБОТНИКА
  // ============================================

  hireWorker: (workerType: WorkerType) => {
    const { balance, workers, upgrades } = get()
    const worker = workers[workerType]

    if (worker.count >= worker.maxCount) {
      console.warn(`[HireWorker] Достигнут лимит для ${workerType}: ${worker.maxCount}`)
      return false
    }

    if (balance < worker.cost) {
      console.warn(`[HireWorker] Недостаточно средств: нужно ${worker.cost} ₽, есть ${balance} ₽`)
      return false
    }

    const newCount = worker.count + 1
    const newCost = calculateUpgradeCost(worker.baseCost, newCount)

    const updatedWorkers: WorkersState = {
      ...workers,
      [workerType]: {
        ...worker,
        count: newCount,
        cost: newCost,
      },
    }

    const newPassiveIncome = calculatePassiveIncome(updatedWorkers, upgrades.workSpeed.level)

    set((state) => ({
      balance: state.balance - worker.cost,
      passiveIncomePerSecond: newPassiveIncome,
      workers: updatedWorkers,
    }))

    console.log(
      `[HireWorker] ${workerType} #${newCount}, следующий стоит: ${newCost} ₽, пассивный доход: ${newPassiveIncome} ₽/сек`,
    )
    return true
  },

  // ============================================
  // ПАССИВНЫЙ ДОХОД
  // ============================================

  startPassiveIncome: () => {
    const intervalId = setInterval(() => {
      const { passiveIncomePerSecond } = get()
      if (passiveIncomePerSecond <= 0) return

      set((state) => ({
        balance: parseFloat((state.balance + passiveIncomePerSecond).toFixed(2)),
        totalEarned: parseFloat((state.totalEarned + passiveIncomePerSecond).toFixed(2)),
      }))
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  },

  // ============================================
  // СОХРАНЕНИЕ ПРОГРЕССА
  // ============================================

  saveProgress: () => {
    const state = get()

    const success = saveGame({
      playerData: {
        balance: state.balance,
        nuts: state.nuts,
        totalClicks: state.totalClicks,
        garageLevel: state.garageLevel,
      },
      upgrades: {
        clickPower: { level: state.upgrades.clickPower.level, cost: state.upgrades.clickPower.cost },
        workSpeed: { level: state.upgrades.workSpeed.level, cost: state.upgrades.workSpeed.cost },
      },
      workers: {
        apprentice: { count: state.workers.apprentice.count, cost: state.workers.apprentice.cost },
        mechanic: { count: state.workers.mechanic.count, cost: state.workers.mechanic.cost },
      },
      stats: {
        totalEarned: state.totalEarned,
        sessionCount: state.sessionCount,
        lastSessionDate: state.lastSessionDate,
      },
    })

    if (success) {
      console.log('[Save] Прогресс сохранён')
    } else {
      console.error('[Save] Ошибка сохранения')
    }
  },

  // ============================================
  // ЗАГРУЗКА ПРОГРЕССА
  // ============================================

  loadProgress: () => {
    const saveData = loadGame()

    if (!saveData) {
      console.log('[Load] Сохранение не найдено, начинаем новую игру')
      set({
        isLoaded: true,
        sessionCount: 1,
        lastSessionDate: new Date().toISOString(),
      })
      return
    }

    console.log('[Load] Загружаем сохранённый прогресс...')

    // --- Восстанавливаем работников с полными данными ---
    // SaveData хранит только count и cost, остальные поля берём из initialState

    const restoredWorkers: WorkersState = {
      apprentice: {
        ...initialState.workers.apprentice,
        count: saveData.workers.apprentice.count,
        cost: saveData.workers.apprentice.cost,
      },
      mechanic: {
        ...initialState.workers.mechanic,
        count: saveData.workers.mechanic.count,
        cost: saveData.workers.mechanic.cost,
      },
    }

    // --- Восстанавливаем апгрейды с baseCost ---

    const restoredUpgrades: UpgradesState = {
      clickPower: {
        ...initialState.upgrades.clickPower,
        level: saveData.upgrades.clickPower.level,
        cost: saveData.upgrades.clickPower.cost,
      },
      workSpeed: {
        ...initialState.upgrades.workSpeed,
        level: saveData.upgrades.workSpeed.level,
        cost: saveData.upgrades.workSpeed.cost,
      },
    }

    // --- Пересчитываем пассивный доход на основе загруженных данных ---

    const passiveIncome = calculatePassiveIncome(
      restoredWorkers,
      restoredUpgrades.workSpeed.level,
    )

    // --- Вычисляем оффлайн-доход (макс 24 часа, GDD раздел 6) ---

    const offlineEarnings = calculateOfflineEarnings(passiveIncome, 24)

    // --- Вычисляем время отсутствия для модалки ---

    const now = Date.now()
    const offlineTimeAway = saveData.timestamp > 0
      ? Math.floor((now - saveData.timestamp) / 1000)
      : 0

    console.log(`[Load] timestamp сохранения: ${new Date(saveData.timestamp).toLocaleString('ru-RU')}`)
    console.log(`[Load] Время отсутствия: ${offlineTimeAway} сек, пассивный доход: ${passiveIncome} ₽/сек`)
    console.log(`[Load] Рассчитанный оффлайн-доход: ${offlineEarnings.toFixed(2)} ₽`)

    // --- Восстанавливаем clickValue из уровня апгрейда ---
    // clickValue = базовый (1) + уровень апгрейда клика

    const restoredClickValue = 1 + restoredUpgrades.clickPower.level

    // --- Применяем всё разом ---

    set({
      balance: saveData.playerData.balance,
      nuts: saveData.playerData.nuts ?? 0,
      totalClicks: saveData.playerData.totalClicks,
      garageLevel: saveData.playerData.garageLevel,
      clickValue: restoredClickValue,
      upgrades: restoredUpgrades,
      workers: restoredWorkers,
      totalEarned: saveData.stats.totalEarned ?? 0,
      sessionCount: (saveData.stats.sessionCount ?? 0) + 1,
      lastSessionDate: new Date().toISOString(),
      passiveIncomePerSecond: passiveIncome,
      isLoaded: true,
      lastOfflineEarnings: offlineEarnings,
      lastOfflineTimeAway: offlineTimeAway,
    })

    // --- Начисляем оффлайн-доход после set ---

    if (offlineEarnings > 0) {
      get().addOfflineEarnings(offlineEarnings)
    }

    console.log('[Load] Прогресс загружен!')
    console.log(`[Load] Оффлайн-доход: ${offlineEarnings.toFixed(2)} ₽`)
  },

  // ============================================
  // ОФФЛАЙН-ДОХОД
  // ============================================

  addOfflineEarnings: (amount: number) => {
    set((state) => ({
      balance: parseFloat((state.balance + amount).toFixed(2)),
      totalEarned: parseFloat((state.totalEarned + amount).toFixed(2)),
    }))

    console.log(`[Offline] Начислен оффлайн-доход: ${amount.toFixed(2)} ₽`)
  },

  // ============================================
  // ОЧИСТКА ДАННЫХ ОФФЛАЙН-ДОХОДА
  // ============================================

  clearOfflineEarnings: () => {
    set({ lastOfflineEarnings: 0, lastOfflineTimeAway: 0 })
  },

  // ============================================
  // УЛУЧШЕНИЕ ГАРАЖА
  // ============================================

  upgradeGarage: () => {
    const { balance, garageLevel } = get()
    const cost = GARAGE_LEVEL_THRESHOLDS[garageLevel]

    if (!cost) {
      console.warn(`[GarageUpgrade] Максимальный уровень достигнут: ${garageLevel}`)
      return false
    }

    if (balance < cost) {
      console.warn(`[GarageUpgrade] Недостаточно средств: нужно ${cost} ₽, есть ${balance} ₽`)
      return false
    }

    const newLevel = garageLevel + 1

    set((state) => ({
      balance: state.balance - cost,
      garageLevel: newLevel,
    }))

    console.log(`[GarageUpgrade] Уровень ${garageLevel} → ${newLevel}, списано ${cost} ₽`)
    return true
  },

  // ============================================
  // СБРОС
  // ============================================

  resetGame: () => {
    clearSave()
    set({ ...initialState, isLoaded: true })
    console.log('[Game] Сброшена к начальным значениям, сохранение удалено')
  },
}))

// ============================================
// СЕЛЕКТОРЫ (оптимизация ре-рендеров)
// ============================================

export const useBalance = () => useGameStore((s) => s.balance)
export const useClickValue = () => useGameStore((s) => s.clickValue)
export const useTotalClicks = () => useGameStore((s) => s.totalClicks)
export const useGarageLevel = () => useGameStore((s) => s.garageLevel)
export const usePassiveIncome = () => useGameStore((s) => s.passiveIncomePerSecond)
export const useUpgrades = () => useGameStore((s) => s.upgrades)
export const useWorkers = () => useGameStore((s) => s.workers)
export const useNuts = () => useGameStore((s) => s.nuts)
export const useTotalEarned = () => useGameStore((s) => s.totalEarned)
export const useIsLoaded = () => useGameStore((s) => s.isLoaded)
export const useSessionCount = () => useGameStore((s) => s.sessionCount)
export const useLastOfflineEarnings = () => useGameStore((s) => s.lastOfflineEarnings)
export const useLastOfflineTimeAway = () => useGameStore((s) => s.lastOfflineTimeAway)

// ============================================
// СЕЛЕКТОРЫ УРОВНЯ ГАРАЖА
// ============================================

/** Стоимость улучшения до следующего уровня (null = максимальный уровень) */
export const useNextLevelCost = () =>
  useGameStore((s) => GARAGE_LEVEL_THRESHOLDS[s.garageLevel] ?? null)

/** Прогресс до следующего уровня (0–1). 1 = достаточно средств или макс уровень */
export const useGarageProgress = () =>
  useGameStore((s) => {
    const cost = GARAGE_LEVEL_THRESHOLDS[s.garageLevel]
    if (!cost) return 1
    return Math.min(s.balance / cost, 1)
  })

/** Можно ли улучшить гараж прямо сейчас */
export const useCanUpgradeGarage = () =>
  useGameStore((s) => {
    const cost = GARAGE_LEVEL_THRESHOLDS[s.garageLevel]
    return cost !== undefined && s.balance >= cost
  })
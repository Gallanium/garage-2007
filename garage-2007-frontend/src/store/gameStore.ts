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

/** Множитель роста стоимости апгрейдов: Cost(n) = floor(BaseCost × 1.324^n) — GDD v2.2 */
const UPGRADE_COST_GROWTH = 1.324

/** Множитель роста стоимости найма работников: Cost(n) = round(BaseCost × 1.15^n) */
const WORKER_COST_GROWTH = 1.15

/** Шанс критического клика (GDD раздел 4.1): 5% = 0.05 */
const CRITICAL_CLICK_CHANCE = 0.05

/** Множитель дохода при критическом клике (GDD раздел 4.1): x2 */
const CRITICAL_CLICK_MULTIPLIER = 2

/** Базовая стоимость апгрейда клика (GDD раздел 4.2A) */
const CLICK_UPGRADE_BASE_COST = 100

/** Базовая стоимость апгрейда скорости работы (GDD раздел 4.2C) */
const WORK_SPEED_BASE_COST = 500

/** Бонус скорости работы за каждый уровень: +10% (GDD раздел 4.2C) */
const WORK_SPEED_BONUS_PER_LEVEL = 0.10

/**
 * Таблица дохода за клик по уровням (GDD v2.2, раздел 4.2A).
 * Контрольные точки из GDD: 0:1, 1:2, ..., 10:27, 15:89, 20:293, 25:965, 30:3176, 40:33051, 50:343993.
 * Промежуточные значения — геометрическая интерполяция между контрольными точками.
 * Индекс = уровень апгрейда (0 = базовый, без покупок).
 */
const CLICK_INCOME_TABLE: number[] = [
  1, 2, 3, 4, 5, 7, 9, 12, 16, 21,                                       // 0-9
  27, 34, 44, 55, 70, 89, 113, 143, 182, 231,                             // 10-19
  293, 372, 472, 599, 760, 965, 1225, 1554, 1972, 2503,                   // 20-29
  3176, 4014, 5074, 6413, 8106, 10245, 12950, 16368, 20688, 26149,        // 30-39
  33051, 41775, 52803, 66741, 84359, 106627, 134773, 170349, 215316, 272153, // 40-49
  343993,                                                                   // 50
]

/**
 * Пороги стоимости улучшения гаража (GDD раздел 5).
 * Ключ — текущий уровень, значение — стоимость перехода на следующий.
 * 20 уровней: от «Ржавая ракушка» до «Автомобильная империя».
 */
export const GARAGE_LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 10_000,
  3: 50_000,
  4: 200_000,
  5: 1_000_000,
  6: 5_000_000,
  7: 25_000_000,
  8: 100_000_000,
  9: 300_000_000,
  10: 1_000_000_000,        // 1B
  11: 5_000_000_000,        // 5B
  12: 25_000_000_000,       // 25B
  13: 100_000_000_000,      // 100B
  14: 300_000_000_000,      // 300B
  15: 1_000_000_000_000,    // 1T
  16: 5_000_000_000_000,    // 5T
  17: 25_000_000_000_000,   // 25T
  18: 100_000_000_000_000,  // 100T
  19: 300_000_000_000_000,  // 300T
  20: 1_000_000_000_000_000 // 1Q (квадриллион)
} as const;

/** Названия уровней гаража согласно GDD */
export const GARAGE_LEVEL_NAMES = {
  1: 'Ржавая ракушка',
  2: 'Начало пути',
  3: 'Базовый ремонт',
  4: 'Мастерская',
  5: 'Гараж механика',
  6: 'Расширение',
  7: 'Специализация',
  8: 'Растущий бизнес',
  9: 'Автосервис',
  10: 'Профи-уровень',
  11: 'Модернизация',
  12: 'Техцентр',
  13: 'Расширение услуг',
  14: 'Премиум сервис',
  15: 'Окрасочная камера',
  16: 'Детейлинг центр',
  17: 'Тюнинг ателье',
  18: 'Дилерский центр',
  19: 'Элитный комплекс',
  20: 'Автоимперия',
} as const;

/**
 * Уровни-вехи (milestones) гаража.
 * На этих уровнях игрок может купить апгрейд, разблокирующий новых работников,
 * улучшения, декорации и визуальные изменения гаража.
 */
export const MILESTONE_LEVELS = [5, 10, 15, 20] as const
export type MilestoneLevel = typeof MILESTONE_LEVELS[number]

/**
 * Milestone-апгрейды гаража (GDD v2.2).
 * Доступны на уровнях-вехах: 5, 10, 15, 20.
 * Каждый milestone разблокирует работников, улучшения, декорации и визуал.
 */
export const MILESTONE_UPGRADES: Record<MilestoneLevel, {
  cost: number
  workerTypes: WorkerType[]
  workerNames: string[]
  unlocks: {
    workers: string[]
    upgrades: string[]
    decorations: string[]
    visual: string
  }
}> = {
  5: {
    cost: 1_000_000,
    workerTypes: ['mechanic'],
    workerNames: ['Механик'],
    unlocks: {
      workers: ['Механик (5₽/сек, макс. 10 шт)'],
      upgrades: ['Скорость работы уровни 1-10'],
      decorations: ['Профессиональные инструменты'],
      visual: 'Пневматика, покрашенные стены, верстак',
    },
  },
  10: {
    cost: 1_000_000_000,
    workerTypes: ['master'],
    workerNames: ['Мастер'],
    unlocks: {
      workers: ['Мастер (50₽/сек, макс. 10 шт)'],
      upgrades: ['Скорость работы уровни 21-30'],
      decorations: ['Неоновая вывеска, подъёмник'],
      visual: 'Современное оборудование, техцентр',
    },
  },
  15: {
    cost: 1_000_000_000_000,
    workerTypes: ['manager', 'foreman'],
    workerNames: ['Менеджер', 'Бригадир'],
    unlocks: {
      workers: ['Бригадир (500₽/сек)', 'Менеджер (доп. бонусы)'],
      upgrades: ['Скорость работы уровни 41-50'],
      decorations: ['Окрасочная камера'],
      visual: 'Премиум-сервис, VIP-зона',
    },
  },
  20: {
    cost: 1_000_000_000_000_000,
    workerTypes: ['director'],
    workerNames: ['Директор'],
    unlocks: {
      workers: ['Директор (50,000₽/сек)'],
      upgrades: ['ВСЕ улучшения до максимума'],
      decorations: ['ВСЕ элементы декора'],
      visual: 'Элитная автомобильная империя',
    },
  },
}

/**
 * Маппинг: тип работника → уровень функционального апгрейда, необходимого для разблокировки.
 * null = доступен с начала игры (без гейта).
 */
const WORKER_UNLOCK_LEVELS: Record<WorkerType, number | null> = {
  apprentice: null,  // Всегда доступен
  mechanic: 5,
  master: 10,
  manager: 15,
  foreman: 15,
  director: 20,
}

/**
 * Проверяет, разблокирован ли тип работника.
 * @param workerType - тип работника
 * @param purchasedUpgrades - массив купленных уровней апгрейдов
 */
export function isWorkerUnlocked(
  workerType: WorkerType,
  purchasedUpgrades: number[],
): boolean {
  const requiredLevel = WORKER_UNLOCK_LEVELS[workerType]
  if (requiredLevel === null) return true
  return purchasedUpgrades.includes(requiredLevel)
}

// ============================================
// ТИПЫ
// ============================================

/** Helper для форматирования больших чисел (используется в UI) */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1e15) return `${(num / 1e15).toFixed(1)}Q`; // Квадриллион
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`; // Триллион
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;   // Миллиард
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;   // Миллион
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;   // Тысяча
  return num.toFixed(0);
};

/** Идентификаторы типов работников */
export type WorkerType = 'apprentice' | 'mechanic' | 'master' | 'manager' | 'foreman' | 'director'

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
  master: WorkerData
  manager: WorkerData
  foreman: WorkerData
  director: WorkerData
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
  /** Список уровней, на которых были куплены функциональные апгрейды (напр. [5, 10]) */
  milestonesPurchased: number[]
  /** Показывать ли модалку milestone-апгрейда */
  showMilestoneModal: boolean
  /** Уровень milestone, ожидающего покупки (5, 10, 15 или 20) */
  pendingMilestoneLevel: number | null
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
  /** Обработчик клика по гаражу. Возвращает true при критическом клике */
  handleClick: () => boolean

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

  /**
   * Покупка milestone-апгрейда гаража.
   * Списывает деньги и разблокирует работника(ов) на уровнях-вехах (5, 10, 15, 20).
   * @param level — уровень вехи
   */
  purchaseMilestone: (level: number) => boolean

  /**
   * Проверяет, достиг ли игрок порога для milestone-апгрейда.
   * Если да и milestone не куплен → показывает модальное окно.
   */
  checkForMilestone: () => void

  /** Закрывает модалку milestone-апгрейда (игрок решил не покупать) */
  closeMilestoneModal: () => void
}

/** Полный тип хранилища */
type GameStore = GameState & GameActions

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/** Стоимость апгрейда клика: floor(100 × 1.324^level) — GDD v2.2 раздел 4.2A */
function calculateClickUpgradeCost(level: number): number {
  return Math.floor(CLICK_UPGRADE_BASE_COST * Math.pow(UPGRADE_COST_GROWTH, level))
}

/** Доход за клик на уровне level из lookup-таблицы GDD v2.2 — раздел 4.2A */
function calculateClickIncome(level: number): number {
  if (level < CLICK_INCOME_TABLE.length) return CLICK_INCOME_TABLE[level]
  // Fallback для уровней >50: экстраполяция по коэффициенту последних двух уровней
  const lastIdx = CLICK_INCOME_TABLE.length - 1
  const ratio = CLICK_INCOME_TABLE[lastIdx] / CLICK_INCOME_TABLE[lastIdx - 1]
  return Math.floor(CLICK_INCOME_TABLE[lastIdx] * Math.pow(ratio, level - lastIdx))
}

/** Стоимость апгрейда скорости работы: floor(500 × 1.324^level) — GDD v2.2 раздел 4.2C */
function calculateWorkSpeedUpgradeCost(level: number): number {
  return Math.floor(WORK_SPEED_BASE_COST * Math.pow(UPGRADE_COST_GROWTH, level))
}

/** Стоимость найма работника: round(baseCost × 1.15^count) — GDD раздел 4.2B */
function calculateWorkerHireCost(baseCost: number, count: number): number {
  return Math.round(baseCost * Math.pow(WORKER_COST_GROWTH, count))
}

/**
 * Вычисляет суммарный пассивный доход в секунду с учётом бонуса скорости.
 * Формула: сумма(count × baseIncomePerSec) × (1 + workSpeedLevel × 0.10)
 */
function calculatePassiveIncome(workers: WorkersState, workSpeedLevel: number): number {
  const baseIncome =
    workers.apprentice.count * workers.apprentice.baseIncomePerSec +
    workers.mechanic.count * workers.mechanic.baseIncomePerSec +
    workers.master.count * workers.master.baseIncomePerSec +
    workers.manager.count * workers.manager.baseIncomePerSec +
    workers.foreman.count * workers.foreman.baseIncomePerSec +
    workers.director.count * workers.director.baseIncomePerSec

  const speedMultiplier = 1 + workSpeedLevel * WORK_SPEED_BONUS_PER_LEVEL

  return parseFloat((baseIncome * speedMultiplier).toFixed(2))
}

/**
 * Проверяет, достиг ли баланс порога следующего уровня гаража,
 * и возвращает новый уровень. НЕ списывает деньги — чисто визуальная прогрессия.
 * Может перескочить несколько уровней за один вызов (напр. оффлайн-доход).
 */
function checkAutoLevel(balance: number, currentLevel: number): number {
  let newLevel = currentLevel
  while (newLevel < 20) {
    const nextThreshold = GARAGE_LEVEL_THRESHOLDS[newLevel + 1]
    if (nextThreshold === undefined || balance < nextThreshold) break
    newLevel++
  }
  return newLevel
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

  milestonesPurchased: [],
  showMilestoneModal: false,
  pendingMilestoneLevel: null,

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
    master: {
      count: 0,
      cost: 50_000,
      baseCost: 50_000,
      baseIncomePerSec: 50,
      maxCount: 10,
    },
    manager: {
      count: 0,
      cost: 5_000_000,
      baseCost: 5_000_000,
      baseIncomePerSec: 5_000,
      maxCount: 5,
    },
    foreman: {
      count: 0,
      cost: 500_000,
      baseCost: 500_000,
      baseIncomePerSec: 500,
      maxCount: 5,
    },
    director: {
      count: 0,
      cost: 50_000_000,
      baseCost: 50_000_000,
      baseIncomePerSec: 50_000,
      maxCount: 3,
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
    const isCritical = Math.random() < CRITICAL_CLICK_CHANCE
    const income = isCritical ? clickValue * CRITICAL_CLICK_MULTIPLIER : clickValue

    set((state) => {
      const newBalance = state.balance + income
      const newLevel = checkAutoLevel(newBalance, state.garageLevel)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalClicks: state.totalClicks + 1,
        totalEarned: state.totalEarned + income,
      }
      // Устанавливаем garageLevel только при реальном изменении,
      // чтобы не триггерить лишние ре-рендеры
      if (newLevel !== state.garageLevel) {
        result.garageLevel = newLevel
      }
      return result
    })

    return isCritical
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
    const newCost = calculateClickUpgradeCost(newLevel)
    const newClickValue = calculateClickIncome(newLevel)

    set((state) => ({
      balance: state.balance - clickPower.cost,
      clickValue: newClickValue,
      upgrades: {
        ...state.upgrades,
        clickPower: {
          ...state.upgrades.clickPower,
          level: newLevel,
          cost: newCost,
        },
      },
    }))

    console.log(`[ClickUpgrade] Уровень ${newLevel}, доход ${newClickValue} ₽/клик, след. стоимость: ${newCost} ₽`)
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
    const newCost = calculateWorkSpeedUpgradeCost(newLevel)
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
    const newCost = calculateWorkerHireCost(worker.baseCost, newCount)

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

      set((state) => {
        const newBalance = parseFloat((state.balance + passiveIncomePerSecond).toFixed(2))
        const newLevel = checkAutoLevel(newBalance, state.garageLevel)
        const result: Partial<GameState> = {
          balance: newBalance,
          totalEarned: parseFloat((state.totalEarned + passiveIncomePerSecond).toFixed(2)),
        }
        if (newLevel !== state.garageLevel) {
          result.garageLevel = newLevel
        }
        return result
      })
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
        milestonesPurchased: state.milestonesPurchased,
      },
      upgrades: {
        clickPower: { level: state.upgrades.clickPower.level, cost: state.upgrades.clickPower.cost },
        workSpeed: { level: state.upgrades.workSpeed.level, cost: state.upgrades.workSpeed.cost },
      },
      workers: {
        apprentice: { count: state.workers.apprentice.count, cost: state.workers.apprentice.cost },
        mechanic: { count: state.workers.mechanic.count, cost: state.workers.mechanic.cost },
        master: { count: state.workers.master.count, cost: state.workers.master.cost },
        manager: { count: state.workers.manager.count, cost: state.workers.manager.cost },
        foreman: { count: state.workers.foreman.count, cost: state.workers.foreman.cost },
        director: { count: state.workers.director.count, cost: state.workers.director.cost },
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

    // --- Восстанавливаем milestonesPurchased ---
    // Backward compat: в старых сейвах этого поля нет → []
    const playerDataAny = saveData.playerData as unknown as Record<string, unknown>
    const restoredPurchased: number[] =
      Array.isArray(playerDataAny.milestonesPurchased)
        ? (playerDataAny.milestonesPurchased as number[])
        : []

    // --- Backward compat: сброс механиков в старых сейвах ---
    // Если механики наняты, но апгрейд уровня 5 НЕ куплен → сбрасываем
    const mechanicSaveData = saveData.workers.mechanic
    const shouldResetMechanics =
      mechanicSaveData &&
      mechanicSaveData.count > 0 &&
      !restoredPurchased.includes(5)

    if (shouldResetMechanics) {
      console.log('[Load] Backward compat: сброс механиков (апгрейд ур.5 не куплен)')
    }

    // --- Восстанавливаем работников с полными данными ---
    // SaveData хранит только count и cost, остальные поля берём из initialState
    // Для новых типов работников: если нет в сейве → берём дефолт

    const savedWorkers = saveData.workers as unknown as Record<string, { count?: number; cost?: number }>

    const restoredWorkers: WorkersState = {
      apprentice: {
        ...initialState.workers.apprentice,
        count: saveData.workers.apprentice.count,
        cost: saveData.workers.apprentice.cost,
      },
      mechanic: {
        ...initialState.workers.mechanic,
        count: shouldResetMechanics ? 0 : (mechanicSaveData?.count ?? 0),
        cost: shouldResetMechanics
          ? initialState.workers.mechanic.baseCost
          : (mechanicSaveData?.cost ?? initialState.workers.mechanic.cost),
      },
      master: {
        ...initialState.workers.master,
        count: savedWorkers.master?.count ?? 0,
        cost: savedWorkers.master?.cost ?? initialState.workers.master.cost,
      },
      manager: {
        ...initialState.workers.manager,
        count: savedWorkers.manager?.count ?? 0,
        cost: savedWorkers.manager?.cost ?? initialState.workers.manager.cost,
      },
      foreman: {
        ...initialState.workers.foreman,
        count: savedWorkers.foreman?.count ?? 0,
        cost: savedWorkers.foreman?.cost ?? initialState.workers.foreman.cost,
      },
      director: {
        ...initialState.workers.director,
        count: savedWorkers.director?.count ?? 0,
        cost: savedWorkers.director?.cost ?? initialState.workers.director.cost,
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

    const offlineEarnings = calculateOfflineEarnings(passiveIncome, saveData.timestamp, 24)

    // --- Вычисляем время отсутствия для модалки ---

    const now = Date.now()
    const offlineTimeAway = saveData.timestamp > 0
      ? Math.floor((now - saveData.timestamp) / 1000)
      : 0

    console.log(`[Load] timestamp сохранения: ${new Date(saveData.timestamp).toLocaleString('ru-RU')}`)
    console.log(`[Load] Время отсутствия: ${offlineTimeAway} сек, пассивный доход: ${passiveIncome} ₽/сек`)
    console.log(`[Load] Рассчитанный оффлайн-доход: ${offlineEarnings.toFixed(2)} ₽`)

    // --- Восстанавливаем clickValue из уровня апгрейда ---
    // clickValue = значение из lookup-таблицы GDD v2.2

    const restoredClickValue = calculateClickIncome(restoredUpgrades.clickPower.level)

    // --- Авто-левелинг: пересчитываем уровень гаража из баланса ---
    // Баланс — источник истины для визуальной прогрессии

    const autoLevel = checkAutoLevel(saveData.playerData.balance, 1)

    console.log(`[Load] Авто-уровень из баланса: ${autoLevel} (сохранённый: ${saveData.playerData.garageLevel})`)

    // --- Применяем всё разом ---

    set({
      balance: saveData.playerData.balance,
      nuts: saveData.playerData.nuts ?? 0,
      totalClicks: saveData.playerData.totalClicks,
      garageLevel: autoLevel,
      milestonesPurchased: restoredPurchased,
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

    // --- Проверяем milestone после загрузки ---
    get().checkForMilestone()
  },

  // ============================================
  // ОФФЛАЙН-ДОХОД
  // ============================================

  addOfflineEarnings: (amount: number) => {
    set((state) => {
      const newBalance = parseFloat((state.balance + amount).toFixed(2))
      const newLevel = checkAutoLevel(newBalance, state.garageLevel)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalEarned: parseFloat((state.totalEarned + amount).toFixed(2)),
      }
      if (newLevel !== state.garageLevel) {
        result.garageLevel = newLevel
      }
      return result
    })

    console.log(`[Offline] Начислен оффлайн-доход: ${amount.toFixed(2)} ₽`)
  },

  // ============================================
  // ОЧИСТКА ДАННЫХ ОФФЛАЙН-ДОХОДА
  // ============================================

  clearOfflineEarnings: () => {
    set({ lastOfflineEarnings: 0, lastOfflineTimeAway: 0 })
  },

  // ============================================
  // MILESTONE-АПГРЕЙДЫ ГАРАЖА
  // ============================================

  purchaseMilestone: (level: number) => {
    const { balance, milestonesPurchased } = get()
    const upgrade = MILESTONE_UPGRADES[level as MilestoneLevel]

    if (!upgrade) {
      console.warn(`[Milestone] Неизвестный уровень: ${level}`)
      return false
    }

    if (milestonesPurchased.includes(level)) {
      console.warn(`[Milestone] Уровень ${level} уже куплен`)
      return false
    }

    if (balance < upgrade.cost) {
      console.warn(
        `[Milestone] Недостаточно средств: нужно ${upgrade.cost} ₽, есть ${balance} ₽`,
      )
      return false
    }

    set((state) => ({
      balance: state.balance - upgrade.cost,
      milestonesPurchased: [...state.milestonesPurchased, level],
      showMilestoneModal: false,
      pendingMilestoneLevel: null,
    }))

    console.log(
      `[Milestone] Куплен апгрейд уровня ${level}: разблокирован ${upgrade.workerNames.join(', ')}`,
    )
    return true
  },

  checkForMilestone: () => {
    const state = get()
    for (const level of MILESTONE_LEVELS) {
      if (state.garageLevel >= level && !state.milestonesPurchased.includes(level)) {
        set({ showMilestoneModal: true, pendingMilestoneLevel: level })
        return
      }
    }
  },

  closeMilestoneModal: () => {
    set({ showMilestoneModal: false, pendingMilestoneLevel: null })
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
// СЕЛЕКТОРЫ УРОВНЯ ГАРАЖА (автоматическая прогрессия)
// ============================================

/** Порог баланса для следующего автоматического уровня (null = макс уровень) */
export const useNextLevelCost = () =>
  useGameStore((s) => {
    if (s.garageLevel >= 20) return null
    return GARAGE_LEVEL_THRESHOLDS[s.garageLevel + 1] ?? null
  })

/**
 * Относительный прогресс до следующего уровня (0–1).
 * Прогресс считается между порогом текущего и следующего уровней.
 * 1 = достигнут следующий порог или макс уровень.
 */
export const useGarageProgress = () =>
  useGameStore((s) => {
    if (s.garageLevel >= 20) return 1
    const nextThreshold = GARAGE_LEVEL_THRESHOLDS[s.garageLevel + 1]
    if (!nextThreshold) return 1
    const currentThreshold = GARAGE_LEVEL_THRESHOLDS[s.garageLevel] ?? 0
    const range = nextThreshold - currentThreshold
    if (range <= 0) return 1
    const progress = (s.balance - currentThreshold) / range
    return Math.min(Math.max(progress, 0), 1)
  })

// ============================================
// СЕЛЕКТОРЫ MILESTONE-АПГРЕЙДОВ
// ============================================

/** Список купленных milestone-апгрейдов */
export const useMilestonesPurchased = () =>
  useGameStore((s) => s.milestonesPurchased)

/** Показывать ли модалку milestone-апгрейда */
export const useShowMilestoneModal = () =>
  useGameStore((s) => s.showMilestoneModal)

/** Уровень milestone, ожидающего покупки (5, 10, 15 или 20), или null */
export const usePendingMilestoneLevel = () =>
  useGameStore((s) => s.pendingMilestoneLevel)

/** Действие: проверить доступность milestone */
export const useCheckForMilestone = () =>
  useGameStore((s) => s.checkForMilestone)

/** Действие: купить milestone */
export const usePurchaseMilestone = () =>
  useGameStore((s) => s.purchaseMilestone)

/** Действие: закрыть модалку milestone */
export const useCloseMilestoneModal = () =>
  useGameStore((s) => s.closeMilestoneModal)
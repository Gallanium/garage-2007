import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  saveGame,
  loadGame,
  calculateOfflineEarnings,
  clearSave,
} from '../utils/storageService'

// ============================================
// КОНСТАНТЫ ЭКОНОМИКИ (из GDD раздел 6.3)
// ============================================

// ЭКОНОМИЧЕСКИЕ КОНСТАНТЫ (из game balance document v1.1)

/** Базовые стоимости всех систем */
export const BASE_COSTS = {
  clickUpgrade: 100,      // Первый апгрейд клика
  apprentice: 500,        // Первый подмастерье
  mechanic: 5_000,        // Первый механик (milestone 5)
  master: 50_000,         // Первый мастер (milestone 10)
  brigadier: 500_000,     // Первый бригадир (milestone 15)
  director: 5_000_000,    // Первый директор (milestone 20)
  workSpeed: 500,         // Первый уровень скорости
} as const

/**
 * Доход работников (₽/сек) от одного экземпляра.
 * GBD v1.1: Увеличен в 4 раза для компенсации малых лимитов.
 */
export const WORKER_INCOME = {
  apprentice: 2,          // Подмастерье: 2₽/сек
  mechanic: 20,           // Механик: 20₽/сек
  master: 200,            // Мастер: 200₽/сек
  brigadier: 2_000,       // Бригадир: 2,000₽/сек
  director: 20_000,       // Директор: 20,000₽/сек
} as const

/**
 * ЖЁСТКИЕ ЛИМИТЫ количества работников.
 * GBD v1.1: Реалистичные значения.
 *
 * Обоснование:
 * - 3 подмастерья: ученики на подхвате
 * - 5 механиков: основная бригада
 * - 3 мастера: узкие специалисты
 * - 2 бригадира: управление сменами
 * - 1 директор: ты сам!
 *
 * ИТОГО: 14 человек = реалистичный автосервис
 */
export const WORKER_LIMITS = {
  apprentice: 3,
  mechanic: 5,
  master: 3,
  brigadier: 2,
  director: 1,
} as const

/** Единый множитель роста стоимости для ВСЕХ систем (апгрейды, работники, скорость) */
export const COST_MULTIPLIER = 1.15

/**
 * Эффект апгрейда «Скорость работы».
 * Каждый уровень = +10% к пассивному доходу.
 */
export const WORK_SPEED_BONUS_PER_LEVEL = 0.1

/** Шанс критического клика (GDD раздел 4.1): 5% = 0.05 */
const CRITICAL_CLICK_CHANCE = 0.05

/** Множитель дохода при критическом клике (GDD раздел 4.1): x2 */
const CRITICAL_CLICK_MULTIPLIER = 2

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
      workers: ['Механик (20 ₽/сек, макс. 5)'],
      upgrades: ['Скорость работы (+10% к доходу работников)'],
      decorations: [],
      visual: '',
    },
  },
  10: {
    cost: 1_000_000_000,
    workerTypes: ['master'],
    workerNames: ['Мастер'],
    unlocks: {
      workers: ['Мастер (200 ₽/сек, макс. 3)'],
      upgrades: [],
      decorations: [],
      visual: '',
    },
  },
  15: {
    cost: 1_000_000_000_000,
    workerTypes: ['brigadier'],
    workerNames: ['Бригадир'],
    unlocks: {
      workers: ['Бригадир (2 000 ₽/сек, макс. 2)'],
      upgrades: [],
      decorations: [],
      visual: '',
    },
  },
  20: {
    cost: 1_000_000_000_000_000,
    workerTypes: ['director'],
    workerNames: ['Директор'],
    unlocks: {
      workers: ['Директор (20 000 ₽/сек, макс. 1)'],
      upgrades: [],
      decorations: [],
      visual: '',
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
  brigadier: 15,
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
  return num.toLocaleString();
};

/** Идентификаторы типов работников */
export type WorkerType = 'apprentice' | 'mechanic' | 'master' | 'brigadier' | 'director'

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

/** Данные одного типа работника (GBD v1.1: упрощённая структура) */
export interface WorkerData {
  /** Количество нанятых работников данного типа */
  count: number
  /** Стоимость найма следующего работника */
  cost: number
}

/** Слайс состояния апгрейдов */
export interface UpgradesState {
  clickPower: UpgradeData
  workSpeed: UpgradeData
}

/** Слайс состояния работников (GBD v1.1: 5 типов) */
export interface WorkersState {
  apprentice: WorkerData
  mechanic: WorkerData
  master: WorkerData
  brigadier: WorkerData
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
  /** Была ли модалка milestone закрыта игроком (чтобы не спамить повторно) */
  milestoneModalDismissed: boolean
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

  /** Покупка улучшения скорости работы (GBD v1.1: +10% за уровень, milestone 5) */
  purchaseWorkSpeedUpgrade: () => void

  /** Найм работника указанного типа (GBD v1.1: с проверкой лимитов и milestone) */
  hireWorker: (workerType: WorkerType) => void

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

// ============================================
// ФОРМУЛЫ РАСЧЁТА (GBD v1.1)
// ============================================

/**
 * Расчёт стоимости N-го уровня апгрейда.
 * Формула: Cost(n) = floor(BaseCost × 1.15^n)
 *
 * @example
 * calculateUpgradeCost(100, 0) // 100₽ (первый уровень)
 * calculateUpgradeCost(100, 1) // 115₽ (второй уровень)
 * calculateUpgradeCost(100, 10) // 404₽ (одиннадцатый уровень)
 */
function calculateUpgradeCost(baseCost: number, level: number): number {
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, level))
}

/**
 * Расчёт стоимости N-го экземпляра работника.
 * Стоимость растёт с каждым нанятым работником.
 * Формула: Cost(n) = floor(BaseCost × 1.15^count)
 *
 * @example
 * calculateWorkerCost(500, 0) // 500₽ (первый подмастерье)
 * calculateWorkerCost(500, 1) // 575₽ (второй подмастерье)
 * calculateWorkerCost(500, 2) // 661₽ (третий подмастерье)
 */
function calculateWorkerCost(baseCost: number, count: number): number {
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, count))
}

/**
 * Расчёт дохода за клик на уровне N.
 * GBD v1.1: УПРОЩЁННАЯ ФОРМУЛА — каждый уровень добавляет ровно +1₽.
 *
 * Формула: Income(n) = n + 1
 *
 * @example
 * calculateClickIncome(0) // 1₽/клик (без апгрейдов)
 * calculateClickIncome(1) // 2₽/клик
 * calculateClickIncome(10) // 11₽/клик
 * calculateClickIncome(50) // 51₽/клик
 */
function calculateClickIncome(level: number): number {
  return level + 1
}

/**
 * Расчёт множителя скорости работы.
 * Формула: Multiplier = 1.0 + (level × 0.1)
 *
 * @example
 * calculateWorkSpeedMultiplier(0)  // 1.0 (×1.0 = 100%)
 * calculateWorkSpeedMultiplier(5)  // 1.5 (×1.5 = 150%)
 * calculateWorkSpeedMultiplier(10) // 2.0 (×2.0 = 200%)
 * calculateWorkSpeedMultiplier(20) // 3.0 (×3.0 = 300%)
 */
function calculateWorkSpeedMultiplier(level: number): number {
  return 1.0 + (level * WORK_SPEED_BONUS_PER_LEVEL)
}

/**
 * Расчёт общего пассивного дохода от всех работников.
 * Учитывает количество каждого типа и множитель скорости.
 *
 * Формула:
 * BaseIncome = Σ(worker_count × worker_income)
 * TotalIncome = BaseIncome × WorkSpeedMultiplier
 *
 * @example
 * // 3 подмастерья + 5 механиков, скорость 5
 * // Результат: (3×2 + 5×20) × 1.5 = 159₽/сек
 */
function calculateTotalPassiveIncome(
  workers: Record<string, { count: number }>,
  workSpeedLevel: number,
): number {
  let baseIncome = 0

  // Суммируем доход от всех типов работников
  for (const [type, data] of Object.entries(workers)) {
    const incomePerWorker = WORKER_INCOME[type as keyof typeof WORKER_INCOME] || 0
    baseIncome += data.count * incomePerWorker
  }

  // Применяем множитель скорости
  const multiplier = calculateWorkSpeedMultiplier(workSpeedLevel)
  return parseFloat((baseIncome * multiplier).toFixed(2))
}

/**
 * Проверяет, достиг ли баланс порога следующего уровня гаража,
 * и возвращает новый уровень. НЕ списывает деньги — чисто визуальная прогрессия.
 * Может перескочить несколько уровней за один вызов (напр. оффлайн-доход).
 *
 * MILESTONE-ГЕЙТИНГ: Уровень останавливается ПЕРЕД milestone (5/10/15/20),
 * пока milestone не куплен. Модалка показывается через checkForMilestone()
 * по проверке баланса >= порог milestone.
 *
 * Пример: баланс 1.5M, milestones=[] → уровень 4 (не 5).
 * После покупки milestone 5 → уровень прыгает до 5+.
 */
export function checkAutoLevel(
  balance: number,
  currentLevel: number,
  milestonesPurchased: number[],
): number {
  let newLevel = currentLevel
  while (newLevel < 20) {
    const nextLevel = newLevel + 1
    const nextThreshold = GARAGE_LEVEL_THRESHOLDS[nextLevel]
    if (nextThreshold === undefined || balance < nextThreshold) break
    // Если следующий уровень — непокупленный milestone, стоп ПЕРЕД ним
    if (
      (MILESTONE_LEVELS as readonly number[]).includes(nextLevel) &&
      !milestonesPurchased.includes(nextLevel)
    ) {
      break
    }
    newLevel = nextLevel
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
      cost: BASE_COSTS.clickUpgrade,
      baseCost: BASE_COSTS.clickUpgrade,
    },
    workSpeed: {
      level: 0,
      cost: BASE_COSTS.workSpeed,
      baseCost: BASE_COSTS.workSpeed,
    },
  },

  milestonesPurchased: [],
  showMilestoneModal: false,
  pendingMilestoneLevel: null,
  milestoneModalDismissed: false,

  workers: {
    apprentice: {
      count: 0,
      cost: BASE_COSTS.apprentice,        // 500₽
    },
    mechanic: {
      count: 0,
      cost: BASE_COSTS.mechanic,          // 5,000₽
    },
    master: {
      count: 0,
      cost: BASE_COSTS.master,            // 50,000₽
    },
    brigadier: {
      count: 0,
      cost: BASE_COSTS.brigadier,         // 500,000₽
    },
    director: {
      count: 0,
      cost: BASE_COSTS.director,          // 5,000,000₽
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
 * - BaseCost берётся из констант BASE_COSTS для Cost(n) = BaseCost × 1.15^n
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
      const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
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

    // Проверяем milestone: баланс мог пересечь порог,
    // а garageLevel остался на месте (стоп перед milestone)
    get().checkForMilestone()

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
      console.warn(
        `[ClickUpgrade] Недостаточно средств: нужно ${formatLargeNumber(clickPower.cost)} ₽, есть ${formatLargeNumber(balance)} ₽`,
      )
      return false
    }

    const newLevel = clickPower.level + 1
    const newCost = calculateUpgradeCost(BASE_COSTS.clickUpgrade, newLevel)
    const newClickValue = calculateClickIncome(newLevel)

    console.log(`[ClickUpgrade] Покупка: уровень ${clickPower.level} → ${newLevel}`)
    console.log(`[ClickUpgrade] Стоимость: ${formatLargeNumber(clickPower.cost)} ₽`)
    console.log(`[ClickUpgrade] Новый доход: ${newClickValue} ₽/клик`)
    console.log(`[ClickUpgrade] След. стоимость: ${formatLargeNumber(newCost)} ₽`)

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

    get().saveProgress()
    return true
  },

  // ============================================
  // ПОКУПКА АПГРЕЙДА СКОРОСТИ РАБОТЫ
  // ============================================

  /**
   * Покупка апгрейда "Скорость работы"
   * GBD v1.1: Каждый уровень = +10% к пассивному доходу
   * Разблокируется на milestone 5
   */
  purchaseWorkSpeedUpgrade: () => {
    const state = get()
    const currentLevel = state.upgrades.workSpeed.level
    const currentCost = state.upgrades.workSpeed.cost

    // ═══ ПРОВЕРКА 1: Разблокирован ли апгрейд ═══
    if (!state.milestonesPurchased.includes(5)) {
      console.warn('[Purchase] 🔒 Апгрейд скорости не разблокирован')
      console.log('  Требуется milestone уровня 5')
      return
    }

    // ═══ ПРОВЕРКА 2: Достаточность средств ═══
    if (state.balance < currentCost) {
      console.warn('[Purchase] 💰 Недостаточно средств для апгрейда скорости')
      console.log(`  Требуется: ${formatLargeNumber(currentCost)}₽`)
      console.log(`  Доступно: ${formatLargeNumber(state.balance)}₽`)
      return
    }

    // ═══ РАСЧЁТЫ ═══
    const newLevel = currentLevel + 1
    const newCost = calculateUpgradeCost(BASE_COSTS.workSpeed, newLevel)
    const newMultiplier = calculateWorkSpeedMultiplier(newLevel)

    // Пересчёт пассивного дохода с новым множителем
    const newPassiveIncome = calculateTotalPassiveIncome(
      state.workers,
      newLevel,
    )

    // ═══ ПРИМЕНЯЕМ ИЗМЕНЕНИЯ ═══
    set((s) => ({
      balance: s.balance - currentCost,
      passiveIncomePerSecond: newPassiveIncome,
      upgrades: {
        ...s.upgrades,
        workSpeed: {
          level: newLevel,
          cost: newCost,
        },
      },
    }))

    console.log(`[Purchase] ✅ Апгрейд скорости → Уровень ${newLevel}`)
    console.log(`  Множитель: ×${newMultiplier.toFixed(1)} (${(newMultiplier * 100).toFixed(0)}%)`)
    console.log(`  Пассивный доход: ${newPassiveIncome.toFixed(2)}₽/сек`)
    console.log(`  След. стоимость: ${formatLargeNumber(newCost)}₽`)
    console.log(`  Баланс: ${formatLargeNumber(state.balance - currentCost)}₽`)

    // Сохраняем прогресс
    get().saveProgress()
  },

  // ============================================
  // НАЙМ РАБОТНИКА
  // ============================================

  /**
   * Наём работника с проверкой лимитов и milestone
   * GBD v1.1: Жёсткие лимиты 3-5-3-2-1
   */
  hireWorker: (workerType: WorkerType) => {
    const state = get()
    const worker = state.workers[workerType]

    if (!worker) {
      console.error(`[Hire] Неизвестный тип работника: ${workerType}`)
      return
    }

    const workerIncome = WORKER_INCOME[workerType]
    const workerLimit = WORKER_LIMITS[workerType]

    // ═══ ПРОВЕРКА 1: Лимит количества ═══
    if (worker.count >= workerLimit) {
      console.warn(`[Hire] 🚫 Достигнут лимит для ${workerType}`)
      console.log(`  Текущее: ${worker.count}/${workerLimit}`)
      console.log(`  Это максимум для данного типа работников`)
      return
    }

    // ═══ ПРОВЕРКА 2: Разблокирован ли работник ═══
    const requiredMilestone: Record<WorkerType, number> = {
      apprentice: 0,
      mechanic: 5,
      master: 10,
      brigadier: 15,
      director: 20,
    }

    const milestone = requiredMilestone[workerType]
    if (milestone > 0 && !state.milestonesPurchased.includes(milestone)) {
      console.warn(`[Hire] 🔒 ${workerType} не разблокирован`)
      console.log(`  Требуется milestone уровня ${milestone}`)
      return
    }

    // ═══ ПРОВЕРКА 3: Достаточность средств ═══
    if (state.balance < worker.cost) {
      console.warn(`[Hire] 💰 Недостаточно средств для найма ${workerType}`)
      console.log(`  Требуется: ${formatLargeNumber(worker.cost)}₽`)
      console.log(`  Доступно: ${formatLargeNumber(state.balance)}₽`)
      return
    }

    // ═══ РАСЧЁТЫ ═══
    const newCount = worker.count + 1
    const newCost = calculateWorkerCost(
      BASE_COSTS[workerType as keyof typeof BASE_COSTS] as number,
      newCount,
    )

    // Пересчёт пассивного дохода
    const workersAfterHire = {
      ...state.workers,
      [workerType]: { count: newCount, cost: newCost },
    }
    const newPassiveIncome = calculateTotalPassiveIncome(
      workersAfterHire,
      state.upgrades.workSpeed.level,
    )

    // ═══ ПРИМЕНЯЕМ ИЗМЕНЕНИЯ ═══
    set((s) => ({
      balance: s.balance - worker.cost,
      passiveIncomePerSecond: newPassiveIncome,
      workers: {
        ...s.workers,
        [workerType]: {
          count: newCount,
          cost: newCost,
        },
      },
    }))

    console.log(`[Hire] ✅ Нанят ${workerType} #${newCount}`)
    console.log(`  Доход: ${workerIncome}₽/сек`)
    console.log(`  Общий пассив: ${newPassiveIncome.toFixed(2)}₽/сек`)
    console.log(`  След. стоимость: ${formatLargeNumber(newCost)}₽`)
    console.log(`  Осталось слотов: ${workerLimit - newCount}/${workerLimit}`)
    console.log(`  Баланс: ${formatLargeNumber(state.balance - worker.cost)}₽`)

    // Сохраняем прогресс
    get().saveProgress()
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
        const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
        const result: Partial<GameState> = {
          balance: newBalance,
          totalEarned: parseFloat((state.totalEarned + passiveIncomePerSecond).toFixed(2)),
        }
        if (newLevel !== state.garageLevel) {
          result.garageLevel = newLevel
        }
        return result
      })

      // Проверяем milestone после каждого тика пассивного дохода
      get().checkForMilestone()
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
        brigadier: { count: state.workers.brigadier.count, cost: state.workers.brigadier.cost },
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

    // --- Восстанавливаем работников (GBD v1.1: упрощённая структура) ---
    // SaveData хранит count и cost. baseCost/income/limit берём из констант.
    // Backward compat: foreman → brigadier, manager — удалён.

    const savedWorkers = saveData.workers as unknown as Record<string, { count?: number; cost?: number }>

    // Backward compat: если в сейве есть foreman (старое имя) → используем для brigadier
    const savedBrigadier = savedWorkers.brigadier ?? savedWorkers.foreman

    const restoredWorkers: WorkersState = {
      apprentice: {
        count: saveData.workers.apprentice.count,
        cost: saveData.workers.apprentice.cost,
      },
      mechanic: {
        count: shouldResetMechanics ? 0 : (mechanicSaveData?.count ?? 0),
        cost: shouldResetMechanics
          ? BASE_COSTS.mechanic
          : (mechanicSaveData?.cost ?? BASE_COSTS.mechanic),
      },
      master: {
        count: savedWorkers.master?.count ?? 0,
        cost: savedWorkers.master?.cost ?? BASE_COSTS.master,
      },
      brigadier: {
        count: savedBrigadier?.count ?? 0,
        cost: savedBrigadier?.cost ?? BASE_COSTS.brigadier,
      },
      director: {
        count: savedWorkers.director?.count ?? 0,
        cost: savedWorkers.director?.cost ?? BASE_COSTS.director,
      },
    }

    // --- Восстанавливаем апгрейды ---

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

    const passiveIncome = calculateTotalPassiveIncome(
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
    // clickValue = level + 1 (GBD v1.1)

    const restoredClickValue = calculateClickIncome(restoredUpgrades.clickPower.level)

    // --- Авто-левелинг: пересчитываем уровень гаража из баланса ---
    // Баланс — источник истины для визуальной прогрессии

    const autoLevel = checkAutoLevel(saveData.playerData.balance, 1, restoredPurchased)

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
      const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
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

    // Проверяем milestone после начисления оффлайн-дохода
    get().checkForMilestone()
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

    set((state) => {
      const newBalance = state.balance - upgrade.cost
      const newPurchased = [...state.milestonesPurchased, level]
      // Уровень прыгает минимум до milestone, затем checkAutoLevel продолжает
      const baseLevel = Math.max(state.garageLevel, level)
      const newLevel = checkAutoLevel(newBalance, baseLevel, newPurchased)
      return {
        balance: newBalance,
        milestonesPurchased: newPurchased,
        garageLevel: newLevel,
        showMilestoneModal: false,
        pendingMilestoneLevel: null,
        milestoneModalDismissed: false,  // Сброс для следующего milestone
      }
    })

    console.log(
      `[Milestone] Куплен апгрейд уровня ${level}: разблокирован ${upgrade.workerNames.join(', ')}`,
    )
    return true
  },

  checkForMilestone: () => {
    const state = get()
    // Не показываем если модалка уже открыта или была закрыта игроком
    if (state.showMilestoneModal || state.milestoneModalDismissed) return

    for (const level of MILESTONE_LEVELS) {
      if (!state.milestonesPurchased.includes(level)) {
        // Проверяем по балансу, а не по garageLevel:
        // уровень стоит ПЕРЕД milestone, но баланс уже достаточен
        const threshold = GARAGE_LEVEL_THRESHOLDS[level]
        if (threshold !== undefined && state.balance >= threshold) {
          set({ showMilestoneModal: true, pendingMilestoneLevel: level })
        }
        // Первый непокупленный milestone найден — дальше не проверяем
        return
      }
    }
  },

  closeMilestoneModal: () => {
    set({
      showMilestoneModal: false,
      pendingMilestoneLevel: null,
      milestoneModalDismissed: true,  // Не показывать до покупки milestone
    })
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

/** Информация о milestone, доступном для покупки (null = нет доступных).
 *  Используется в UpgradesPanel для карточки milestone и в App.tsx для прогресс-бара. */
export const usePendingMilestoneInfo = () =>
  useGameStore(
    useShallow((s) => {
      for (const level of MILESTONE_LEVELS) {
        if (!s.milestonesPurchased.includes(level)) {
          const threshold = GARAGE_LEVEL_THRESHOLDS[level]
          if (threshold !== undefined && s.balance >= threshold) {
            return { level, upgrade: MILESTONE_UPGRADES[level] }
          }
          return null // Первый непокупленный milestone, баланс не дотянул
        }
      }
      return null // Все milestones куплены
    })
  )

// ============================================
// СЕЛЕКТОРЫ СКОРОСТИ РАБОТЫ
// ============================================

/** Действие: купить апгрейд скорости */
export const usePurchaseWorkSpeedUpgrade = () =>
  useGameStore((s) => s.purchaseWorkSpeedUpgrade)

/** Текущий уровень апгрейда скорости работы */
export const useWorkSpeedLevel = () =>
  useGameStore((s) => s.upgrades.workSpeed.level)

/** Текущий множитель скорости работы (1.0 + level × 0.1) */
export const useWorkSpeedMultiplier = () =>
  useGameStore((s) => {
    const level = s.upgrades.workSpeed.level
    return calculateWorkSpeedMultiplier(level)
  })
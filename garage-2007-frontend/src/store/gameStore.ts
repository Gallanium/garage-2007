import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  saveGameFull,
  loadGame,
  calculateOfflineEarnings,
  clearSave,
  SAVE_VERSION,
} from '../utils/storageService'
import { roundCurrency } from '../utils/math'

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

/** Максимальный уровень улучшения клика */
export const CLICK_UPGRADE_MAX_LEVEL = 200

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

// ============================================
// СИСТЕМА ДОСТИЖЕНИЙ (GDD v3.0 раздел 2.7)
// ============================================

/** Категории достижений */
export type AchievementCategory =
  | 'progression'   // Прогрессия гаража
  | 'earnings'      // Накопления
  | 'clicks'        // Клики
  | 'workers'       // Работники
  | 'special'       // Особые задачи

/** ID достижений (уникальные идентификаторы) */
export type AchievementId =
  // Прогрессия (5 шт)
  | 'garage_level_2'
  | 'garage_level_5'
  | 'garage_level_10'
  | 'garage_level_15'
  | 'garage_level_20'
  // Накопления (3 шт)
  | 'earned_10k'
  | 'earned_1m'
  | 'earned_1b'
  // Клики (3 шт)
  | 'clicks_100'
  | 'clicks_1000'
  | 'clicks_10000'
  // Работники (3 шт)
  | 'workers_1'
  | 'workers_5'
  | 'workers_10'
  // Особые (1 шт)
  | 'all_milestones'

/** Определение достижения */
export interface AchievementDefinition {
  id: AchievementId
  category: AchievementCategory
  title: string
  description: string
  icon: string
  targetValue: number
  nutsReward: number
  /** Функция проверки прогресса (возвращает текущее значение) */
  progressGetter: (state: GameState) => number
}

/** Состояние достижения у игрока */
export interface PlayerAchievement {
  /** Разблокировано ли достижение */
  unlocked: boolean
  /** Забрана ли награда */
  claimed: boolean
  /** Timestamp разблокировки (для статистики) */
  unlockedAt?: number
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
  /** Уровень milestone, модалку которого игрок закрыл без покупки (null = не закрывал) */
  dismissedMilestoneLevel: number | null
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

  // --- Моментальный доход от кликов (сессионные данные, не сохраняются) ---

  /** Моментальный доход от кликов (₽/сек, обновляется каждую секунду) */
  momentaryClickIncome: number
  /** Внутренний аккумулятор дохода от кликов за текущую секунду */
  _clickIncomeThisTick: number

  // --- Статистика (сохраняется) ---

  /** Рекорд моментального дохода от кликов (₽/сек) — личный рекорд */
  peakClickIncome: number
  /** Общее время в игре (секунды) — накапливается каждую секунду */
  totalPlayTimeSeconds: number

  /** Состояние всех достижений игрока */
  achievements: Record<AchievementId, PlayerAchievement>

  /** Флаг «новое достижение разблокировано» (для UI анимации) */
  hasNewAchievements: boolean

  /** Состояние ежедневных наград */
  dailyRewards: DailyRewardsState

  /** Показывать ли модалку Daily Rewards */
  showDailyRewardsModal: boolean
}

/**
 * Интерфейс действий (actions).
 * Методы для изменения состояния игры.
 */
interface GameActions {
  /** Обработчик клика по гаражу. Возвращает true при критическом клике */
  handleClick: () => boolean

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

  // --- Система достижений ---

  /** Проверяет все достижения и разблокирует выполненные */
  checkAchievements: () => AchievementId[]

  /** Забрать награду за достижение */
  claimAchievement: (achievementId: AchievementId) => boolean

  /** Сбросить флаг «новое достижение» */
  clearNewAchievementsFlag: () => void

  // --- Ежедневные награды ---

  /** Проверяет доступность ежедневной награды (вызывается при загрузке) */
  checkDailyReward: () => void

  /** Забрать ежедневную награду */
  claimDailyReward: () => void

  /** Закрыть модалку Daily Rewards (отложить) */
  closeDailyRewardsModal: () => void

  /** Открыть модалку Daily Rewards вручную (кнопка на экране) */
  openDailyRewardsModal: () => void
}

/** Полный тип хранилища */
type GameStore = GameState & GameActions

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// roundCurrency импортирована из ../utils/math

/**
 * Подсчитывает общее количество нанятых работников всех типов.
 * Используется для достижений «Наймите N работников».
 */
export function getTotalWorkerCount(workers: WorkersState): number {
  return (
    workers.apprentice.count +
    workers.mechanic.count +
    workers.master.count +
    workers.brigadier.count +
    workers.director.count
  )
}

// ============================================
// КАТАЛОГ ДОСТИЖЕНИЙ (GDD v3.0)
// ============================================

/**
 * Каталог всех достижений игры (GDD v3.0)
 * 15 достижений для MVP, награды 5-100 гаек
 * Итого можно заработать: 500 гаек
 */
export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  // ═════════════════════════════════════════
  // ПРОГРЕССИЯ ГАРАЖА (5 достижений, 205 гаек)
  // ═════════════════════════════════════════

  garage_level_2: {
    id: 'garage_level_2',
    category: 'progression',
    title: 'Первые шаги',
    description: 'Достигните 2 уровня гаража',
    icon: '🏗️',
    targetValue: 2,
    nutsReward: 5,
    progressGetter: (state) => state.garageLevel,
  },

  garage_level_5: {
    id: 'garage_level_5',
    category: 'progression',
    title: 'Любительская мастерская',
    description: 'Достигните 5 уровня гаража',
    icon: '🔧',
    targetValue: 5,
    nutsReward: 20,
    progressGetter: (state) => state.garageLevel,
  },

  garage_level_10: {
    id: 'garage_level_10',
    category: 'progression',
    title: 'Профессионал',
    description: 'Достигните 10 уровня гаража',
    icon: '⚙️',
    targetValue: 10,
    nutsReward: 50,
    progressGetter: (state) => state.garageLevel,
  },

  garage_level_15: {
    id: 'garage_level_15',
    category: 'progression',
    title: 'Элитный сервис',
    description: 'Достигните 15 уровня гаража',
    icon: '🏢',
    targetValue: 15,
    nutsReward: 80,
    progressGetter: (state) => state.garageLevel,
  },

  garage_level_20: {
    id: 'garage_level_20',
    category: 'progression',
    title: 'Автомобильная империя',
    description: 'Достигните 20 уровня гаража',
    icon: '👑',
    targetValue: 20,
    nutsReward: 50,
    progressGetter: (state) => state.garageLevel,
  },

  // ═════════════════════════════════════════
  // НАКОПЛЕНИЯ (3 достижения, 75 гаек)
  // ═════════════════════════════════════════

  earned_10k: {
    id: 'earned_10k',
    category: 'earnings',
    title: 'Первые деньги',
    description: 'Заработайте 10,000₽',
    icon: '💵',
    targetValue: 10_000,
    nutsReward: 10,
    progressGetter: (state) => state.totalEarned,
  },

  earned_1m: {
    id: 'earned_1m',
    category: 'earnings',
    title: 'Миллионер',
    description: 'Заработайте 1,000,000₽',
    icon: '💰',
    targetValue: 1_000_000,
    nutsReward: 25,
    progressGetter: (state) => state.totalEarned,
  },

  earned_1b: {
    id: 'earned_1b',
    category: 'earnings',
    title: 'Миллиардер',
    description: 'Заработайте 1,000,000,000₽',
    icon: '💎',
    targetValue: 1_000_000_000,
    nutsReward: 40,
    progressGetter: (state) => state.totalEarned,
  },

  // ═════════════════════════════════════════
  // КЛИКИ (3 достижения, 60 гаек)
  // ═════════════════════════════════════════

  clicks_100: {
    id: 'clicks_100',
    category: 'clicks',
    title: 'Кликер-новичок',
    description: 'Совершите 100 кликов',
    icon: '👆',
    targetValue: 100,
    nutsReward: 10,
    progressGetter: (state) => state.totalClicks,
  },

  clicks_1000: {
    id: 'clicks_1000',
    category: 'clicks',
    title: 'Кликер-мастер',
    description: 'Совершите 1,000 кликов',
    icon: '🖱️',
    targetValue: 1_000,
    nutsReward: 20,
    progressGetter: (state) => state.totalClicks,
  },

  clicks_10000: {
    id: 'clicks_10000',
    category: 'clicks',
    title: 'Кликер-легенда',
    description: 'Совершите 10,000 кликов',
    icon: '⚡',
    targetValue: 10_000,
    nutsReward: 30,
    progressGetter: (state) => state.totalClicks,
  },

  // ═════════════════════════════════════════
  // РАБОТНИКИ (3 достижения, 60 гаек)
  // ═════════════════════════════════════════

  workers_1: {
    id: 'workers_1',
    category: 'workers',
    title: 'Первый сотрудник',
    description: 'Наймите первого работника',
    icon: '👷',
    targetValue: 1,
    nutsReward: 10,
    progressGetter: (state) => getTotalWorkerCount(state.workers),
  },

  workers_5: {
    id: 'workers_5',
    category: 'workers',
    title: 'Маленькая команда',
    description: 'Наймите 5 работников',
    icon: '👥',
    targetValue: 5,
    nutsReward: 20,
    progressGetter: (state) => getTotalWorkerCount(state.workers),
  },

  workers_10: {
    id: 'workers_10',
    category: 'workers',
    title: 'Большая команда',
    description: 'Наймите 10 работников',
    icon: '👨‍👩‍👧‍👦',
    targetValue: 10,
    nutsReward: 30,
    progressGetter: (state) => getTotalWorkerCount(state.workers),
  },

  // ═════════════════════════════════════════
  // ОСОБЫЕ (1 достижение, 100 гаек)
  // ═════════════════════════════════════════

  all_milestones: {
    id: 'all_milestones',
    category: 'special',
    title: 'Покоритель вершин',
    description: 'Купите все доступные апгрейды',
    icon: '🏆',
    targetValue: 4, // Всего 4 milestone (5, 10, 15, 20)
    nutsReward: 100,
    progressGetter: (state) => state.milestonesPurchased.length,
  },
} as const

/**
 * Общее количество гаек из достижений
 */
export const TOTAL_ACHIEVEMENT_NUTS =
  Object.values(ACHIEVEMENTS).reduce((sum, ach) => sum + ach.nutsReward, 0) // 500 гаек

// ============================================
// ЕЖЕДНЕВНЫЙ ВХОД (GDD v3.0)
// ============================================

/** Состояние ежедневных наград */
export interface DailyRewardsState {
  /** Timestamp последнего забора награды (мс) */
  lastClaimTimestamp: number
  /** Текущая серия (streak) дней */
  currentStreak: number
  /** Какие дни забраны в текущем цикле [1,2,3...] */
  claimedDays: number[]
}

/** Награды за каждый день (гайки) */
export const DAILY_REWARDS = [
  5,   // День 1
  5,   // День 2
  5,   // День 3
  5,   // День 4
  5,   // День 5
  5,   // День 6
  50,  // День 7 (БОНУС!)
] as const

/** Общее количество гаек за полный цикл */
export const DAILY_REWARDS_TOTAL = DAILY_REWARDS.reduce((sum, r) => sum + r, 0) // 80 гаек

/** Период streak: 24 часа в миллисекундах */
const DAILY_STREAK_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

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
  return roundCurrency(baseIncome * multiplier)
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
  dismissedMilestoneLevel: null,

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

  // Моментальный доход от кликов
  momentaryClickIncome: 0,
  _clickIncomeThisTick: 0,

  // Статистика
  peakClickIncome: 0,
  totalPlayTimeSeconds: 0,

  // Достижения
  achievements: Object.keys(ACHIEVEMENTS).reduce((acc, id) => {
    acc[id as AchievementId] = { unlocked: false, claimed: false }
    return acc
  }, {} as Record<AchievementId, PlayerAchievement>),
  hasNewAchievements: false,

  // Ежедневные награды
  dailyRewards: {
    lastClaimTimestamp: 0,
    currentStreak: 0,
    claimedDays: [],
  },
  showDailyRewardsModal: false,
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
    const { clickValue, garageLevel: prevLevel } = get()
    const isCritical = Math.random() < CRITICAL_CLICK_CHANCE
    const income = isCritical ? clickValue * CRITICAL_CLICK_MULTIPLIER : clickValue

    set((state) => {
      const newBalance = state.balance + income
      const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalClicks: state.totalClicks + 1,
        totalEarned: state.totalEarned + income,
        _clickIncomeThisTick: state._clickIncomeThisTick + income,
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

    // Немедленное сохранение при повышении уровня
    if (get().garageLevel !== prevLevel) {
      get().saveProgress()
    }

    // Проверяем достижения после клика
    get().checkAchievements()

    return isCritical
  },

  // ============================================
  // ПОКУПКА АПГРЕЙДА КЛИКА
  // ============================================

  purchaseClickUpgrade: () => {
    const { balance, upgrades } = get()
    const { clickPower } = upgrades

    if (clickPower.level >= CLICK_UPGRADE_MAX_LEVEL) {
      console.warn(`[ClickUpgrade] Достигнут максимальный уровень: ${CLICK_UPGRADE_MAX_LEVEL}`)
      return false
    }

    if (balance < clickPower.cost) {
      console.warn(
        `[ClickUpgrade] Недостаточно средств: нужно ${formatLargeNumber(clickPower.cost)} ₽, есть ${formatLargeNumber(balance)} ₽`,
      )
      return false
    }

    const newLevel = clickPower.level + 1
    const newCost = calculateUpgradeCost(BASE_COSTS.clickUpgrade, newLevel)
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
      console.warn('[Purchase] 🔒 Апгрейд скорости не разблокирован (milestone 5)')
      return
    }

    // ═══ ПРОВЕРКА 2: Достаточность средств ═══
    if (state.balance < currentCost) {
      console.warn(`[Purchase] 💰 Недостаточно средств: нужно ${formatLargeNumber(currentCost)}₽, есть ${formatLargeNumber(state.balance)}₽`)
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
          ...s.upgrades.workSpeed,  // сохраняет baseCost
          level: newLevel,
          cost: newCost,
        },
      },
    }))

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
      console.warn(`[Hire] 🚫 Достигнут лимит для ${workerType}: ${worker.count}/${workerLimit}`)
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
      console.warn(`[Hire] 🔒 ${workerType} не разблокирован (milestone ${milestone})`)
      return
    }

    // ═══ ПРОВЕРКА 3: Достаточность средств ═══
    if (state.balance < worker.cost) {
      console.warn(`[Hire] 💰 Недостаточно средств для найма ${workerType}: нужно ${formatLargeNumber(worker.cost)}₽, есть ${formatLargeNumber(state.balance)}₽`)
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

    // Сохраняем прогресс
    get().saveProgress()

    // Проверяем достижения после найма
    get().checkAchievements()
  },

  // ============================================
  // ПАССИВНЫЙ ДОХОД
  // ============================================

  startPassiveIncome: () => {
    let tickCount = 0

    const intervalId = setInterval(() => {
      tickCount++
      const { passiveIncomePerSecond, garageLevel: prevLevel } = get()

      set((state) => {
        const result: Partial<GameState> = {
          // Ротация моментального дохода от кликов (каждую секунду)
          momentaryClickIncome: state._clickIncomeThisTick,
          _clickIncomeThisTick: 0,
          // Рекорд моментального дохода (личный рекорд)
          peakClickIncome: Math.max(state.peakClickIncome, state._clickIncomeThisTick),
          // Время в игре +1 сек
          totalPlayTimeSeconds: state.totalPlayTimeSeconds + 1,
        }

        // Пассивный доход (если есть работники)
        if (passiveIncomePerSecond > 0) {
          const newBalance = roundCurrency(state.balance + passiveIncomePerSecond)
          const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
          result.balance = newBalance
          result.totalEarned = roundCurrency(state.totalEarned + passiveIncomePerSecond)
          if (newLevel !== state.garageLevel) {
            result.garageLevel = newLevel
          }
        }

        return result
      })

      // Проверяем milestone после тика пассивного дохода
      if (passiveIncomePerSecond > 0) {
        get().checkForMilestone()
      }

      // Немедленное сохранение при повышении уровня
      if (get().garageLevel !== prevLevel) {
        get().saveProgress()
      }

      // Проверяем достижения каждые 60 секунд (не каждый тик)
      if (tickCount % 60 === 0) {
        get().checkAchievements()
      }
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

    const success = saveGameFull({
      version: SAVE_VERSION,
      timestamp: 0, // перезаписывается внутри saveGameFull
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
        peakClickIncome: state.peakClickIncome,
        totalPlayTimeSeconds: state.totalPlayTimeSeconds,
      },
      achievements: state.achievements as Record<string, { unlocked: boolean; claimed: boolean; unlockedAt?: number }>,
      dailyRewards: state.dailyRewards,
    })

    if (!success) {
      console.error('[Save] Ошибка сохранения')
    }
  },

  // ============================================
  // ЗАГРУЗКА ПРОГРЕССА
  // ============================================

  loadProgress: () => {
    const saveData = loadGame()

    if (!saveData) {
      set({
        isLoaded: true,
        sessionCount: 1,
        lastSessionDate: new Date().toISOString(),
      })
      return
    }

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

    // --- Восстанавливаем clickValue из уровня апгрейда ---
    // clickValue = level + 1 (GBD v1.1)

    const restoredClickValue = calculateClickIncome(restoredUpgrades.clickPower.level)

    // --- Авто-левелинг: пересчитываем уровень гаража из баланса ---
    // Баланс — источник истины для визуальной прогрессии

    const autoLevel = checkAutoLevel(saveData.playerData.balance, 1, restoredPurchased)

    // --- Восстанавливаем достижения ---
    // Backward compat: в старых сейвах поля нет → {}
    // Мерджим с initialState.achievements, чтобы новые достижения получили дефолтные значения
    const savedAchievements = (saveData.achievements ?? {}) as Record<string, PlayerAchievement>
    const restoredAchievements: Record<AchievementId, PlayerAchievement> = {
      ...initialState.achievements,
    }
    for (const key of Object.keys(savedAchievements)) {
      if (key in restoredAchievements) {
        restoredAchievements[key as AchievementId] = savedAchievements[key]
      }
    }

    // --- Восстанавливаем ежедневные награды ---
    // Backward compat: в старых сейвах поля нет → используем initialState
    const restoredDailyRewards = saveData.dailyRewards ?? initialState.dailyRewards

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
      peakClickIncome: saveData.stats.peakClickIncome ?? 0,
      totalPlayTimeSeconds: saveData.stats.totalPlayTimeSeconds ?? 0,
      achievements: restoredAchievements,
      dailyRewards: restoredDailyRewards,
    })

    // --- Оффлайн-доход НЕ начисляем здесь ---
    // Начисление происходит в App.tsx при нажатии «Забрать» (handleWelcomeBackClose).
    // Сумма сохранена в lastOfflineEarnings для отображения в модалке.

    // --- Проверяем milestone после загрузки ---
    get().checkForMilestone()

    // --- Проверяем достижения после загрузки ---
    get().checkAchievements()

    // --- Проверяем ежедневную награду после загрузки ---
    get().checkDailyReward()
  },

  // ============================================
  // ОФФЛАЙН-ДОХОД
  // ============================================

  addOfflineEarnings: (amount: number) => {
    set((state) => {
      const newBalance = roundCurrency(state.balance + amount)
      const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalEarned: roundCurrency(state.totalEarned + amount),
      }
      if (newLevel !== state.garageLevel) {
        result.garageLevel = newLevel
      }
      return result
    })

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
        dismissedMilestoneLevel: null,  // Сброс для следующего milestone
      }
    })

    get().saveProgress()

    // Проверяем достижения после покупки milestone
    get().checkAchievements()
    return true
  },

  checkForMilestone: () => {
    const state = get()
    // Не показываем если модалка уже открыта
    if (state.showMilestoneModal) return

    for (const level of MILESTONE_LEVELS) {
      if (!state.milestonesPurchased.includes(level)) {
        // Этот конкретный milestone был закрыт без покупки — не спамим
        if (state.dismissedMilestoneLevel === level) return

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
    set((s) => ({
      showMilestoneModal: false,
      dismissedMilestoneLevel: s.pendingMilestoneLevel,  // Запоминаем КАКОЙ milestone закрыт
      pendingMilestoneLevel: null,
    }))
  },

  // ============================================
  // СИСТЕМА ДОСТИЖЕНИЙ
  // ============================================

  /**
   * Проверяет все достижения и разблокирует выполненные.
   * Вызывается после каждого значимого действия игрока.
   *
   * @returns Массив ID новых разблокированных достижений
   */
  checkAchievements: () => {
    const state = get()
    const newlyUnlocked: AchievementId[] = []

    for (const [id, definition] of Object.entries(ACHIEVEMENTS)) {
      const achievementId = id as AchievementId
      const playerAch = state.achievements[achievementId]

      // Пропускаем уже разблокированные
      if (playerAch.unlocked) continue

      // Проверяем прогресс
      const currentProgress = definition.progressGetter(state)

      if (currentProgress >= definition.targetValue) {
        newlyUnlocked.push(achievementId)
        console.log(`[Achievement] 🏆 Разблокировано: "${definition.title}"`)
        console.log(`  Награда: ${definition.nutsReward} гаек`)
      }
    }

    // Применяем разблокировки
    if (newlyUnlocked.length > 0) {
      set((state) => {
        const updatedAchievements = { ...state.achievements }

        for (const id of newlyUnlocked) {
          updatedAchievements[id] = {
            ...updatedAchievements[id],
            unlocked: true,
            unlockedAt: Date.now(),
          }
        }

        return {
          achievements: updatedAchievements,
          hasNewAchievements: true,
        }
      })

      console.log(`[Achievement] 🎉 Разблокировано достижений: ${newlyUnlocked.length}`)
      get().saveProgress()
    }

    return newlyUnlocked
  },

  /**
   * Забрать награду за достижение.
   *
   * @param achievementId - ID достижения
   * @returns true если награда забрана успешно
   */
  claimAchievement: (achievementId: AchievementId) => {
    const state = get()
    const playerAch = state.achievements[achievementId]
    const definition = ACHIEVEMENTS[achievementId]

    if (!definition) {
      console.error(`[Achievement] Неизвестное достижение: ${achievementId}`)
      return false
    }

    if (!playerAch.unlocked) {
      console.warn(`[Achievement] Достижение "${definition.title}" ещё не разблокировано`)
      return false
    }

    if (playerAch.claimed) {
      console.warn(`[Achievement] Награда за "${definition.title}" уже забрана`)
      return false
    }

    // Начисляем гайки
    set((state) => ({
      nuts: state.nuts + definition.nutsReward,
      achievements: {
        ...state.achievements,
        [achievementId]: {
          ...state.achievements[achievementId],
          claimed: true,
        },
      },
    }))

    console.log(`[Achievement] ✅ Забрана награда: ${definition.nutsReward} гаек`)
    console.log(`  "${definition.title}"`)
    console.log(`  Баланс гаек: ${get().nuts}`)

    get().saveProgress()
    return true
  },

  /** Сбросить флаг «новое достижение» */
  clearNewAchievementsFlag: () => {
    set({ hasNewAchievements: false })
  },

  // ============================================
  // ЕЖЕДНЕВНЫЕ НАГРАДЫ
  // ============================================

  /**
   * Проверяет доступность ежедневной награды.
   * Вызывается при загрузке игры (loadProgress).
   */
  checkDailyReward: () => {
    const state = get()
    const now = Date.now()
    const timeSinceLastClaim = now - state.dailyRewards.lastClaimTimestamp

    // Первый запуск — награда всегда доступна
    if (state.dailyRewards.lastClaimTimestamp === 0) {
      set({ showDailyRewardsModal: true })
      return
    }

    // Прошло меньше 24 часов — награда уже забрана сегодня
    if (timeSinceLastClaim < DAILY_STREAK_GRACE_PERIOD_MS) {
      console.log('[Daily] Награда уже забрана сегодня')
      return
    }

    // Прошло больше 48 часов — сброс streak
    if (timeSinceLastClaim > DAILY_STREAK_GRACE_PERIOD_MS * 2) {
      console.log('[Daily] Streak сброшен (пропущен день)')
      set({
        dailyRewards: {
          lastClaimTimestamp: 0,
          currentStreak: 0,
          claimedDays: [],
        },
        showDailyRewardsModal: true,
      })
      return
    }

    // 24–48 часов — можно забрать награду
    set({ showDailyRewardsModal: true })
  },

  /**
   * Забрать ежедневную награду.
   * Начисляет гайки, обновляет streak и закрывает модалку.
   */
  claimDailyReward: () => {
    const state = get()
    const now = Date.now()

    // Вычисляем следующий день
    const nextDay = state.dailyRewards.currentStreak + 1

    // День 8 = сброс на день 1 (новый цикл)
    const dayIndex = nextDay > 7 ? 1 : nextDay
    const reward = DAILY_REWARDS[dayIndex - 1]

    const newStreak = nextDay > 7 ? 1 : nextDay
    const newClaimedDays = nextDay > 7 ? [1] : [...state.dailyRewards.claimedDays, dayIndex]

    set((s) => ({
      nuts: s.nuts + reward,
      dailyRewards: {
        lastClaimTimestamp: now,
        currentStreak: newStreak,
        claimedDays: newClaimedDays,
      },
      showDailyRewardsModal: false,
    }))

    console.log(`[Daily] ✅ Забрана награда за день ${dayIndex}: ${reward} гаек`)
    console.log(`[Daily] Streak: ${newStreak}/7`)

    get().saveProgress()
  },

  /**
   * Закрыть модалку Daily Rewards без забора (отложить).
   */
  closeDailyRewardsModal: () => {
    set({ showDailyRewardsModal: false })
  },

  openDailyRewardsModal: () => {
    set({ showDailyRewardsModal: true })
  },

  // ============================================
  // СБРОС
  // ============================================

  resetGame: () => {
    clearSave()
    set({ ...initialState, isLoaded: true })
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
export const useMomentaryClickIncome = () => useGameStore((s) => s.momentaryClickIncome)
export const useUpgrades = () => useGameStore((s) => s.upgrades)
export const useWorkers = () => useGameStore((s) => s.workers)
export const useNuts = () => useGameStore((s) => s.nuts)
export const useTotalEarned = () => useGameStore((s) => s.totalEarned)
export const useIsLoaded = () => useGameStore((s) => s.isLoaded)
export const useSessionCount = () => useGameStore((s) => s.sessionCount)
export const useLastOfflineEarnings = () => useGameStore((s) => s.lastOfflineEarnings)
export const useLastOfflineTimeAway = () => useGameStore((s) => s.lastOfflineTimeAway)
export const usePeakClickIncome = () => useGameStore((s) => s.peakClickIncome)
export const useTotalPlayTime = () => useGameStore((s) => s.totalPlayTimeSeconds)

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

// ============================================
// СЕЛЕКТОРЫ ДОСТИЖЕНИЙ
// ============================================

export const useAchievements = () => useGameStore((s) => s.achievements)
export const useHasNewAchievements = () => useGameStore((s) => s.hasNewAchievements)
export const useClaimAchievement = () => useGameStore((s) => s.claimAchievement)
export const useClearNewAchievementsFlag = () => useGameStore((s) => s.clearNewAchievementsFlag)
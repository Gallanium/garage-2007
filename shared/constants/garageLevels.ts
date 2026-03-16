// shared/constants/garageLevels.ts
import type { WorkerType } from '../types/game.js'

export const GARAGE_LEVEL_THRESHOLDS: Record<number, number> = {
  1:  0,
  2:  10_000,
  3:  50_000,
  4:  200_000,
  5:  1_000_000,
  6:  5_000_000,
  7:  25_000_000,
  8:  100_000_000,
  9:  300_000_000,
  10: 1_000_000_000,
  11: 5_000_000_000,
  12: 25_000_000_000,
  13: 100_000_000_000,
  14: 300_000_000_000,
  15: 1_000_000_000_000,
  16: 5_000_000_000_000,
  17: 25_000_000_000_000,
  18: 100_000_000_000_000,
  19: 300_000_000_000_000,
  20: 1_000_000_000_000_000,
} as const

export const GARAGE_LEVEL_NAMES = {
  1:  'Ржавая ракушка',
  2:  'Начало пути',
  3:  'Базовый ремонт',
  4:  'Мастерская',
  5:  'Гараж механика',
  6:  'Расширение',
  7:  'Специализация',
  8:  'Растущий бизнес',
  9:  'Автосервис',
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
} as const

export const MILESTONE_LEVELS = [5, 10, 15, 20] as const
export type MilestoneLevel = typeof MILESTONE_LEVELS[number]

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
      upgrades: ['Энергетики (+10% к доходу работников)', '🚀 Буст «Турбо-доход» (×2 доход, 60 мин)'],
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
      upgrades: ['🚀 Буст «Нитро-ускорение» (×3 доход, 30 мин)'],
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

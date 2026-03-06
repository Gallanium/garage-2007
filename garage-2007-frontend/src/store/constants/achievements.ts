// src/store/constants/achievements.ts
import type { AchievementId, AchievementDefinition, WorkersState, GameState } from '../types'

export function getTotalWorkerCount(workers: WorkersState): number {
  return (
    workers.apprentice.count +
    workers.mechanic.count +
    workers.master.count +
    workers.brigadier.count +
    workers.director.count
  )
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  garage_level_2:  { id: 'garage_level_2',  category: 'progression', title: 'Первые шаги',          description: 'Достигните 2 уровня гаража',          icon: '🏗️', targetValue: 2,           nutsReward: 5,   progressGetter: (s: GameState) => s.garageLevel },
  garage_level_5:  { id: 'garage_level_5',  category: 'progression', title: 'Любительская мастерская', description: 'Достигните 5 уровня гаража',          icon: '🔧', targetValue: 5,           nutsReward: 20,  progressGetter: (s: GameState) => s.garageLevel },
  garage_level_10: { id: 'garage_level_10', category: 'progression', title: 'Профессионал',           description: 'Достигните 10 уровня гаража',         icon: '⚙️', targetValue: 10,          nutsReward: 50,  progressGetter: (s: GameState) => s.garageLevel },
  garage_level_15: { id: 'garage_level_15', category: 'progression', title: 'Элитный сервис',         description: 'Достигните 15 уровня гаража',         icon: '🏢', targetValue: 15,          nutsReward: 80,  progressGetter: (s: GameState) => s.garageLevel },
  garage_level_20: { id: 'garage_level_20', category: 'progression', title: 'Автомобильная империя',  description: 'Достигните 20 уровня гаража',         icon: '👑', targetValue: 20,          nutsReward: 50,  progressGetter: (s: GameState) => s.garageLevel },
  earned_10k:      { id: 'earned_10k',      category: 'earnings',    title: 'Первые деньги',          description: 'Заработайте 10,000₽',                 icon: '💵', targetValue: 10_000,       nutsReward: 10,  progressGetter: (s: GameState) => s.totalEarned },
  earned_1m:       { id: 'earned_1m',       category: 'earnings',    title: 'Миллионер',              description: 'Заработайте 1,000,000₽',              icon: '💰', targetValue: 1_000_000,    nutsReward: 25,  progressGetter: (s: GameState) => s.totalEarned },
  earned_1b:       { id: 'earned_1b',       category: 'earnings',    title: 'Миллиардер',             description: 'Заработайте 1,000,000,000₽',          icon: '💎', targetValue: 1_000_000_000, nutsReward: 40,  progressGetter: (s: GameState) => s.totalEarned },
  clicks_100:      { id: 'clicks_100',      category: 'clicks',      title: 'Кликер-новичок',         description: 'Совершите 100 кликов',                icon: '👆', targetValue: 100,          nutsReward: 10,  progressGetter: (s: GameState) => s.totalClicks },
  clicks_1000:     { id: 'clicks_1000',     category: 'clicks',      title: 'Кликер-мастер',          description: 'Совершите 1,000 кликов',              icon: '🖱️', targetValue: 1_000,         nutsReward: 20,  progressGetter: (s: GameState) => s.totalClicks },
  clicks_10000:    { id: 'clicks_10000',    category: 'clicks',      title: 'Кликер-легенда',         description: 'Совершите 10,000 кликов',             icon: '⚡', targetValue: 10_000,       nutsReward: 30,  progressGetter: (s: GameState) => s.totalClicks },
  workers_1:       { id: 'workers_1',       category: 'workers',     title: 'Первый сотрудник',       description: 'Наймите первого работника',           icon: '👷', targetValue: 1,            nutsReward: 10,  progressGetter: (s: GameState) => getTotalWorkerCount(s.workers) },
  workers_5:       { id: 'workers_5',       category: 'workers',     title: 'Маленькая команда',      description: 'Наймите 5 работников',               icon: '👥', targetValue: 5,            nutsReward: 20,  progressGetter: (s: GameState) => getTotalWorkerCount(s.workers) },
  workers_10:      { id: 'workers_10',      category: 'workers',     title: 'Большая команда',        description: 'Наймите 10 работников',              icon: '👨‍👩‍👧‍👦', targetValue: 10,           nutsReward: 30,  progressGetter: (s: GameState) => getTotalWorkerCount(s.workers) },
  all_milestones:  { id: 'all_milestones',  category: 'special',     title: 'Покоритель вершин',      description: 'Купите все доступные апгрейды',      icon: '🏆', targetValue: 4,            nutsReward: 100, progressGetter: (s: GameState) => s.milestonesPurchased.length },
} as const

export const TOTAL_ACHIEVEMENT_NUTS =
  Object.values(ACHIEVEMENTS).reduce((sum, a) => sum + a.nutsReward, 0)

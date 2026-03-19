// shared/constants/achievements.ts
// Achievements use progressField (string mapping) instead of closures for FE+BE compatibility.
import type { AchievementId, AchievementDefinition, WorkersState } from '../types/game.js'

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
  garage_level_2:  { id: 'garage_level_2',  category: 'progression', title: 'Первые шаги',          description: 'Достигните 2 уровня гаража',          icon: '🏗️', targetValue: 2,           nutsReward: 5,   progressField: 'garageLevel' },
  garage_level_5:  { id: 'garage_level_5',  category: 'progression', title: 'Любительская мастерская', description: 'Достигните 5 уровня гаража',          icon: '🔧', targetValue: 5,           nutsReward: 20,  progressField: 'garageLevel' },
  garage_level_10: { id: 'garage_level_10', category: 'progression', title: 'Профессионал',           description: 'Достигните 10 уровня гаража',         icon: '⚙️', targetValue: 10,          nutsReward: 50,  progressField: 'garageLevel' },
  garage_level_15: { id: 'garage_level_15', category: 'progression', title: 'Элитный сервис',         description: 'Достигните 15 уровня гаража',         icon: '🏢', targetValue: 15,          nutsReward: 80,  progressField: 'garageLevel' },
  garage_level_20: { id: 'garage_level_20', category: 'progression', title: 'Автомобильная империя',  description: 'Достигните 20 уровня гаража',         icon: '👑', targetValue: 20,          nutsReward: 50,  progressField: 'garageLevel' },
  earned_10k:      { id: 'earned_10k',      category: 'earnings',    title: 'Первые деньги',          description: 'Заработайте 10,000₽',                 icon: '💵', targetValue: 10_000,       nutsReward: 10,  progressField: 'totalEarned' },
  earned_1m:       { id: 'earned_1m',       category: 'earnings',    title: 'Миллионер',              description: 'Заработайте 1,000,000₽',              icon: '💰', targetValue: 1_000_000,    nutsReward: 25,  progressField: 'totalEarned' },
  earned_1b:       { id: 'earned_1b',       category: 'earnings',    title: 'Миллиардер',             description: 'Заработайте 1,000,000,000₽',          icon: '💎', targetValue: 1_000_000_000, nutsReward: 40,  progressField: 'totalEarned' },
  clicks_100:      { id: 'clicks_100',      category: 'clicks',      title: 'Кликер-новичок',         description: 'Совершите 100 кликов',                icon: '👆', targetValue: 100,          nutsReward: 10,  progressField: 'totalClicks' },
  clicks_1000:     { id: 'clicks_1000',     category: 'clicks',      title: 'Кликер-мастер',          description: 'Совершите 1,000 кликов',              icon: '🖱️', targetValue: 1_000,         nutsReward: 20,  progressField: 'totalClicks' },
  clicks_10000:    { id: 'clicks_10000',    category: 'clicks',      title: 'Кликер-легенда',         description: 'Совершите 10,000 кликов',             icon: '⚡', targetValue: 10_000,       nutsReward: 30,  progressField: 'totalClicks' },
  workers_1:       { id: 'workers_1',       category: 'workers',     title: 'Первый сотрудник',       description: 'Наймите первого работника',           icon: '👷', targetValue: 1,            nutsReward: 10,  progressField: 'totalWorkerCount' },
  workers_5:       { id: 'workers_5',       category: 'workers',     title: 'Маленькая команда',      description: 'Наймите 5 работников',               icon: '👥', targetValue: 5,            nutsReward: 20,  progressField: 'totalWorkerCount' },
  workers_10:      { id: 'workers_10',      category: 'workers',     title: 'Большая команда',        description: 'Наймите 10 работников',              icon: '👨‍👩‍👧‍👦', targetValue: 10,           nutsReward: 30,  progressField: 'totalWorkerCount' },
  all_milestones:  { id: 'all_milestones',  category: 'special',     title: 'Покоритель вершин',      description: 'Купите все доступные апгрейды',      icon: '🏆', targetValue: 4,            nutsReward: 100, progressField: 'milestonesCount' },
} as const

export const TOTAL_ACHIEVEMENT_NUTS =
  Object.values(ACHIEVEMENTS).reduce((sum, a) => sum + a.nutsReward, 0)

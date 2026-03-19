// src/store/constants/achievements.ts — re-exports from shared + progress resolver
export { getTotalWorkerCount, ACHIEVEMENTS, TOTAL_ACHIEVEMENT_NUTS } from '@shared/constants/achievements.ts'

import type { GameState, AchievementProgressField } from '@shared/types/game.ts'
import { getTotalWorkerCount } from '@shared/constants/achievements.ts'

/** Resolve a progressField to the actual numeric value from GameState */
export function getAchievementProgress(state: GameState, field: AchievementProgressField): number {
  switch (field) {
    case 'garageLevel': return state.garageLevel
    case 'totalEarned': return state.totalEarned
    case 'totalClicks': return state.totalClicks
    case 'totalWorkerCount': return getTotalWorkerCount(state.workers)
    case 'milestonesCount': return state.milestonesPurchased.length
  }
}

// src/store/gameStore.ts
// Thin assembler: creates the Zustand store from slices and re-exports
// everything that components import from this path.
import { create } from 'zustand'
import type { GameStore } from './types'
import { initialState } from './initialState'
import { createClickSlice }         from './actions/clickActions'
import { createUpgradeSlice }       from './actions/upgradeActions'
import { createWorkerSlice }        from './actions/workerActions'
import { createMilestoneSlice }     from './actions/milestoneActions'
import { createAchievementSlice }   from './actions/achievementActions'
import { createDailyRewardSlice }   from './actions/dailyRewardActions'
import { createRewardedVideoSlice } from './actions/rewardedVideoActions'
import { createBoostSlice }        from './actions/boostActions'
import { createPersistenceSlice }   from './actions/persistenceActions'

export const useGameStore = create<GameStore>((...a) => ({
  ...initialState,
  ...createClickSlice(...a),
  ...createUpgradeSlice(...a),
  ...createWorkerSlice(...a),
  ...createMilestoneSlice(...a),
  ...createAchievementSlice(...a),
  ...createDailyRewardSlice(...a),
  ...createRewardedVideoSlice(...a),
  ...createPersistenceSlice(...a),
  ...createBoostSlice(...a),
}))

// ── Re-exports so components keep importing from '../store/gameStore' ─────────
export * from './selectors'
export * from './types'
export * from './constants/economy'
export * from './constants/garageLevels'
export * from './constants/achievements'
export * from './constants/dailyRewards'
export * from './constants/boosts'
export * from './formulas/progression'
export * from './initialState'

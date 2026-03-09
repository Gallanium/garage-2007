// src/store/actions/milestoneActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { MILESTONE_LEVELS, MILESTONE_UPGRADES, GARAGE_LEVEL_THRESHOLDS } from '../constants/garageLevels'
import type { MilestoneLevel } from '../constants/garageLevels'
import { checkAutoLevel } from '../formulas/progression'

type Slice = Pick<GameStore, 'purchaseMilestone' | 'checkForMilestone' | 'closeMilestoneModal'>

export const createMilestoneSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseMilestone: (level: number) => {
    const { balance, milestonesPurchased } = get()
    const upgrade = MILESTONE_UPGRADES[level as MilestoneLevel]
    if (!upgrade) { console.warn(`[Milestone] Неизвестный уровень: ${level}`); return false }
    if (milestonesPurchased.includes(level)) { console.warn(`[Milestone] Уровень ${level} уже куплен`); return false }
    if (balance < upgrade.cost) { console.warn(`[Milestone] Недостаточно средств`); return false }

    _set((s: GameState) => {
      const newBalance = s.balance - upgrade.cost
      const newPurchased = [...s.milestonesPurchased, level]
      const baseLevel = Math.max(s.garageLevel, level)
      return {
        balance: newBalance,
        milestonesPurchased: newPurchased,
        garageLevel: checkAutoLevel(newBalance, baseLevel, newPurchased),
        showMilestoneModal: false,
        pendingMilestoneLevel: null,
        _milestoneDismissedAt: 0,
      }
    })

    get().saveProgress()
    get().checkAchievements()
    return true
  },

  checkForMilestone: () => {
    const state = get()
    if (state.showMilestoneModal) return
    // 5-second cooldown after dismissal
    if (state._milestoneDismissedAt > 0 && Date.now() - state._milestoneDismissedAt < 5_000) return
    for (const level of MILESTONE_LEVELS) {
      if (!state.milestonesPurchased.includes(level)) {
        const threshold = GARAGE_LEVEL_THRESHOLDS[level]
        if (threshold !== undefined && state.balance >= threshold) {
          _set({ showMilestoneModal: true, pendingMilestoneLevel: level })
        }
        return
      }
    }
  },

  closeMilestoneModal: () => {
    _set({
      showMilestoneModal: false,
      pendingMilestoneLevel: null,
      _milestoneDismissedAt: Date.now(),
    })
  },
})

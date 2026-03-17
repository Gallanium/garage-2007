// src/store/actions/clickActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { CRITICAL_CLICK_CHANCE, CRITICAL_CLICK_MULTIPLIER } from '../constants/economy'
import { checkAutoLevel } from '../formulas/progression'

type Slice = Pick<GameStore, 'handleClick'>

export const createClickSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  handleClick: () => {
    const { clickValue, garageLevel: prevLevel } = get()
    const isCritical = Math.random() < CRITICAL_CLICK_CHANCE
    const boostMultiplier = get().getActiveMultiplier('click')
    const eventMultiplier = get().getEventMultiplier('click')
    const income = (isCritical ? clickValue * CRITICAL_CLICK_MULTIPLIER : clickValue) * boostMultiplier * eventMultiplier

    _set((state: GameState) => {
      const newBalance = state.balance + income
      const newLevel = checkAutoLevel(newBalance, state.garageLevel, state.milestonesPurchased)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalClicks: state.totalClicks + 1,
        totalEarned: state.totalEarned + income,
        _clickIncomeThisTick: state._clickIncomeThisTick + income,
      }
      if (newLevel !== state.garageLevel) result.garageLevel = newLevel
      return result
    })

    get().checkForMilestone()
    if (get().garageLevel !== prevLevel) get().saveProgress()
    get().checkAchievements()
    _set((s) => ({ _clicksSinceLastSync: (s._clicksSinceLastSync ?? 0) + 1 }))
    return isCritical
  },
})

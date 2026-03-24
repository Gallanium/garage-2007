// src/store/actions/milestoneActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { MILESTONE_LEVELS, MILESTONE_UPGRADES, GARAGE_LEVEL_THRESHOLDS } from '../constants/garageLevels'
import type { MilestoneLevel } from '../constants/garageLevels'
import { checkAutoLevel } from '../formulas/progression'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'purchaseMilestone' | 'checkForMilestone' | 'closeMilestoneModal'>

// Concurrency guard — prevent double-fire from mobile tap events
let _milestonePending = false

export const createMilestoneSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseMilestone: async (level: number) => {
    if (_milestonePending) return false
    _milestonePending = true
    try {
    const state = get()
    const { balance, milestonesPurchased } = state
    const upgrade = MILESTONE_UPGRADES[level as MilestoneLevel]
    if (!upgrade) { if (import.meta.env.DEV) console.warn(`[Milestone] Неизвестный уровень: ${level}`); return false }
    if (milestonesPurchased.includes(level)) { if (import.meta.env.DEV) console.warn(`[Milestone] Уровень ${level} уже куплен`); return false }
    if (balance < upgrade.cost) { if (import.meta.env.DEV) console.warn(`[Milestone] Недостаточно средств`); return false }

    if (!api.isOnline()) {
      console.warn('[Milestone] Cannot purchase: not connected to server')
      return false
    }

    if (api.isActionThrottled()) {
      if (import.meta.env.DEV) console.warn('[Milestone] Client-side rate limit reached, try again later')
      return false
    }

    // Flush pending clicks so backend has accurate balance
    if ((get()._pendingClickBuffer ?? []).length > 0) {
      const flushOk = await get().flushPendingClicks()
      if (!flushOk) {
        get().showToast('Ошибка синхронизации, попробуйте снова', 'error')
        return false
      }
    }
    // Re-validate balance after flush
    if (get().balance < upgrade.cost) {
      if (import.meta.env.DEV) console.warn('[Milestone] Insufficient balance after sync')
      return false
    }

    const stateAfterFlush = get()

    // Optimistic + rollback: ruble action
    const snapshot = {
      balance: stateAfterFlush.balance,
      milestonesPurchased: [...stateAfterFlush.milestonesPurchased],
      garageLevel: stateAfterFlush.garageLevel,
      showMilestoneModal: stateAfterFlush.showMilestoneModal,
      pendingMilestoneLevel: stateAfterFlush.pendingMilestoneLevel,
      _milestoneDismissedAt: stateAfterFlush._milestoneDismissedAt,
    }

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

    const r = await api.performAction('purchase_milestone', { level })
    if (!r) {
      // Rollback on network failure (server unreachable)
      _set(snapshot)
      get().saveProgress()
      console.warn(`[Milestone] Server rejected purchase_milestone (level ${level}) — rolled back`)
      get().showToast('Ошибка покупки улучшения гаража', 'error')
      return false
    }
    if (r.gameState) {
      get().applyServerState(r.gameState)
    }
    return true
    } finally { _milestonePending = false }
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

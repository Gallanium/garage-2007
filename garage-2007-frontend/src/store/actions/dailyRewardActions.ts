// src/store/actions/dailyRewardActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'
import { DAILY_STREAK_GRACE_PERIOD_MS } from '../constants/dailyRewards'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore,
  'checkDailyReward' | 'claimDailyReward' | 'closeDailyRewardsModal' | 'openDailyRewardsModal'>

export const createDailyRewardSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  checkDailyReward: () => {
    const state = get()
    const now = Date.now()
    const elapsed = now - state.dailyRewards.lastClaimTimestamp

    if (state.dailyRewards.lastClaimTimestamp === 0) {
      _set({ showDailyRewardsModal: true })
      return
    }
    if (elapsed < DAILY_STREAK_GRACE_PERIOD_MS) {
      if (import.meta.env.DEV) console.log('[Daily] Награда уже забрана сегодня')
      return
    }
    if (elapsed >= DAILY_STREAK_GRACE_PERIOD_MS * 2) {
      if (import.meta.env.DEV) console.log('[Daily] Streak сброшен')
      _set({ dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 }, showDailyRewardsModal: true })
      return
    }
    _set({ showDailyRewardsModal: true })
  },

  claimDailyReward: async () => {
    const state = get()
    const now = Date.now()
    if (
      state.dailyRewards.lastClaimTimestamp !== 0 &&
      now - state.dailyRewards.lastClaimTimestamp < DAILY_STREAK_GRACE_PERIOD_MS
    ) {
      const h = Math.ceil((DAILY_STREAK_GRACE_PERIOD_MS - (now - state.dailyRewards.lastClaimTimestamp)) / 3600000)
      if (import.meta.env.DEV) console.warn(`[Daily] Следующая через ${h} ч`)
      return
    }

    // Server-first: premium action (nuts). No optimistic mutation.
    if (!api.isOnline()) {
      console.warn('[Daily] Cannot claim: not connected to server')
      // TODO: show user-facing error toast
      return
    }

    const r = await api.performAction('claim_daily_reward', {})
    if (r?.gameState) {
      get().applyServerState(r.gameState)
    } else {
      console.warn('[Daily] Server rejected claim_daily_reward')
      // TODO: show user-facing error toast
    }
  },

  closeDailyRewardsModal: () => _set({ showDailyRewardsModal: false }),
  openDailyRewardsModal:  () => _set({ showDailyRewardsModal: true }),
})

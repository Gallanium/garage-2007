// src/store/actions/dailyRewardActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS } from '../constants/dailyRewards'

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
      console.log('[Daily] Награда уже забрана сегодня')
      return
    }
    if (elapsed >= DAILY_STREAK_GRACE_PERIOD_MS * 2) {
      console.log('[Daily] Streak сброшен')
      _set({ dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 }, showDailyRewardsModal: true })
      return
    }
    _set({ showDailyRewardsModal: true })
  },

  claimDailyReward: () => {
    const state = get()
    const now = Date.now()
    if (
      state.dailyRewards.lastClaimTimestamp !== 0 &&
      now - state.dailyRewards.lastClaimTimestamp < DAILY_STREAK_GRACE_PERIOD_MS
    ) {
      const h = Math.ceil((DAILY_STREAK_GRACE_PERIOD_MS - (now - state.dailyRewards.lastClaimTimestamp)) / 3600000)
      console.warn(`[Daily] ⛔ Следующая через ${h} ч`)
      return
    }
    const reward = DAILY_REWARDS[state.dailyRewards.currentStreak % 7]
    const newStreak = state.dailyRewards.currentStreak + 1
    _set((s: GameState) => ({
      nuts: s.nuts + reward,
      dailyRewards: { lastClaimTimestamp: now, currentStreak: newStreak },
      bestStreak: Math.max(s.bestStreak, newStreak),
    }))
    get().saveProgress()
  },

  closeDailyRewardsModal: () => _set({ showDailyRewardsModal: false }),
  openDailyRewardsModal:  () => _set({ showDailyRewardsModal: true }),
})

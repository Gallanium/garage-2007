// src/store/actions/rewardedVideoActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import {
  REWARDED_VIDEO_NUTS,
  REWARDED_VIDEO_COOLDOWN_MS,
  REWARDED_VIDEO_FAKE_DURATION_MS,
} from '../constants/dailyRewards'

type Slice = Pick<GameStore, 'canWatchRewardedVideo' | 'watchRewardedVideo'>

export const createRewardedVideoSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  canWatchRewardedVideo: () => {
    const { rewardedVideo } = get()
    return rewardedVideo.lastWatchedTimestamp === 0 ||
           Date.now() - rewardedVideo.lastWatchedTimestamp >= REWARDED_VIDEO_COOLDOWN_MS
  },

  watchRewardedVideo: async () => {
    const state = get()
    if (!state.canWatchRewardedVideo()) { console.warn('[RewardedVideo] Cooldown'); return false }
    if (state.rewardedVideo.isWatching) { console.warn('[RewardedVideo] Уже идёт'); return false }

    _set((s: GameState) => ({ rewardedVideo: { ...s.rewardedVideo, isWatching: true } }))
    await new Promise((resolve) => setTimeout(resolve, REWARDED_VIDEO_FAKE_DURATION_MS))

    const now = Date.now()
    _set((s: GameState) => ({
      nuts: s.nuts + REWARDED_VIDEO_NUTS,
      rewardedVideo: { lastWatchedTimestamp: now, totalWatches: s.rewardedVideo.totalWatches + 1, isWatching: false },
    }))
    get().saveProgress()
    return true
  },
})

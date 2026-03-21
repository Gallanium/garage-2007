// src/store/actions/rewardedVideoActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import {
  REWARDED_VIDEO_COOLDOWN_MS,
  REWARDED_VIDEO_FAKE_DURATION_MS,
} from '../constants/dailyRewards'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'canWatchRewardedVideo' | 'watchRewardedVideo'>

export const createRewardedVideoSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  canWatchRewardedVideo: () => {
    const { rewardedVideo } = get()
    return rewardedVideo.lastWatchedTimestamp === 0 ||
           Date.now() - rewardedVideo.lastWatchedTimestamp >= REWARDED_VIDEO_COOLDOWN_MS
  },

  watchRewardedVideo: async () => {
    const state = get()
    if (!state.canWatchRewardedVideo()) { if (import.meta.env.DEV) console.warn('[RewardedVideo] Cooldown'); return false }
    if (state.rewardedVideo.isWatching) { if (import.meta.env.DEV) console.warn('[RewardedVideo] Уже идёт'); return false }

    // Server-first: premium action (nuts). No optimistic mutation.
    if (!api.isOnline()) {
      console.warn('[RewardedVideo] Cannot watch: not connected to server')
      // TODO: show user-facing error toast
      return false
    }

    _set((s: GameState) => ({ rewardedVideo: { ...s.rewardedVideo, isWatching: true } }))
    await new Promise((resolve) => setTimeout(resolve, REWARDED_VIDEO_FAKE_DURATION_MS))

    const r = await api.performAction('watch_rewarded_video', {})
    _set((s: GameState) => ({ rewardedVideo: { ...s.rewardedVideo, isWatching: false } }))

    if (r?.gameState) {
      get().applyServerState(r.gameState)
      return true
    }
    console.warn('[RewardedVideo] Server rejected watch_rewarded_video')
    // TODO: show user-facing error toast
    return false
  },
})

// src/store/actions/achievementActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState, AchievementId } from '../types'
import { ACHIEVEMENTS, getAchievementProgress } from '../constants/achievements'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'checkAchievements' | 'claimAchievement' | 'clearNewAchievementsFlag'>

export const createAchievementSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  checkAchievements: () => {
    const state = get()
    const newlyUnlocked: AchievementId[] = []

    for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
      const aid = id as AchievementId
      if (state.achievements[aid].unlocked) continue
      if (getAchievementProgress(state, def.progressField) >= def.targetValue) {
        newlyUnlocked.push(aid)
        if (import.meta.env.DEV) console.log(`[Achievement] 🏆 Разблокировано: "${def.title}"`)
      }
    }

    if (newlyUnlocked.length > 0) {
      _set((s: GameState) => {
        const updated = { ...s.achievements }
        for (const id of newlyUnlocked) {
          updated[id] = { ...updated[id], unlocked: true, unlockedAt: Date.now() }
        }
        return { achievements: updated, hasNewAchievements: true }
      })
      get().saveProgress()
    }

    return newlyUnlocked
  },

  claimAchievement: async (achievementId: AchievementId) => {
    const state = get()
    const playerAch = state.achievements[achievementId]
    const def = ACHIEVEMENTS[achievementId]
    if (!def) { console.error(`[Achievement] Неизвестное: ${achievementId}`); return false }
    if (!playerAch.unlocked) { if (import.meta.env.DEV) console.warn(`[Achievement] Не разблокировано`); return false }
    if (playerAch.claimed)   { if (import.meta.env.DEV) console.warn(`[Achievement] Уже забрано`); return false }

    // Server-first: premium action (nuts). No optimistic mutation.
    if (!api.isOnline()) {
      console.warn('[Achievement] Cannot claim: not connected to server')
      // TODO: show user-facing error toast
      return false
    }

    const r = await api.performAction('claim_achievement', { achievementId })
    if (r?.gameState) {
      get().applyServerState(r.gameState)
      return true
    }
    console.warn('[Achievement] Server rejected claim_achievement')
    // TODO: show user-facing error toast
    return false
  },

  clearNewAchievementsFlag: () => _set({ hasNewAchievements: false }),
})

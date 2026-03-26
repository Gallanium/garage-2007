import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'fetchLeagueStatus' | 'fetchLeaderboard'>

export const createLeagueSlice: StateCreator<GameStore, [], [], Slice> = (set) => ({
  fetchLeagueStatus: async () => {
    set({ leagueLoading: true })
    const result = await api.getLeagueStatus()
    set({
      leagueStatus: result ?? null,
      leagueLoading: false,
    })
  },

  fetchLeaderboard: async () => {
    set({ leagueLoading: true })
    const result = await api.getLeaderboard()
    set({
      leaderboard: result ?? null,
      leagueLoading: false,
    })
  },
})

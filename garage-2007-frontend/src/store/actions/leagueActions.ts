import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'fetchLeagueStatus' | 'fetchLeaderboard'>

let _statusInFlight = false
let _leaderboardInFlight = false
let _lastFetchTime = 0

/** Minimum interval between league data refreshes (ms) */
const FETCH_COOLDOWN_MS = 15_000

export const createLeagueSlice: StateCreator<GameStore, [], [], Slice> = (set, get) => ({
  fetchLeagueStatus: async () => {
    const now = Date.now()
    if (_statusInFlight || (now - _lastFetchTime < FETCH_COOLDOWN_MS && get().leagueStatus)) return
    _statusInFlight = true
    _lastFetchTime = now
    set({ leagueLoading: true })
    try {
      const result = await api.getLeagueStatus()
      // Keep cached data on null response (e.g. rate-limited 429)
      if (result) {
        set({ leagueStatus: result, leagueLoading: false })
      } else {
        set({ leagueLoading: false })
      }
    } catch {
      set({ leagueLoading: false })
      get().showToast('Ошибка загрузки данных лиги', 'error')
    } finally {
      _statusInFlight = false
    }
  },

  fetchLeaderboard: async () => {
    if (_leaderboardInFlight || (Date.now() - _lastFetchTime < FETCH_COOLDOWN_MS && get().leaderboard)) return
    _leaderboardInFlight = true
    set({ leagueLoading: true })
    try {
      const result = await api.getLeaderboard()
      // Keep cached data on null response (e.g. rate-limited 429)
      if (result) {
        set({ leaderboard: result, leagueLoading: false })
      } else {
        set({ leagueLoading: false })
      }
    } catch {
      set({ leagueLoading: false })
    } finally {
      _leaderboardInFlight = false
    }
  },
})

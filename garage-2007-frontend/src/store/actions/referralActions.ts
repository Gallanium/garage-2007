import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'fetchReferralStatus' | 'generateReferralCode'>

export const createReferralSlice: StateCreator<GameStore, [], [], Slice> = (set) => ({
  fetchReferralStatus: async () => {
    set({ referralLoading: true })
    const result = await api.getReferralStatus()
    set({ referralStatus: result ?? null, referralLoading: false })
  },

  generateReferralCode: async () => {
    const result = await api.generateReferralCode()
    if (result?.code) {
      set(state => ({
        referralStatus: state.referralStatus
          ? { ...state.referralStatus, referralCode: result.code }
          : null,
      }))
      return result.code
    }
    return null
  },
})

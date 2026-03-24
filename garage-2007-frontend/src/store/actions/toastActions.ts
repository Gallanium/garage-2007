// src/store/actions/toastActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, ToastType } from '../types'

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 3000

type Slice = Pick<GameStore, 'showToast' | 'dismissToast'>

export const createToastSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  showToast: (message: string, type: ToastType): void => {
    const id = crypto.randomUUID()
    const toast = { id, message, type, createdAt: Date.now() }

    _set(s => {
      const next = [...s.toasts, toast]
      // Keep only the latest MAX_TOASTS
      return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next }
    })

    // Auto-dismiss
    setTimeout(() => {
      get().dismissToast(id)
    }, AUTO_DISMISS_MS)
  },

  dismissToast: (id: string): void => {
    _set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  },
})

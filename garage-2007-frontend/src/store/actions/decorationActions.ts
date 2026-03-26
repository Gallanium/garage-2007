// src/store/actions/decorationActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'
import { DECORATION_CATALOG } from '../constants/decorations'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'purchaseDecoration' | 'toggleDecoration'>

// Concurrency guard — prevent double-fire from mobile tap events
let _decorationPending = false

export const createDecorationSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseDecoration: async (id: string): Promise<boolean> => {
    if (_decorationPending) return false
    _decorationPending = true
    try {
    const state = get()
    const def = DECORATION_CATALOG[id]
    if (!def) return false
    if (state.decorations.owned.includes(id)) return false
    if (state.garageLevel < def.unlockLevel) return false

    if (def.currency === 'rubles') {
      if (state.balance < def.cost) return false
    } else {
      if (state.nuts < def.cost) return false
    }

    if (!api.isOnline()) {
      console.warn('[Decoration] Cannot purchase: not connected to server')
      get().showToast('Нет подключения к серверу', 'error')
      return false
    }

    if (api.isActionThrottled()) {
      if (import.meta.env.DEV) console.warn('[Decoration] Client-side rate limit reached, try again later')
      return false
    }

    if (def.currency === 'nuts') {
      // Server-first: premium action (nuts). No optimistic mutation.
      const r = await api.performAction('purchase_decoration', { decorationId: id })
      if (r?.gameState) {
        get().applyServerState(r.gameState)
        return true
      }
      console.warn('[Decoration] Server rejected purchase_decoration (nuts)')
      get().showToast('Ошибка покупки декорации', 'error')
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
    if (get().balance < def.cost) {
      if (import.meta.env.DEV) console.warn('[Decoration] Insufficient balance after sync')
      return false
    }

    const stateAfterFlush = get()

    // Optimistic + rollback: ruble action
    // Snapshot for rollback
    const snapshot = {
      balance: stateAfterFlush.balance,
      decorations: { owned: [...stateAfterFlush.decorations.owned], active: [...stateAfterFlush.decorations.active] },
    }

    // Determine which active items occupy the same slot (will be displaced)
    const displaced = stateAfterFlush.decorations.active.filter(activeId => {
      const activeDef = DECORATION_CATALOG[activeId]
      return activeDef && activeDef.slot === def.slot
    })

    _set(s => ({
      balance: s.balance - def.cost,
      decorations: {
        owned: [...s.decorations.owned, id],
        active: [...s.decorations.active.filter(a => !displaced.includes(a)), id],
      },
    }))

    get().saveProgress()
    const r = await api.performAction('purchase_decoration', { decorationId: id })
    if (!r?.gameState) {
      _set(snapshot)
      get().saveProgress()
      console.warn('[Decoration] Server rejected purchase_decoration (rubles) — rolled back')
      get().showToast('Ошибка покупки декорации', 'error')
      return false
    }
    get().applyServerState(r.gameState)
    return true
    } finally { _decorationPending = false }
  },

  toggleDecoration: async (id: string): Promise<boolean> => {
    const state = get()
    if (!state.decorations.owned.includes(id)) return false
    const def = DECORATION_CATALOG[id]
    if (!def) return false

    // Snapshot for rollback
    const snapshot = {
      decorations: {
        owned: [...state.decorations.owned],
        active: [...state.decorations.active],
      },
    }

    if (state.decorations.active.includes(id)) {
      // Deactivate
      _set(s => ({
        decorations: {
          ...s.decorations,
          active: s.decorations.active.filter(a => a !== id),
        },
      }))
    } else {
      // Activate, displace slot conflict
      const displaced = state.decorations.active.filter(activeId => {
        const activeDef = DECORATION_CATALOG[activeId]
        return activeDef && activeDef.slot === def.slot
      })
      _set(s => ({
        decorations: {
          ...s.decorations,
          active: [...s.decorations.active.filter(a => !displaced.includes(a)), id],
        },
      }))
    }

    get().saveProgress()
    if (!api.isOnline()) {
      return true
    }

    try {
      const response = await api.performAction('toggle_decoration', { decorationId: id })
      if (response?.gameState) {
        get().applyServerState(response.gameState)
        return true
      }

      _set({ decorations: snapshot.decorations })
      get().saveProgress()
      get().showToast('Ошибка переключения декорации', 'error')
      return false
    } catch {
        _set({ decorations: snapshot.decorations })
        get().saveProgress()
        get().showToast('Ошибка сети', 'error')
      return false
    }
  },
})

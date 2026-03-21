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

    if (def.currency === 'nuts') {
      // Server-first: premium action (nuts). No optimistic mutation.
      if (!api.isOnline()) {
        console.warn('[Decoration] Cannot purchase (nuts): not connected to server')
        // TODO: show user-facing error toast
        return false
      }

      const r = await api.performAction('purchase_decoration', { decorationId: id })
      if (r?.gameState) {
        get().applyServerState(r.gameState)
        return true
      }
      console.warn('[Decoration] Server rejected purchase_decoration (nuts)')
      // TODO: show user-facing error toast
      return false
    }

    // Optimistic + rollback: ruble action
    // Snapshot for rollback
    const snapshot = {
      balance: state.balance,
      decorations: { owned: [...state.decorations.owned], active: [...state.decorations.active] },
    }

    // Determine which active items occupy the same slot (will be displaced)
    const displaced = state.decorations.active.filter(activeId => {
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
    if (api.isOnline()) {
      const r = await api.performAction('purchase_decoration', { decorationId: id })
      if (!r) {
        // Rollback on network failure (server unreachable)
        _set(snapshot)
        get().saveProgress()
        console.warn('[Decoration] Server rejected purchase_decoration (rubles) — rolled back')
        // TODO: show user-facing error toast
      } else if (r.gameState) {
        get().applyServerState(r.gameState)
      }
    }
    return true
    } finally { _decorationPending = false }
  },

  toggleDecoration: (id: string): void => {
    const state = get()
    if (!state.decorations.owned.includes(id)) return
    const def = DECORATION_CATALOG[id]
    if (!def) return

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
    if (api.isOnline()) {
      api.performAction('toggle_decoration', { decorationId: id }).then(r => {
        if (r?.gameState) get().applyServerState(r.gameState)
      })
    }
  },
})

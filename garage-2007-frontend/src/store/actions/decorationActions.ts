// src/store/actions/decorationActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'
import { DECORATION_CATALOG } from '../constants/decorations'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'purchaseDecoration' | 'toggleDecoration'>

export const createDecorationSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseDecoration: (id: string): boolean => {
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

    // Determine which active items occupy the same slot (will be displaced)
    const displaced = state.decorations.active.filter(activeId => {
      const activeDef = DECORATION_CATALOG[activeId]
      return activeDef && activeDef.slot === def.slot
    })

    _set(s => ({
      ...(def.currency === 'rubles'
        ? { balance: s.balance - def.cost }
        : { nuts: s.nuts - def.cost }),
      decorations: {
        owned: [...s.decorations.owned, id],
        active: [...s.decorations.active.filter(a => !displaced.includes(a)), id],
      },
    }))

    get().saveProgress()
    if (api.isOnline()) {
      api.performAction('purchase_decoration', { decorationId: id }).then(r => {
        if (r?.gameState) get().applyServerState(r.gameState)
      })
    }
    return true
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

// src/store/actions/eventActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore } from '../types'
import {
  GAME_EVENTS,
} from '../constants/events'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore,
  | 'triggerRandomEvent' | 'clearEvent' | 'tickEvents'
  | 'getEventMultiplier' | 'getEventCostMultiplier'
>

export const createEventSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  triggerRandomEvent: (): boolean => {
    const now = Date.now()
    const { events } = get()

    if (now < events.cooldownEnd) return false

    // Server-first: event selection is done entirely on the backend.
    // No local Math.random() calls. Server picks category + event + timing.
    if (!api.isOnline()) return false

    api.performAction('trigger_event', {}).then(r => {
      if (r?.gameState) get().applyServerState(r.gameState)
    })

    return true
  },

  clearEvent: (): void => {
    _set(s => ({ events: { ...s.events, activeEvent: null } }))
  },

  tickEvents: (): void => {
    const { events } = get()
    if (events.activeEvent && events.activeEvent.expiresAt <= Date.now()) {
      get().clearEvent()
    }
  },

  getEventMultiplier: (scope: 'income' | 'click'): number => {
    const { events } = get()
    if (!events.activeEvent) return 1
    if (events.activeEvent.expiresAt <= Date.now()) return 1
    const def = GAME_EVENTS[events.activeEvent.id]
    if (!def || def.effect.scope !== scope) return 1
    return def.effect.multiplier
  },

  getEventCostMultiplier: (): number => {
    const { events } = get()
    if (!events.activeEvent) return 1
    if (events.activeEvent.expiresAt <= Date.now()) return 1
    const def = GAME_EVENTS[events.activeEvent.id]
    if (!def || def.effect.scope !== 'cost') return 1
    return def.effect.multiplier
  },

})

// src/store/actions/eventActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, EventCategory } from '../types'
import {
  GAME_EVENTS,
  EVENT_CATEGORY_WEIGHTS,
  EVENT_COOLDOWN_MS,
  EVENT_RANDOM_DELAY_MS,
} from '../constants/events'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore,
  | 'triggerRandomEvent' | 'clearEvent' | 'tickEvents'
  | 'getEventMultiplier' | 'getEventCostMultiplier'
>

/** Взвешенный случайный выбор категории */
function pickCategory(): EventCategory {
  const total = Object.values(EVENT_CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (const [cat, weight] of Object.entries(EVENT_CATEGORY_WEIGHTS) as [EventCategory, number][]) {
    rand -= weight
    if (rand <= 0) return cat
  }
  return 'neutral'
}

/** Взвешенный случайный выбор события внутри категории */
function pickEventInCategory(category: EventCategory) {
  const candidates = Object.values(GAME_EVENTS).filter(e => e.category === category)
  if (candidates.length === 0) return null
  const total = candidates.reduce((a, e) => a + e.weight, 0)
  let rand = Math.random() * total
  for (const event of candidates) {
    rand -= event.weight
    if (rand <= 0) return event
  }
  return candidates[candidates.length - 1]
}

export const createEventSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  triggerRandomEvent: (): boolean => {
    const now = Date.now()
    const { events } = get()

    if (now < events.cooldownEnd) return false

    const category = pickCategory()
    const eventDef = pickEventInCategory(category)
    if (!eventDef) return false

    const eventSeed = Math.floor(Math.random() * 2_147_483_647)
    const expiresAt = now + eventDef.durationMs
    const nextCooldownEnd = expiresAt + EVENT_COOLDOWN_MS + Math.floor(Math.random() * EVENT_RANDOM_DELAY_MS)

    _set({
      events: {
        activeEvent: { id: eventDef.id, activatedAt: now, expiresAt, eventSeed },
        cooldownEnd: nextCooldownEnd,
      },
    })

    if (api.isOnline()) {
      api.performAction('trigger_event', {}).then(r => {
        if (r?.gameState) get().applyServerState(r.gameState)
      })
    }

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

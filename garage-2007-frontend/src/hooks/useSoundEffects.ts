import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { GAME_EVENTS } from '../store/constants/events'

/**
 * Reactive sound effects — plays sounds when store state changes.
 * Must be called inside a component that has access to playSoundFn.
 */
export function useSoundEffects(playSoundFn: ((key: string) => void) | null) {
  // Track previous values to detect changes
  const prevBoostCount = useRef<number>(-1)
  const prevEventId = useRef<string | null>(null)
  const prevHasNewAchievements = useRef(false)

  const boostCount = useGameStore((s) => s.boosts.active.length)
  const activeEvent = useGameStore((s) => s.events.activeEvent)
  const hasNewAchievements = useGameStore((s) => s.hasNewAchievements)

  // Boost activated
  useEffect(() => {
    if (prevBoostCount.current === -1) {
      // Initial mount — just record, don't play
      prevBoostCount.current = boostCount
      return
    }
    if (boostCount > prevBoostCount.current) {
      playSoundFn?.('boost_activate')
    }
    prevBoostCount.current = boostCount
  }, [boostCount, playSoundFn])

  // Event started (positive or negative)
  useEffect(() => {
    const newId = activeEvent?.id ?? null
    if (prevEventId.current === null && newId === null) {
      // Both null on mount — skip
      return
    }
    if (newId && newId !== prevEventId.current) {
      const def = GAME_EVENTS[newId]
      if (def) {
        playSoundFn?.(def.category === 'positive' ? 'event_positive' : 'event_negative')
      }
    }
    prevEventId.current = newId
  }, [activeEvent, playSoundFn])

  // New achievement unlocked
  useEffect(() => {
    if (!prevHasNewAchievements.current && hasNewAchievements) {
      playSoundFn?.('achievement')
    }
    prevHasNewAchievements.current = hasNewAchievements
  }, [hasNewAchievements, playSoundFn])
}

import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Reactive sound effects — plays sounds when store state changes.
 * Accepts a ref (not value) so it always reads .current at call time,
 * even before Phaser is ready.
 */
export function useSoundEffects(
  playSoundRef: React.RefObject<((key: string) => void) | null>,
) {
  // Track previous values to detect changes
  const prevBoostActivatedAt = useRef<number>(0)
  const prevEventId = useRef<string | null>(null)
  const prevHasNewAchievements = useRef(false)

  const boostActivatedAt = useGameStore((s) => s.boosts.active[0]?.activatedAt ?? 0)
  const activeEvent = useGameStore((s) => s.events.activeEvent)
  const hasNewAchievements = useGameStore((s) => s.hasNewAchievements)
  const clearNewAchievementsFlag = useGameStore((s) => s.clearNewAchievementsFlag)

  // Boost activated or replaced — track by activatedAt timestamp
  useEffect(() => {
    if (prevBoostActivatedAt.current === 0) {
      // Initial mount — just record, don't play
      prevBoostActivatedAt.current = boostActivatedAt
      return
    }
    if (boostActivatedAt > 0 && boostActivatedAt !== prevBoostActivatedAt.current) {
      playSoundRef.current?.('boost_activate')
    }
    prevBoostActivatedAt.current = boostActivatedAt
  }, [boostActivatedAt, playSoundRef])

  // Event started — each event has its own sound key
  useEffect(() => {
    const newId = activeEvent?.id ?? null
    if (prevEventId.current === null && newId === null) {
      // Both null on mount — skip
      return
    }
    if (newId && newId !== prevEventId.current) {
      // Skip sound for stale events on page reload (matches AmbientEventSystem 5s guard)
      const eventAge = Date.now() - (activeEvent?.activatedAt ?? 0)
      if (eventAge <= 5000) {
        playSoundRef.current?.(`event_${newId}`)
      }
    }
    prevEventId.current = newId
  }, [activeEvent, playSoundRef])

  // New achievement unlocked
  useEffect(() => {
    if (!prevHasNewAchievements.current && hasNewAchievements) {
      playSoundRef.current?.('achievement')
      clearNewAchievementsFlag() // consume immediately — guard prevents double-play
    }
    prevHasNewAchievements.current = hasNewAchievements
  }, [hasNewAchievements, playSoundRef, clearNewAchievementsFlag])
}

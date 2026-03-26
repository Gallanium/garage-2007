import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { audioBridge } from '../audio/AudioBridgeService'
import { isAcceptedAudioPlaybackResult } from '../audio/types'
import { EVENT_SFX_KEYS } from '../game/config/audioAssets'

/**
 * Reactive sound effects — plays sounds when store state changes.
 * Uses the bridge service so sounds are queued until Phaser is ready.
 */
export function useSoundEffects() {
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
      audioBridge.play('boost_activate', 'useSoundEffects.boostActivate')
    }
    prevBoostActivatedAt.current = boostActivatedAt
  }, [boostActivatedAt])

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
        const eventSoundKey = EVENT_SFX_KEYS[newId as keyof typeof EVENT_SFX_KEYS]
        if (eventSoundKey) {
          audioBridge.play(eventSoundKey, 'useSoundEffects.eventStart')
        }
      }
    }
    prevEventId.current = newId
  }, [activeEvent])

  // New achievement unlocked
  useEffect(() => {
    if (!prevHasNewAchievements.current && hasNewAchievements) {
      const result = audioBridge.play('achievement', 'useSoundEffects.achievementUnlock')
      if (isAcceptedAudioPlaybackResult(result)) {
        clearNewAchievementsFlag()
      }
    }
    prevHasNewAchievements.current = hasNewAchievements
  }, [hasNewAchievements, clearNewAchievementsFlag])
}

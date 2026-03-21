import { useEffect, useRef, useCallback } from 'react'
import {
  useGameStore,
  useIsLoaded,
  useGarageLevel,
  useBalance,
  useCheckForMilestone,
} from '../store/gameStore'
import { getInitData } from '../services/telegramService'
import * as api from '../services/apiService'

/** Sync interval — 30 seconds */
const SYNC_INTERVAL_MS = 30_000

/** Debounce for localStorage backup saves */
const SAVE_DEBOUNCE_MS = 5_000

/**
 * Game lifecycle hook — server-first, no offline fallback.
 *
 * Flow:
 *   Mount → getInitData() → authenticate() → loadState() → populate store
 *   ↓ (every 30s)
 *   sync(clicksSinceLastSync) → update store from server response
 *   ↓ (on close)
 *   sync(finalClicks) → best-effort + localStorage backup
 *
 * If auth/loadState fails: sets serverError flag → App shows error screen.
 * Clicks do NOT accumulate without authentication.
 */
export function useGameLifecycle(): { retryAuth: () => void } {
  const isLoaded = useIsLoaded()
  const balance = useBalance()
  const garageLevel = useGarageLevel()
  const checkForMilestone = useCheckForMilestone()
  const saveProgress = useGameStore((s) => s.saveProgress)
  const startPassiveIncome = useGameStore((s) => s.startPassiveIncome)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncInFlightRef = useRef(false)

  // Auth + Load function — extracted so it can be retried
  const attemptAuth = useCallback(async () => {
    // Reset error state on retry
    useGameStore.setState({ serverError: false })

    const initData = getInitData()

    if (initData) {
      const authResult = await api.authenticate(initData)
      if (authResult) {
        // Load state from server
        const stateResult = await api.loadState()
        if (stateResult?.gameState) {
          // Apply server state to store
          useGameStore.getState().applyServerState(stateResult.gameState)

          // Show offline earnings if any
          if (stateResult.offlineEarnings && stateResult.offlineEarnings.amount > 0) {
            useGameStore.setState({
              lastOfflineEarnings: stateResult.offlineEarnings.amount,
              lastOfflineTimeAway: stateResult.offlineEarnings.timeAway,
            })
          }
          return
        }
        // New player — server returned null gameState, initial state was created
        if (stateResult && !stateResult.gameState) {
          useGameStore.setState({ isLoaded: true })
          return
        }
      }
    }

    // Server unavailable — set error flag (no localStorage fallback)
    useGameStore.setState({ serverError: true })
  }, [])

  // 1. Auth + Load — server-first, no offline fallback
  useEffect(() => {
    attemptAuth()
  }, [attemptAuth])

  // 2. Passive income tick (client-side for instant UI feedback)
  useEffect(() => {
    const cleanup = startPassiveIncome()
    return cleanup
  }, [startPassiveIncome])

  // 3. Sync loop — every 30s, send accumulated clicks to server
  useEffect(() => {
    if (!isLoaded) return
    if (!api.isOnline()) return

    const syncInterval = setInterval(() => {
      if (syncInFlightRef.current) return
      const buffer = useGameStore.getState()._pendingClickBuffer ?? []
      const clicksToSend = buffer.length
      syncInFlightRef.current = true
      api.sync(clicksToSend).then((result) => {
        // Remove only the clicks we sent (clicks that arrived during
        // the roundtrip stay in the buffer for the next sync)
        useGameStore.setState((s) => ({
          _pendingClickBuffer: s._pendingClickBuffer.slice(clicksToSend),
        }))
        // Then: apply server state — applyServerState compensates for any
        // remaining pending clicks so balance doesn't visually drop
        if (result?.gameState) {
          useGameStore.getState().applyServerState(result.gameState)
        }
      }).finally(() => {
        syncInFlightRef.current = false
      })
    }, SYNC_INTERVAL_MS)

    return () => clearInterval(syncInterval)
  }, [isLoaded])

  // 4. localStorage backup — debounced on balance/level change
  useEffect(() => {
    if (!isLoaded) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      saveProgress()
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [balance, garageLevel, isLoaded, saveProgress])

  // 5. Milestone check on level change
  useEffect(() => {
    if (!isLoaded) return
    checkForMilestone()
  }, [garageLevel, isLoaded, checkForMilestone])

  // 6. Save + sync on tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // localStorage backup
      saveProgress()
      // Best-effort sync with auth header (keepalive ensures delivery on close)
      if (api.isOnline()) {
        const clicks = (useGameStore.getState()._pendingClickBuffer ?? []).length
        const token = api.getToken()
        if (token && clicks > 0) {
          fetch('/api/game/sync', {
            method: 'POST',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              clicksSinceLastSync: clicks,
              clientTimestamp: Date.now(),
              syncNonce: crypto.randomUUID(),
            }),
          }).catch(() => { /* best-effort — ignore errors on close */ })
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveProgress])

  return { retryAuth: attemptAuth }
}

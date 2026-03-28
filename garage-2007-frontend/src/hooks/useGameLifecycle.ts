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
  const authInProgressRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryCooldownRef = useRef(false)

  // Auth + Load function — extracted so it can be retried.
  // Guard prevents concurrent execution (React StrictMode fires effects twice).
  // Exponential backoff on retries to prevent rate-limit death spiral.
  const attemptAuth = useCallback(async () => {
    if (authInProgressRef.current) return
    if (retryCooldownRef.current) return
    authInProgressRef.current = true
    try {
      useGameStore.setState({ serverError: false })

      // If already authenticated (token from a prior call), skip straight to loadState
      if (!api.isOnline()) {
        const initData = getInitData()
        if (!initData) {
          useGameStore.setState({ serverError: true })
          // localStorage fallback for degraded mode
          useGameStore.getState().loadProgress()
          if (useGameStore.getState().isLoaded && useGameStore.getState().balance > 0) {
            useGameStore.setState({ serverError: false, degradedMode: true })
          }
          return
        }
        const authResult = await api.authenticate(initData)
        if (!authResult) {
          // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
          // Prevents spamming /api/auth/telegram → rate-limit death spiral
          retryCountRef.current++
          const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30_000)
          retryCooldownRef.current = true
          setTimeout(() => { retryCooldownRef.current = false }, delay)
          useGameStore.setState({ serverError: true })
          // localStorage fallback for degraded mode
          useGameStore.getState().loadProgress()
          if (useGameStore.getState().isLoaded && useGameStore.getState().balance > 0) {
            useGameStore.setState({ serverError: false, degradedMode: true })
          }
          return
        }
      }

      // Auth succeeded — reset retry counter
      retryCountRef.current = 0

      // Load state from server
      const stateResult = await api.loadState()
      if (stateResult?.gameState) {
        useGameStore.getState().applyServerState(stateResult.gameState)
        useGameStore.setState({ serverError: false, degradedMode: false })

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
        useGameStore.setState({ isLoaded: true, serverError: false, degradedMode: false })
        return
      }

      useGameStore.setState({ serverError: true })
      // localStorage fallback for degraded mode
      useGameStore.getState().loadProgress()
      if (useGameStore.getState().isLoaded && useGameStore.getState().balance > 0) {
        useGameStore.setState({ serverError: false, degradedMode: true })
      }
    } finally {
      authInProgressRef.current = false
    }
  }, [])

  // 1. Auth + Load — server-first, no offline fallback
  useEffect(() => {
    attemptAuth()
  }, [attemptAuth])

  // 2. Passive income tick (client-side for instant UI feedback)
  useEffect(() => {
    if (!isLoaded) return
    const cleanup = startPassiveIncome()
    return cleanup
  }, [isLoaded, startPassiveIncome])

  // 3. Sync loop — every 30s, send accumulated clicks to server
  useEffect(() => {
    if (!isLoaded) return
    if (!api.isOnline()) return

    const syncInterval = setInterval(() => {
      if (useGameStore.getState().degradedMode) return
      useGameStore.getState().flushPendingClicks()
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
      saveProgress()
      if (api.isOnline() && !api.isSyncInFlight()) {
        const buffer = useGameStore.getState()._pendingClickBuffer ?? []
        const token = api.getToken()
        if (token && (buffer.length > 0 || useGameStore.getState().peakClickIncome > 0)) {
          // Aggregate clicks into multiplier buckets
          const bucketMap = new Map<number, { normal: number; critical: number }>()
          for (const click of buffer) {
            const mult = click.multiplier ?? 1
            const entry = bucketMap.get(mult) ?? { normal: 0, critical: 0 }
            if (click.isCritical) entry.critical++
            else entry.normal++
            bucketMap.set(mult, entry)
          }
          const clickBuckets = Array.from(bucketMap.entries()).map(([multiplier, c]) => ({
            multiplier, normalClicks: c.normal, criticalClicks: c.critical,
          }))
          const normalClicks = clickBuckets.reduce((s, b) => s + b.normalClicks, 0)
          const criticalClicks = clickBuckets.reduce((s, b) => s + b.criticalClicks, 0)

          // Clear buffer optimistically — if page actually closes, no double-send.
          // If page stays open, buffer is empty → next sync sends 0 → no duplicate.
          useGameStore.setState({ _pendingClickBuffer: [] })
          fetch(`${api.getApiBase()}/game/sync`, {
            method: 'POST',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              normalClicks,
              criticalClicks,
              clickBuckets,
              clientTimestamp: Date.now(),
              syncNonce: crypto.randomUUID(),
              peakClickIncome: useGameStore.getState().peakClickIncome,
            }),
          }).catch(() => {
            // Restore buffer on failure — page might stay open
            useGameStore.setState(s => ({
              _pendingClickBuffer: [
                ...s._pendingClickBuffer,
                ...buffer,
              ],
            }))
          })
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveProgress])

  return { retryAuth: attemptAuth }
}

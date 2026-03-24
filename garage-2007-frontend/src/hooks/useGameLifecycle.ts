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
          return
        }
      }

      // Auth succeeded — reset retry counter
      retryCountRef.current = 0

      // Load state from server
      const stateResult = await api.loadState()
      if (stateResult?.gameState) {
        useGameStore.getState().applyServerState(stateResult.gameState)
        useGameStore.setState({ serverError: false })

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
        useGameStore.setState({ isLoaded: true, serverError: false })
        return
      }

      useGameStore.setState({ serverError: true })
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
    const cleanup = startPassiveIncome()
    return cleanup
  }, [startPassiveIncome])

  // 3. Sync loop — every 30s, send accumulated clicks to server
  useEffect(() => {
    if (!isLoaded) return
    if (!api.isOnline()) return

    const syncInterval = setInterval(() => {
      const buffer = useGameStore.getState()._pendingClickBuffer ?? []
      const clicksToSend = buffer.length
      const normalClicks = buffer.filter(c => !c.isCritical).length
      const criticalClicks = buffer.filter(c => c.isCritical).length
      api.syncWithLock(normalClicks, criticalClicks).then((result) => {
        if (result?.gameState) {
          // Remove only the clicks we sent after the server acknowledged them.
          // Clicks that arrived during the roundtrip stay in the buffer.
          useGameStore.setState((s) => ({
            _pendingClickBuffer: s._pendingClickBuffer.slice(clicksToSend),
          }))

          // Then: apply server state — applyServerState compensates for any
          // remaining pending clicks so balance doesn't visually drop.
          useGameStore.getState().applyServerState(result.gameState)
          return
        }

        // Don't set serverError from sync loop — let attemptAuth handle recovery.
        // Setting serverError here caused a cascade: any transient token loss
        // (e.g., failed re-auth after page reload) immediately showed the error
        // screen, even when the JWT was still valid for other calls.
        if (!api.isOnline()) {
          if (import.meta.env.DEV) console.warn('[Sync] Token lost — skipping sync, auth will recover')
        }
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
        const buffer = useGameStore.getState()._pendingClickBuffer ?? []
        const token = api.getToken()
        if (token && buffer.length > 0) {
          const normalClicks = buffer.filter(c => !c.isCritical).length
          const criticalClicks = buffer.filter(c => c.isCritical).length
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

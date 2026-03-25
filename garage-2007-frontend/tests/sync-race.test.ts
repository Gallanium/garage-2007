import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGameStore } from '../src/store/gameStore'
import { initialState } from '../src/store/initialState'
import * as api from '../src/services/apiService'
import { buildMockServerState } from './setup'

const mockSyncWithLock = vi.mocked(api.syncWithLock)

describe('sync race condition', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState, isLoaded: true })
    mockSyncWithLock.mockReset()
  })

  it('flushPendingClicks does not lose clicks when called concurrently', async () => {
    // Fill buffer with 10 clicks
    useGameStore.setState({
      _pendingClickBuffer: Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() - i * 100,
        isCritical: false,
        multiplier: 1,
      })),
    })

    // Make syncWithLock return a delayed response so we can test concurrency
    mockSyncWithLock.mockImplementation(async () => {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 10))
      return { gameState: buildMockServerState({ balance: 100 }), serverTime: Date.now() }
    })

    // Call flushPendingClicks twice concurrently
    const flush1 = useGameStore.getState().flushPendingClicks()
    const flush2 = useGameStore.getState().flushPendingClicks()

    await Promise.all([flush1, flush2])

    // syncWithLock should only have been called once (second flush skipped due to guard)
    expect(mockSyncWithLock).toHaveBeenCalledTimes(1)

    // Buffer should be empty after flush
    const remaining = useGameStore.getState()._pendingClickBuffer
    expect(remaining.length).toBe(0)
  })

  it('second concurrent flush returns true without calling sync', async () => {
    useGameStore.setState({
      _pendingClickBuffer: [{ timestamp: Date.now(), isCritical: false, multiplier: 1 }],
    })

    let resolveSyncPromise: ((v: unknown) => void) | null = null
    mockSyncWithLock.mockImplementation(() =>
      new Promise(resolve => { resolveSyncPromise = resolve })
    )

    // Start first flush — it will block on syncWithLock
    const flush1 = useGameStore.getState().flushPendingClicks()

    // Second flush should return true immediately (guard active)
    const result2 = await useGameStore.getState().flushPendingClicks()
    expect(result2).toBe(true)

    // Resolve the first flush
    resolveSyncPromise!({ gameState: buildMockServerState(), serverTime: Date.now() })
    await flush1

    expect(mockSyncWithLock).toHaveBeenCalledTimes(1)
  })

  it('flushPendingClicks returns true when buffer is empty', async () => {
    useGameStore.setState({ _pendingClickBuffer: [] })
    const result = await useGameStore.getState().flushPendingClicks()
    expect(result).toBe(true)
    expect(mockSyncWithLock).not.toHaveBeenCalled()
  })

  it('flushPendingClicks resets guard on failure so next call can proceed', async () => {
    useGameStore.setState({
      _pendingClickBuffer: [{ timestamp: Date.now(), isCritical: false, multiplier: 1 }],
    })

    // First flush fails (null response)
    mockSyncWithLock.mockResolvedValueOnce(null)
    const result1 = await useGameStore.getState().flushPendingClicks()
    expect(result1).toBe(false)

    // Guard should be reset — next flush should proceed
    mockSyncWithLock.mockResolvedValueOnce({
      gameState: buildMockServerState(),
      serverTime: Date.now(),
    })
    const result2 = await useGameStore.getState().flushPendingClicks()
    expect(result2).toBe(true)
    expect(mockSyncWithLock).toHaveBeenCalledTimes(2)
  })
})

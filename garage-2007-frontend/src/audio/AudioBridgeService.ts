import type { SfxKey } from '../game/config/audioAssets'
import {
  pushAudioDebugEvent,
  setAudioDebugBridgeStateProvider,
} from './audioDebug'
import type { AudioPlaybackResult, AudioSink } from './types'

export interface AudioBridgeQueueItem {
  key: SfxKey
  ts: number
  source?: string
}

export interface AudioBridgeState {
  ready: boolean
  queue: AudioBridgeQueueItem[]
  maxQueueLength: number
}

const CLICK_COALESCE_WINDOW_MS = 50
const COALESCED_CLICK_KEYS: readonly SfxKey[] = ['click_normal', 'click_critical']

export class AudioBridgeService {
  private sink: AudioSink | null = null
  private queue: AudioBridgeQueueItem[] = []
  private ready = false
  private lastDirectPlayTs = new Map<SfxKey, number>()

  readonly maxQueueLength = 100

  play(key: SfxKey, source?: string): AudioPlaybackResult {
    const now = Date.now()
    const item = { key, ts: now, source }

    if (!this.ready || !this.sink) {
      this.enqueue(item, 'bridge_not_ready')
      return 'queued'
    }

    // Coalesce rapid clicks even on direct play path
    if (COALESCED_CLICK_KEYS.includes(key)) {
      const lastTs = this.lastDirectPlayTs.get(key) ?? 0
      if (now - lastTs <= CLICK_COALESCE_WINDOW_MS) return 'queued'
      this.lastDirectPlayTs.set(key, now)
    }

    // Drain any stuck items before playing new sound
    if (this.queue.length > 0) {
      this.drainQueue()
    }

    const result = this.sink(key, source)
    if (result === 'rejected') {
      pushAudioDebugEvent({
        key,
        source,
        time: now,
        bridgeState: 'ready',
        audioState: 'available',
        loaderState: 'ready',
        result: 'rejected_sink',
        reason: 'sink_rejected',
      })
    }

    return result
  }

  setSink(sink: AudioSink): void {
    this.sink = sink
    this.ready = true
    this.drainQueue()
  }

  clearSink(): void {
    this.sink = null
    this.ready = false
  }

  getState(): AudioBridgeState {
    return {
      ready: this.ready,
      queue: [...this.queue],
      maxQueueLength: this.maxQueueLength,
    }
  }

  resetForTests(): void {
    this.sink = null
    this.queue = []
    this.ready = false
    this.lastDirectPlayTs.clear()
  }

  private drainQueue(): void {
    while (this.ready && this.sink && this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) return

      const result = this.sink(item.key, item.source)
      if (result === 'played' || result === 'queued') {
        pushAudioDebugEvent({
          key: item.key,
          source: item.source,
          time: Date.now(),
          bridgeState: 'ready',
          audioState: 'available',
          loaderState: 'ready',
          result: 'replayed_from_bridge',
          reason: result,
        })
        continue
      }

      pushAudioDebugEvent({
        key: item.key,
        source: item.source,
        time: Date.now(),
        bridgeState: 'ready',
        audioState: 'available',
        loaderState: 'ready',
        result: 'rejected_sink',
        reason: 'bridge_drain_rejected',
      })
    }
  }

  private enqueue(item: AudioBridgeQueueItem, reason: string): void {
    if (this.shouldCoalesce(item)) {
      return
    }

    this.queue.push(item)
    if (this.queue.length > this.maxQueueLength) {
      const dropped = this.queue.shift()
      if (dropped) {
        pushAudioDebugEvent({
          key: dropped.key,
          source: dropped.source,
          time: Date.now(),
          bridgeState: this.ready && this.sink ? 'ready' : 'not_ready',
          audioState: 'missing',
          loaderState: 'idle',
          result: 'dropped_queue_overflow',
          reason: 'bridge_queue_overflow',
        })
      }
    }

    pushAudioDebugEvent({
      key: item.key,
      source: item.source,
      time: item.ts,
      bridgeState: this.ready && this.sink ? 'ready' : 'not_ready',
      audioState: 'missing',
      loaderState: 'idle',
      result: 'queued_sink_not_ready',
      reason,
    })
  }

  private shouldCoalesce(item: AudioBridgeQueueItem): boolean {
    if (!COALESCED_CLICK_KEYS.includes(item.key)) return false

    const lastItem = this.queue[this.queue.length - 1]
    if (!lastItem || lastItem.key !== item.key) return false

    return item.ts - lastItem.ts <= CLICK_COALESCE_WINDOW_MS
  }
}

export const audioBridge = new AudioBridgeService()
setAudioDebugBridgeStateProvider(() => audioBridge.getState())

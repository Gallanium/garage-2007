import type { SfxKey } from '../game/config/audioAssets'
import { pushAudioDebugEvent } from './audioDebug'

type AudioSink = (key: SfxKey) => boolean | void

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

  play(key: SfxKey, source?: string): boolean {
    const now = Date.now()
    const item = { key, ts: now, source }

    if (!this.ready || !this.sink) {
      this.enqueue(item, 'bridge_not_ready')
      return true
    }

    // Coalesce rapid clicks even on direct play path
    if (COALESCED_CLICK_KEYS.includes(key)) {
      const lastTs = this.lastDirectPlayTs.get(key) ?? 0
      if (now - lastTs <= CLICK_COALESCE_WINDOW_MS) return true
      this.lastDirectPlayTs.set(key, now)
    }

    // Drain any stuck items before playing new sound
    if (this.queue.length > 0) {
      this.drainQueue()
    }

    const accepted = this.sink(key)
    if (accepted === false) {
      this.enqueue(item, 'sink_rejected')
    }

    return true
  }

  setSink(sink: AudioSink): void {
    this.sink = sink
    this.ready = true
    this.attachDebugWindow()
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

      const accepted = this.sink(item.key)
      if (accepted === false) {
        this.queue.unshift(item)
        break
      }
    }
  }

  private enqueue(item: AudioBridgeQueueItem, reason: string): void {
    if (this.shouldCoalesce(item)) {
      return
    }

    this.queue.push(item)
    if (this.queue.length > this.maxQueueLength) {
      this.queue.shift()
    }

    pushAudioDebugEvent({
      key: item.key,
      source: item.source,
      time: item.ts,
      bridgeState: this.ready && this.sink ? 'ready' : 'not_ready',
      audioState: 'missing',
      loaderState: 'idle',
      result: 'queued_bridge_not_ready',
      reason,
    })
  }

  private shouldCoalesce(item: AudioBridgeQueueItem): boolean {
    if (!COALESCED_CLICK_KEYS.includes(item.key)) return false

    const lastItem = this.queue[this.queue.length - 1]
    if (!lastItem || lastItem.key !== item.key) return false

    return item.ts - lastItem.ts <= CLICK_COALESCE_WINDOW_MS
  }

  private attachDebugWindow(): void {
    if (!import.meta.env.DEV || typeof window === 'undefined' || !window.__audioDebug) return
    window.__audioDebug.getBridgeState = () => this.getState()
  }
}

export const audioBridge = new AudioBridgeService()

if (import.meta.env.DEV && typeof window !== 'undefined' && window.__audioDebug) {
  window.__audioDebug.getBridgeState = () => audioBridge.getState()
}

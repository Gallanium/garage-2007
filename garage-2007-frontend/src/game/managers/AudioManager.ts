import type Phaser from 'phaser'
import { pushAudioDebugEvent } from '../../audio/audioDebug'
import { AUDIO_ASSETS, VOLUME_OVERRIDES, type SfxKey, isSfxKey } from '../config/audioAssets'

const DEFAULT_VOLUME = 0.03
const PENDING_TTL_MS = 500
const GAME_VISIBLE_EVENT = 'visible'
const MAX_CONCURRENT_SOUNDS = 4
const SOUND_DURATION_ESTIMATE_MS = 300

type AudioLoadState = 'idle' | 'loading' | 'ready' | 'failed'

/**
 * Phaser-based audio manager.
 * Loads audio non-blocking in create() to avoid hanging the preloader
 * in mobile WebViews where AudioContext is suspended before user gesture.
 * Retries loading after AudioContext unlock if initial decode failed.
 */
export class AudioManager {
  private readonly scene: Phaser.Scene
  private readonly keyStates = new Map<SfxKey, AudioLoadState>()
  private readonly loadingKeys = new Set<SfxKey>()
  private readonly pendingPlays = new Map<SfxKey, { count: number; queuedAt: number }>()
  private readonly failedKeys = new Map<SfxKey, string>()
  private destroyed = false
  private activeSoundCount = 0
  private activeSoundTimers: ReturnType<typeof setTimeout>[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    for (const key of Object.keys(AUDIO_ASSETS) as SfxKey[]) {
      this.keyStates.set(key, this.scene.cache.audio.exists(key) ? 'ready' : 'idle')
    }

    this.scene.load.on('filecomplete', this.handleFileComplete, this)
    this.scene.load.on('loaderror', this.handleLoadError, this)
    this.scene.game.events.on(GAME_VISIBLE_EVENT, this.handleGameVisible, this)
  }

  /** Queue audio assets, start non-blocking load, retry after unlock if needed */
  loadAndCreate(): void {
    const queuedCount = this.queueMissing('initial_preload')
    if (queuedCount > 0) {
      this.scene.load.start()
    }

    if (this.scene.sound.locked) {
      this.scene.sound.once('unlocked', this.handleUnlocked, this)
    } else {
      this.flushPendingReadyPlays()
    }
  }

  /** Play a sound effect by key. If not loaded yet, queue load and play when ready. */
  playSfx(key: SfxKey, volume = DEFAULT_VOLUME): boolean {
    if (this.destroyed || !this.scene.sound) {
      this.pushDebug(key, 'play_returned_false', {
        loaderState: 'failed',
        audioState: this.getAudioState(),
        reason: 'sound_manager_missing',
      })
      return false
    }

    const effectiveVolume = volume * (VOLUME_OVERRIDES[key] ?? 1.0)
    const state = this.getKeyState(key)

    if (state === 'ready') {
      return this.tryPlay(key, effectiveVolume, 'play_request')
    }

    this.incrementPending(key)

    if (state === 'loading') {
      this.pushDebug(key, 'queued_loading', {
        loaderState: 'loading',
        audioState: this.getAudioState(),
        reason: 'play_requested_while_loading',
      })
      return true
    }

    const loadStarted = this.queueLoad(key, state === 'failed' ? 'retry_after_play_request' : 'play_request')
    if (loadStarted) {
      this.scene.load.start()
    }

    return true
  }

  destroy(): void {
    this.destroyed = true
    this.scene.load.off('filecomplete', this.handleFileComplete, this)
    this.scene.load.off('loaderror', this.handleLoadError, this)
    this.scene.game.events.off(GAME_VISIBLE_EVENT, this.handleGameVisible, this)
    this.scene.sound.off('unlocked', this.handleUnlocked, this)

    for (const timer of this.activeSoundTimers) clearTimeout(timer)
    this.activeSoundTimers = []
    this.activeSoundCount = 0

    this.loadingKeys.clear()
    this.pendingPlays.clear()
    this.failedKeys.clear()
    this.keyStates.clear()

    if (this.scene.sound) {
      this.scene.sound.stopAll()
    }
  }

  /** Queue audio assets that are not yet cached. Returns count of queued files. */
  private queueMissing(source: string): number {
    let count = 0

    for (const key of Object.keys(AUDIO_ASSETS) as SfxKey[]) {
      if (this.queueLoad(key, source)) {
        count++
      }
    }

    return count
  }

  private queueLoad(key: SfxKey, source: string): boolean {
    if (this.destroyed) return false

    if (this.scene.cache.audio.exists(key)) {
      this.keyStates.set(key, 'ready')
      this.failedKeys.delete(key)
      return false
    }

    if (this.loadingKeys.has(key)) {
      return false
    }

    const url = AUDIO_ASSETS[key]
    if (!url) {
      this.pushDebug(key, 'dropped_unknown_key', {
        loaderState: 'failed',
        audioState: this.getAudioState(),
        reason: 'missing_asset_url',
        source,
      })
      return false
    }

    this.loadingKeys.add(key)
    this.keyStates.set(key, 'loading')
    this.failedKeys.delete(key)
    this.scene.load.audio(key, url)

    this.pushDebug(key, 'load_started', {
      loaderState: 'loading',
      audioState: this.getAudioState(),
      source,
    })

    return true
  }

  private tryPlay(key: SfxKey, volume: number, source: string): boolean {
    return this.tryPlayInternal(key, volume, source, true)
  }

  private tryPlayInternal(key: SfxKey, volume: number, source: string, requeueOnFailure: boolean): boolean {
    if (this.destroyed || !this.scene.sound) {
      if (requeueOnFailure) {
        this.incrementPending(key)
      }

      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason: 'sound_manager_missing',
      })
      return false
    }

    // Enforce concurrent sounds limit
    if (this.activeSoundCount >= MAX_CONCURRENT_SOUNDS) {
      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason: 'concurrent_limit_reached',
      })
      return false
    }

    try {
      const started = this.scene.sound.play(key, { volume })

      if (started) {
        this.activeSoundCount++
        const timer = setTimeout(() => {
          this.activeSoundCount = Math.max(0, this.activeSoundCount - 1)
          const idx = this.activeSoundTimers.indexOf(timer)
          if (idx !== -1) this.activeSoundTimers.splice(idx, 1)
        }, SOUND_DURATION_ESTIMATE_MS)
        this.activeSoundTimers.push(timer)

        this.pushDebug(key, 'played', {
          loaderState: 'ready',
          audioState: this.getAudioState(),
          source,
        })
        return true
      }

      if (requeueOnFailure) {
        this.incrementPending(key)
      }

      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason: this.scene.sound.locked ? 'sound_locked' : 'play_returned_false',
      })
      return false
    } catch (error) {
      if (requeueOnFailure) {
        this.incrementPending(key)
      }

      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason: error instanceof Error ? error.message : 'unknown_play_error',
      })
      return false
    }
  }

  private flushPendingReadyPlays(targetKey?: SfxKey): void {
    const now = Date.now()
    const keys = targetKey ? [targetKey] : Array.from(this.pendingPlays.keys())

    for (const key of keys) {
      const pending = this.pendingPlays.get(key)
      if (!pending || pending.count <= 0) continue
      if (this.getKeyState(key) !== 'ready') continue

      this.pendingPlays.delete(key)

      // Drop stale entries — sound was requested too long ago, context has changed
      if (now - pending.queuedAt > PENDING_TTL_MS) continue

      // Play once regardless of count — prevents burst of duplicate sounds
      this.tryPlayInternal(key, this.getEffectiveVolume(key), 'pending_flush', false)
    }
  }

  private incrementPending(key: SfxKey, count = 1): void {
    const existing = this.pendingPlays.get(key)
    if (existing) {
      existing.count += count
    } else {
      this.pendingPlays.set(key, { count, queuedAt: Date.now() })
    }
  }

  private getEffectiveVolume(key: SfxKey): number {
    return DEFAULT_VOLUME * (VOLUME_OVERRIDES[key] ?? 1.0)
  }

  private getKeyState(key: SfxKey): AudioLoadState {
    if (this.scene.cache.audio.exists(key)) {
      this.keyStates.set(key, 'ready')
      this.loadingKeys.delete(key)
      this.failedKeys.delete(key)
      return 'ready'
    }

    if (this.loadingKeys.has(key)) {
      return 'loading'
    }

    return this.keyStates.get(key) ?? 'idle'
  }

  private getAudioState(): 'available' | 'locked' | 'destroyed' | 'missing' {
    if (this.destroyed) return 'destroyed'
    if (!this.scene.sound) return 'missing'
    if (this.scene.sound.locked) return 'locked'
    return 'available'
  }

  private pushDebug(
    key: SfxKey | string,
    result: 'queued_loading' | 'played' | 'play_returned_false' | 'load_started' | 'load_succeeded' | 'load_failed' | 'dropped_unknown_key',
    options: {
      source?: string
      reason?: string
      loaderState: AudioLoadState
      audioState: 'available' | 'locked' | 'destroyed' | 'missing'
    },
  ): void {
    pushAudioDebugEvent({
      key,
      source: options.source,
      time: Date.now(),
      bridgeState: 'ready',
      audioState: options.audioState,
      loaderState: options.loaderState,
      result,
      reason: options.reason,
    })
  }

  private readonly handleFileComplete = (key: string, type: string): void => {
    if (type !== 'audio' || !isSfxKey(key)) return

    this.loadingKeys.delete(key)
    this.failedKeys.delete(key)
    this.keyStates.set(key, 'ready')

    this.pushDebug(key, 'load_succeeded', {
      loaderState: 'ready',
      audioState: this.getAudioState(),
      source: 'loader_complete',
    })

    this.flushPendingReadyPlays(key)
  }

  private readonly handleLoadError = (file: { key: string; src?: string; url?: string }): void => {
    if (!isSfxKey(file.key)) return

    const reason = file.src ?? file.url ?? 'load_error'

    this.loadingKeys.delete(file.key)
    this.failedKeys.set(file.key, reason)
    this.keyStates.set(file.key, 'failed')

    this.pushDebug(file.key, 'load_failed', {
      loaderState: 'failed',
      audioState: this.getAudioState(),
      source: 'loader_error',
      reason,
    })
  }

  private readonly handleUnlocked = (): void => {
    const queuedCount = this.queueMissing('retry_after_unlock')
    if (queuedCount > 0) {
      this.scene.load.start()
    }

    this.flushPendingReadyPlays()
  }

  private readonly handleGameVisible = (): void => {
    // Explicitly resume AudioContext — Telegram WebView may not trigger
    // Phaser's built-in resume via Page Visibility API reliably
    const ctx = (this.scene.sound as unknown as { context?: AudioContext })?.context
    if (ctx?.state === 'suspended') {
      ctx.resume().then(() => {
        this.flushPendingReadyPlays()
      }).catch(() => {
        // Resume failed — will retry on next user gesture or visibility event
      })
      return
    }
    this.flushPendingReadyPlays()
  }
}

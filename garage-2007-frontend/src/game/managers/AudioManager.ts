import type Phaser from 'phaser'
import {
  pushAudioDebugEvent,
  setAudioDebugAudioManagerStateProvider,
} from '../../audio/audioDebug'
import type { AudioPlaybackResult } from '../../audio/types'
import { AUDIO_ASSETS, VOLUME_OVERRIDES, type SfxKey, isSfxKey } from '../config/audioAssets'

const DEFAULT_VOLUME = 0.03
const GAME_VISIBLE_EVENT = 'visible'
const MAX_CONCURRENT_SOUNDS = 4
const SHORT_LIVED_PENDING_MAX_AGE_MS = 300
const MODAL_PENDING_MAX_AGE_MS = 1500
const IMPORTANT_PENDING_MAX_AGE_MS = 5000

type AudioLoadState = 'idle' | 'loading' | 'ready' | 'failed'

interface PendingPlayEntry {
  count: number
  queuedAt: number
  lastSource?: string
  maxAgeMs: number
}

interface PlayOptions {
  volume?: number
  source?: string
}

interface AudioManagerDebugState {
  loadingKeys: SfxKey[]
  pendingKeys: Array<PendingPlayEntry & { key: SfxKey }>
  failedKeys: Array<{ key: SfxKey; reason: string }>
  activeSoundCount: number
}

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
  private readonly pendingPlays = new Map<SfxKey, PendingPlayEntry>()
  private readonly failedKeys = new Map<SfxKey, string>()
  private readonly activeSounds = new Set<Phaser.Sound.BaseSound>()
  private destroyed = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    for (const key of Object.keys(AUDIO_ASSETS) as SfxKey[]) {
      this.keyStates.set(key, this.scene.cache.audio.exists(key) ? 'ready' : 'idle')
    }

    this.scene.load.on('filecomplete', this.handleFileComplete, this)
    this.scene.load.on('loaderror', this.handleLoadError, this)
    this.scene.game.events.on(GAME_VISIBLE_EVENT, this.handleGameVisible, this)
    setAudioDebugAudioManagerStateProvider(() => this.getDebugState())
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
  playSfx(key: SfxKey, options?: PlayOptions): AudioPlaybackResult {
    const source = options?.source ?? 'play_request'
    const volume = options?.volume ?? DEFAULT_VOLUME

    if (this.destroyed || !this.scene.sound) {
      this.pushDebug(key, 'play_returned_false', {
        loaderState: 'failed',
        audioState: this.getAudioState(),
        reason: 'sound_manager_missing',
        source,
      })
      return 'rejected'
    }

    const effectiveVolume = volume * (VOLUME_OVERRIDES[key] ?? 1.0)
    const state = this.getKeyState(key)

    if (state === 'ready') {
      return this.tryPlay(key, effectiveVolume, source)
    }

    this.queuePending(
      key,
      source,
      'queued_audio_manager',
      state === 'failed' ? 'retry_after_play_request' : 'play_requested_before_ready',
    )

    if (state === 'loading') {
      return 'queued'
    }

    const loadStarted = this.queueLoad(key, state === 'failed' ? 'retry_after_play_request' : source)
    if (loadStarted) {
      this.scene.load.start()
    }

    return 'queued'
  }

  destroy(): void {
    this.destroyed = true
    this.scene.load.off('filecomplete', this.handleFileComplete, this)
    this.scene.load.off('loaderror', this.handleLoadError, this)
    this.scene.game.events.off(GAME_VISIBLE_EVENT, this.handleGameVisible, this)
    this.scene.sound.off('unlocked', this.handleUnlocked, this)

    for (const sound of [...this.activeSounds]) {
      try {
        sound.stop()
      } catch {
        // Ignore stop errors during teardown.
      }
      try {
        sound.destroy()
      } catch {
        // Ignore destroy errors during teardown.
      }
    }
    this.activeSounds.clear()

    this.loadingKeys.clear()
    this.pendingPlays.clear()
    this.failedKeys.clear()
    this.keyStates.clear()

    if (this.scene.sound) {
      this.scene.sound.stopAll()
    }

    setAudioDebugAudioManagerStateProvider(undefined)
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

  private tryPlay(key: SfxKey, volume: number, source: string): AudioPlaybackResult {
    return this.tryPlayInternal(key, volume, source, true)
  }

  private tryPlayInternal(
    key: SfxKey,
    volume: number,
    source: string,
    allowQueueOnFailure: boolean,
  ): AudioPlaybackResult {
    if (this.destroyed || !this.scene.sound) {
      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason: 'sound_manager_missing',
      })
      return 'rejected'
    }

    if (this.activeSounds.size >= MAX_CONCURRENT_SOUNDS) {
      if (this.shouldRejectOnConcurrentLimit(key)) {
        this.pushDebug(key, 'play_returned_false', {
          loaderState: this.getKeyState(key),
          audioState: this.getAudioState(),
          source,
          reason: 'play_rejected_concurrent_limit',
        })
        return 'rejected'
      }

      if (allowQueueOnFailure) {
        this.queuePending(key, source, 'queued_concurrent_limit', 'concurrent_limit_reached')
        return 'queued'
      }

      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason: 'play_rejected_concurrent_limit',
      })
      return 'rejected'
    }

    let sound: Phaser.Sound.BaseSound
    try {
      sound = this.scene.sound.add(key, { volume })
    } catch (error) {
      if (allowQueueOnFailure) {
        this.queuePending(
          key,
          source,
          'queued_audio_manager',
          error instanceof Error ? error.message : 'sound_add_failed',
        )
        return 'queued'
      }

      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason: error instanceof Error ? error.message : 'sound_add_failed',
      })
      return 'rejected'
    }

    let activated = false
    let cleanedUp = false

    const handleComplete = () => cleanup(true)
    const handleStop = () => cleanup(true)
    const handleDestroy = () => cleanup(false)

    const cleanup = (shouldDestroy: boolean): void => {
      if (cleanedUp) return
      cleanedUp = true

      sound.off('complete', handleComplete)
      sound.off('stop', handleStop)
      sound.off('destroy', handleDestroy)

      if (activated) {
        this.activeSounds.delete(sound)
        if (!this.destroyed) {
          this.flushPendingReadyPlays()
        }
      }

      if (shouldDestroy) {
        try {
          sound.destroy()
        } catch {
          // Ignore cleanup destroy errors.
        }
      }
    }

    sound.once('complete', handleComplete)
    sound.once('stop', handleStop)
    sound.once('destroy', handleDestroy)

    const rejectOrQueue = (reason: string): AudioPlaybackResult => {
      cleanup(true)

      if (allowQueueOnFailure) {
        this.queuePending(key, source, 'queued_audio_manager', reason)
        return 'queued'
      }

      this.pushDebug(key, 'play_returned_false', {
        loaderState: this.getKeyState(key),
        audioState: this.getAudioState(),
        source,
        reason,
      })
      return 'rejected'
    }

    try {
      const started = sound.play()

      if (!started) {
        return rejectOrQueue(this.scene.sound.locked ? 'sound_locked' : 'play_returned_false')
      }

      activated = true
      this.activeSounds.add(sound)

      this.pushDebug(key, 'played', {
        loaderState: 'ready',
        audioState: this.getAudioState(),
        source,
      })

      return 'played'
    } catch (error) {
      return rejectOrQueue(error instanceof Error ? error.message : 'unknown_play_error')
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

      if (now - pending.queuedAt > pending.maxAgeMs) {
        this.pushDebug(key, 'dropped_pending_expired', {
          loaderState: 'ready',
          audioState: this.getAudioState(),
          source: pending.lastSource,
          reason: `pending_expired_after_${now - pending.queuedAt}ms`,
        })
        continue
      }

      const result = this.tryPlayInternal(
        key,
        this.getEffectiveVolume(key),
        pending.lastSource ?? 'pending_flush',
        true,
      )

      if (result === 'played') {
        this.pushDebug(key, 'replayed_from_pending', {
          loaderState: 'ready',
          audioState: this.getAudioState(),
          source: pending.lastSource ?? 'pending_flush',
          reason: `pending_count_${pending.count}`,
        })
      }
    }
  }

  private queuePending(
    key: SfxKey,
    source: string | undefined,
    result: 'queued_audio_manager' | 'queued_concurrent_limit',
    reason: string,
  ): void {
    const maxAgeMs = this.getPendingMaxAgeMs(key)
    const existing = this.pendingPlays.get(key)

    if (existing) {
      existing.count += 1
      existing.lastSource = source ?? existing.lastSource
      existing.maxAgeMs = Math.max(existing.maxAgeMs, maxAgeMs)
      return
    }

    this.pendingPlays.set(key, {
      count: 1,
      queuedAt: Date.now(),
      lastSource: source,
      maxAgeMs,
    })

    this.pushDebug(key, result, {
      loaderState: this.getKeyState(key),
      audioState: this.getAudioState(),
      source,
      reason,
    })
  }

  private getPendingMaxAgeMs(key: SfxKey): number {
    if (key === 'click_normal' || key === 'click_critical' || key === 'tab_switch') {
      return SHORT_LIVED_PENDING_MAX_AGE_MS
    }

    if (key === 'modal_open' || key === 'modal_close') {
      return MODAL_PENDING_MAX_AGE_MS
    }

    return IMPORTANT_PENDING_MAX_AGE_MS
  }

  private shouldRejectOnConcurrentLimit(key: SfxKey): boolean {
    return key === 'click_normal' || key === 'click_critical'
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

  private getDebugState(): AudioManagerDebugState {
    return {
      loadingKeys: Array.from(this.loadingKeys),
      pendingKeys: Array.from(this.pendingPlays.entries()).map(([key, entry]) => ({ key, ...entry })),
      failedKeys: Array.from(this.failedKeys.entries()).map(([key, reason]) => ({ key, reason })),
      activeSoundCount: this.activeSounds.size,
    }
  }

  private pushDebug(
    key: SfxKey | string,
    result:
      | 'queued_audio_manager'
      | 'queued_concurrent_limit'
      | 'replayed_from_pending'
      | 'dropped_pending_expired'
      | 'played'
      | 'play_returned_false'
      | 'load_started'
      | 'load_succeeded'
      | 'load_failed'
      | 'dropped_unknown_key',
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

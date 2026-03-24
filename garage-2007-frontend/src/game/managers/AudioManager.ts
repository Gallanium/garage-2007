import { AUDIO_ASSETS } from '../config/audioAssets'

const DEFAULT_VOLUME = 0.03

/**
 * Phaser-based audio manager.
 * Loads audio non-blocking in create() to avoid hanging the preloader
 * in mobile WebViews where AudioContext is suspended before user gesture.
 * Retries loading after AudioContext unlock if initial decode failed.
 */
export class AudioManager {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Queue audio assets, start non-blocking load, retry after unlock if needed */
  loadAndCreate(): void {
    this.queueMissing()
    this.scene.load.start()

    // If AudioContext is locked, audio decoding may fail.
    // Retry loading after the first user gesture unlocks it.
    if (this.scene.sound.locked) {
      this.scene.sound.once('unlocked', () => {
        if (this.queueMissing() > 0) {
          this.scene.load.start()
        }
      })
    }
  }

  /** Play a sound effect by key */
  playSfx(key: string, volume = DEFAULT_VOLUME): void {
    if (!this.scene.sound) return
    if (!this.scene.cache.audio.exists(key)) return
    try {
      this.scene.sound.play(key, { volume })
    } catch {
      // Silently ignore unsupported audio
    }
  }

  destroy(): void {
    if (this.scene.sound) {
      this.scene.sound.stopAll()
    }
  }

  /** Queue audio assets that are not yet cached. Returns count of queued files. */
  private queueMissing(): number {
    let count = 0
    for (const [key, url] of Object.entries(AUDIO_ASSETS)) {
      if (!this.scene.cache.audio.exists(key)) {
        this.scene.load.audio(key, url)
        count++
      }
    }
    return count
  }
}

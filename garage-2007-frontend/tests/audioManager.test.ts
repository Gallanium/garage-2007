import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { AudioManager } from '../src/game/managers/AudioManager'

function createFakeScene() {
  const cachedKeys = new Set<string>()
  const loadEmitter = new EventEmitter()
  const soundEmitter = new EventEmitter()
  const gameEmitter = new EventEmitter()

  const load = Object.assign(loadEmitter, {
    audio: vi.fn(),
    start: vi.fn(),
  })

  const mockContext = {
    state: 'running' as 'running' | 'suspended',
    resume: vi.fn(() => Promise.resolve()),
  }

  const sound = Object.assign(soundEmitter, {
    locked: false,
    play: vi.fn(() => true),
    stopAll: vi.fn(),
    context: mockContext,
  })

  const scene = {
    cache: {
      audio: {
        exists: (key: string) => cachedKeys.has(key),
      },
    },
    load,
    sound,
    game: {
      events: gameEmitter,
    },
  } as unknown as Phaser.Scene

  return { scene, cachedKeys, load, sound, gameEmitter, mockContext }
}

describe('AudioManager', () => {
  it('does not enqueue duplicate loads while the same key is already loading', () => {
    const { scene, cachedKeys, load, sound } = createFakeScene()
    const manager = new AudioManager(scene)

    manager.playSfx('purchase')
    manager.playSfx('purchase')

    expect(load.audio).toHaveBeenCalledTimes(1)
    expect(load.start).toHaveBeenCalledTimes(1)

    cachedKeys.add('purchase')
    load.emit('filecomplete', 'purchase', 'audio')

    expect(sound.play).toHaveBeenCalledTimes(1)
  })

  it('drops stale pending plays older than PENDING_TTL_MS', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T15:00:00.000Z'))

    const { scene, cachedKeys, load, sound } = createFakeScene()
    // Lock audio initially
    ;(sound as { locked: boolean }).locked = true
    const manager = new AudioManager(scene)

    // Play a sound while loading — goes to pending
    manager.playSfx('modal_open')
    expect(load.audio).toHaveBeenCalledTimes(1)

    // 600ms pass — beyond TTL
    vi.advanceTimersByTime(600)

    // Audio loads and unlocks
    cachedKeys.add('modal_open')
    load.emit('filecomplete', 'modal_open', 'audio')
    ;(sound as { locked: boolean }).locked = false
    sound.emit('unlocked')

    // Stale pending should NOT play
    expect(sound.play).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('calls context.resume() when game becomes visible and context is suspended', async () => {
    const { scene, gameEmitter, mockContext } = createFakeScene()
    const manager = new AudioManager(scene)
    manager.loadAndCreate()

    // Simulate AudioContext going suspended (background)
    mockContext.state = 'suspended'

    // Simulate game visible event (return from background)
    gameEmitter.emit('visible')

    expect(mockContext.resume).toHaveBeenCalledTimes(1)
  })

  it('retries a failed file on the next play request and flushes pending plays after success', () => {
    const { scene, cachedKeys, load, sound } = createFakeScene()
    const manager = new AudioManager(scene)

    manager.playSfx('modal_open')
    load.emit('loaderror', { key: 'modal_open', src: '/broken/modal_open.mp3' })

    manager.playSfx('modal_open')

    expect(load.audio).toHaveBeenCalledTimes(2)
    expect(load.start).toHaveBeenCalledTimes(2)

    cachedKeys.add('modal_open')
    load.emit('filecomplete', 'modal_open', 'audio')

    expect(sound.play).toHaveBeenCalledTimes(1)
  })
})

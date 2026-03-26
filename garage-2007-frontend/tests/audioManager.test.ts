import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { AudioManager } from '../src/game/managers/AudioManager'

type FakeSoundInstance = EventEmitter & {
  play: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

function createFakeSoundInstance(playResult = true): FakeSoundInstance {
  const emitter = new EventEmitter()
  const instance = Object.assign(emitter, {
    play: vi.fn(() => playResult),
    stop: vi.fn(() => {
      emitter.emit('stop')
    }),
    destroy: vi.fn(() => {
      emitter.emit('destroy')
    }),
  })

  return instance
}

function createFakeScene() {
  const cachedKeys = new Set<string>()
  const loadEmitter = new EventEmitter()
  const soundEmitter = new EventEmitter()
  const gameEmitter = new EventEmitter()
  const soundInstances: FakeSoundInstance[] = []

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
    add: vi.fn(() => {
      const instance = createFakeSoundInstance()
      soundInstances.push(instance)
      return instance
    }),
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

  return { scene, cachedKeys, load, sound, soundInstances, gameEmitter, mockContext }
}

describe('AudioManager', () => {
  it('does not enqueue duplicate loads while the same key is already loading', () => {
    const { scene, cachedKeys, load, soundInstances } = createFakeScene()
    const manager = new AudioManager(scene)

    expect(manager.playSfx('purchase')).toBe('queued')
    expect(manager.playSfx('purchase')).toBe('queued')

    expect(load.audio).toHaveBeenCalledTimes(1)
    expect(load.start).toHaveBeenCalledTimes(1)

    cachedKeys.add('purchase')
    load.emit('filecomplete', 'purchase', 'audio')

    expect(soundInstances).toHaveLength(1)
    expect(soundInstances[0].play).toHaveBeenCalledTimes(1)
  })

  it('keeps modal sounds pending past the short click window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T15:00:00.000Z'))

    const { scene, cachedKeys, load, soundInstances } = createFakeScene()
    const manager = new AudioManager(scene)

    expect(manager.playSfx('modal_open')).toBe('queued')
    vi.advanceTimersByTime(600)

    cachedKeys.add('modal_open')
    load.emit('filecomplete', 'modal_open', 'audio')

    expect(soundInstances).toHaveLength(1)
    expect(soundInstances[0].play).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('drops stale click sounds after the short-lived pending window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T15:00:00.000Z'))

    const { scene, cachedKeys, load, soundInstances } = createFakeScene()
    const manager = new AudioManager(scene)

    expect(manager.playSfx('click_normal')).toBe('queued')
    vi.advanceTimersByTime(400)

    cachedKeys.add('click_normal')
    load.emit('filecomplete', 'click_normal', 'audio')

    expect(soundInstances).toHaveLength(0)

    vi.useRealTimers()
  })

  it('calls context.resume() when game becomes visible and context is suspended', () => {
    const { scene, gameEmitter, mockContext } = createFakeScene()
    const manager = new AudioManager(scene)
    manager.loadAndCreate()

    mockContext.state = 'suspended'
    gameEmitter.emit('visible')

    expect(mockContext.resume).toHaveBeenCalledTimes(1)
  })

  it('rejects click sounds when concurrent limit is reached', () => {
    const { scene, cachedKeys, soundInstances } = createFakeScene()
    const manager = new AudioManager(scene)

    cachedKeys.add('click_normal')
    manager.loadAndCreate()

    for (let i = 0; i < 4; i++) {
      expect(manager.playSfx('click_normal')).toBe('played')
    }

    expect(soundInstances).toHaveLength(4)
    expect(manager.playSfx('click_normal')).toBe('rejected')
    expect(soundInstances).toHaveLength(4)
  })

  it('queues non-click sounds on concurrent limit and replays them after completion', () => {
    const { scene, cachedKeys, soundInstances } = createFakeScene()
    const manager = new AudioManager(scene)

    cachedKeys.add('modal_open')
    manager.loadAndCreate()

    for (let i = 0; i < 4; i++) {
      expect(manager.playSfx('modal_open')).toBe('played')
    }

    expect(manager.playSfx('modal_open')).toBe('queued')
    expect(soundInstances).toHaveLength(4)

    soundInstances[0].emit('complete')

    expect(soundInstances).toHaveLength(5)
    expect(soundInstances[4].play).toHaveBeenCalledTimes(1)
  })

  it('retries a failed file on the next play request and flushes pending plays after success', () => {
    const { scene, cachedKeys, load, soundInstances } = createFakeScene()
    const manager = new AudioManager(scene)

    expect(manager.playSfx('modal_open')).toBe('queued')
    load.emit('loaderror', { key: 'modal_open', src: '/broken/modal_open.mp3' })

    expect(manager.playSfx('modal_open')).toBe('queued')

    expect(load.audio).toHaveBeenCalledTimes(2)
    expect(load.start).toHaveBeenCalledTimes(2)

    cachedKeys.add('modal_open')
    load.emit('filecomplete', 'modal_open', 'audio')

    expect(soundInstances).toHaveLength(1)
    expect(soundInstances[0].play).toHaveBeenCalledTimes(1)
  })
})

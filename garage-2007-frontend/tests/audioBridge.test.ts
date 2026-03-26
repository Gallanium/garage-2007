import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioBridgeService } from '../src/audio/AudioBridgeService'

describe('AudioBridgeService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('queues sounds before sink is ready and drains them in FIFO order', () => {
    const bridge = new AudioBridgeService()
    const played: string[] = []

    bridge.play('purchase', 'test.purchase')
    bridge.play('modal_open', 'test.modalOpen')

    expect(bridge.getState().queue.map(item => item.key)).toEqual(['purchase', 'modal_open'])

    bridge.setSink((key) => {
      played.push(key)
      return true
    })

    expect(played).toEqual(['purchase', 'modal_open'])
    expect(bridge.getState().queue).toHaveLength(0)
  })

  it('keeps queued sounds across clearSink -> setSink', () => {
    const bridge = new AudioBridgeService()
    const played: string[] = []

    bridge.setSink((key) => {
      played.push(key)
      return true
    })

    bridge.play('purchase', 'test.immediate')
    bridge.clearSink()
    bridge.play('achievement', 'test.queuedAchievement')
    bridge.play('event_client_rush', 'test.queuedEvent')

    bridge.setSink((key) => {
      played.push(key)
      return true
    })

    expect(played).toEqual(['purchase', 'achievement', 'event_client_rush'])
    expect(bridge.getState().queue).toHaveLength(0)
  })

  it('coalesces burst click sounds while sink is not ready', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T15:00:00.000Z'))

    const bridge = new AudioBridgeService()

    bridge.play('click_normal', 'test.click1')
    vi.advanceTimersByTime(25)
    bridge.play('click_normal', 'test.click2')
    vi.advanceTimersByTime(25)
    bridge.play('purchase', 'test.purchase')

    expect(bridge.getState().queue.map(item => item.key)).toEqual(['click_normal', 'purchase'])
  })

  it('coalesces burst click sounds when sink IS ready (direct play path)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T15:00:00.000Z'))

    const bridge = new AudioBridgeService()
    const played: string[] = []

    bridge.setSink((key) => {
      played.push(key)
      return true
    })

    bridge.play('click_normal', 'test.click1')
    vi.advanceTimersByTime(25)
    bridge.play('click_normal', 'test.click2')  // within 50ms — should be coalesced
    vi.advanceTimersByTime(60)
    bridge.play('click_normal', 'test.click3')  // outside window — should play

    expect(played).toEqual(['click_normal', 'click_normal'])
  })

  it('drains stuck queue items on next successful play', () => {
    const bridge = new AudioBridgeService()
    const played: string[] = []
    let rejectAll = true

    bridge.setSink((key) => {
      if (rejectAll) return false
      played.push(key)
      return true
    })

    // First play rejected — goes to queue
    bridge.play('modal_open', 'test.rejected')
    expect(bridge.getState().queue).toHaveLength(1)

    // Sink starts accepting
    rejectAll = false
    bridge.play('purchase', 'test.accepted')

    // Both the stuck item and the new item should have played
    expect(played).toEqual(['modal_open', 'purchase'])
    expect(bridge.getState().queue).toHaveLength(0)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioBridgeService } from '../src/audio/AudioBridgeService'

describe('AudioBridgeService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('queues sounds before sink is ready and drains them in FIFO order', () => {
    const bridge = new AudioBridgeService()
    const played: string[] = []

    expect(bridge.play('purchase', 'test.purchase')).toBe('queued')
    expect(bridge.play('modal_open', 'test.modalOpen')).toBe('queued')
    expect(bridge.getState().queue.map(item => item.key)).toEqual(['purchase', 'modal_open'])

    bridge.setSink((key) => {
      played.push(key)
      return 'played'
    })

    expect(played).toEqual(['purchase', 'modal_open'])
    expect(bridge.getState().queue).toHaveLength(0)
  })

  it('keeps queued sounds across clearSink -> setSink', () => {
    const bridge = new AudioBridgeService()
    const played: string[] = []

    bridge.setSink((key) => {
      played.push(key)
      return 'played'
    })

    bridge.play('purchase', 'test.immediate')
    bridge.clearSink()
    bridge.play('achievement', 'test.queuedAchievement')
    bridge.play('event_client_rush', 'test.queuedEvent')

    bridge.setSink((key) => {
      played.push(key)
      return 'played'
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

  it('coalesces burst click sounds when sink is ready', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T15:00:00.000Z'))

    const bridge = new AudioBridgeService()
    const played: string[] = []

    bridge.setSink((key) => {
      played.push(key)
      return 'played'
    })

    expect(bridge.play('click_normal', 'test.click1')).toBe('played')
    vi.advanceTimersByTime(25)
    expect(bridge.play('click_normal', 'test.click2')).toBe('queued')
    vi.advanceTimersByTime(60)
    expect(bridge.play('click_normal', 'test.click3')).toBe('played')

    expect(played).toEqual(['click_normal', 'click_normal'])
  })

  it('does not requeue sounds when sink rejects after bridge is ready', () => {
    const bridge = new AudioBridgeService()

    bridge.setSink(() => 'rejected')

    expect(bridge.play('modal_open', 'test.rejected')).toBe('rejected')
    expect(bridge.getState().queue).toHaveLength(0)
  })

  it('treats queued sink results as accepted and does not duplicate bridge queue entries', () => {
    const bridge = new AudioBridgeService()
    const accepted: string[] = []

    bridge.setSink((key) => {
      accepted.push(key)
      return 'queued'
    })

    expect(bridge.play('modal_open', 'test.queued')).toBe('queued')
    expect(bridge.getState().queue).toHaveLength(0)
    expect(accepted).toEqual(['modal_open'])
  })
})

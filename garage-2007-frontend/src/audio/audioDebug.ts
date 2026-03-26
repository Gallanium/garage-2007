import type { SfxKey } from '../game/config/audioAssets'

export type AudioDebugResult =
  | 'queued_bridge_not_ready'
  | 'queued_loading'
  | 'played'
  | 'play_returned_false'
  | 'load_started'
  | 'load_succeeded'
  | 'load_failed'
  | 'dropped_unknown_key'

export interface AudioDebugEntry {
  key: SfxKey | string
  source?: string
  time: number
  bridgeState: 'ready' | 'not_ready'
  audioState: 'available' | 'locked' | 'destroyed' | 'missing'
  loaderState: 'idle' | 'loading' | 'ready' | 'failed'
  result: AudioDebugResult
  reason?: string
}

const MAX_DEBUG_EVENTS = 200
const audioDebugEvents: AudioDebugEntry[] = []

declare global {
  interface Window {
    __audioDebug?: {
      getEvents: () => AudioDebugEntry[]
      clear: () => void
      getBridgeState?: () => unknown
    }
  }
}

function attachDebugWindow(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  if (window.__audioDebug) return

  window.__audioDebug = {
    getEvents: () => [...audioDebugEvents],
    clear: () => {
      audioDebugEvents.length = 0
    },
  }
}

export function pushAudioDebugEvent(entry: AudioDebugEntry): void {
  if (!import.meta.env.DEV) return

  audioDebugEvents.push(entry)
  if (audioDebugEvents.length > MAX_DEBUG_EVENTS) {
    audioDebugEvents.splice(0, audioDebugEvents.length - MAX_DEBUG_EVENTS)
  }

  attachDebugWindow()
}

export function getAudioDebugEvents(): AudioDebugEntry[] {
  return [...audioDebugEvents]
}

export function resetAudioDebug(): void {
  audioDebugEvents.length = 0
}

attachDebugWindow()

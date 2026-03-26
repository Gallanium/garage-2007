import type { SfxKey } from '../game/config/audioAssets'

export type AudioPlaybackResult = 'played' | 'queued' | 'rejected'

export type AudioSink = (key: SfxKey, source?: string) => AudioPlaybackResult

export function isAcceptedAudioPlaybackResult(result: AudioPlaybackResult): boolean {
  return result !== 'rejected'
}

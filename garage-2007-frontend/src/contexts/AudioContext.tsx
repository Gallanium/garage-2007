/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'
import { audioBridge } from '../audio/AudioBridgeService'
import type { SfxKey } from '../game/config/audioAssets'

interface AudioContextValue {
  playSound: (key: SfxKey, source?: string) => boolean
}

const AudioCtx = createContext<AudioContextValue>({
  playSound: (key, source) => audioBridge.play(key, source),
})

interface AudioProviderProps {
  children: React.ReactNode
}

export function AudioProvider({ children }: AudioProviderProps) {
  const value = useMemo<AudioContextValue>(() => ({
    playSound: (key, source) => audioBridge.play(key, source),
  }), [])

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>
}

export function useAudio() {
  return useContext(AudioCtx)
}

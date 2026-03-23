/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'

interface AudioContextValue {
  playSound: (key: string) => void
}

const AudioCtx = createContext<AudioContextValue>({ playSound: () => {} })

interface AudioProviderProps {
  children: React.ReactNode
  playSoundRef: React.MutableRefObject<((key: string) => void) | null>
}

export function AudioProvider({ children, playSoundRef }: AudioProviderProps) {
  const value = useMemo<AudioContextValue>(() => ({
    playSound: (key: string) => playSoundRef.current?.(key),
  }), [playSoundRef])

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>
}

export function useAudio() {
  return useContext(AudioCtx)
}

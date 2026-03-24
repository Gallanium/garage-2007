import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../store/gameStore'
import { useAudio } from '../contexts/AudioContext'
import { Hexagon, MonitorPlay, Gem } from 'lucide-react'

interface NutsPromptModalProps {
  isOpen: boolean
  deficit: number
  onClose: () => void
  onOpenShop?: () => void
}

export default function NutsPromptModal({ isOpen, deficit, onClose, onOpenShop }: NutsPromptModalProps) {
  const { playSound } = useAudio()
  const watchRewardedVideo = useGameStore((s) => s.watchRewardedVideo)
  const canWatchVideo = useGameStore((s) => s.canWatchRewardedVideo())

  const handleClose = useCallback(() => {
    playSound('modal_close')
    onClose()
  }, [onClose, playSound])

  const handleWatchAd = useCallback(async () => {
    const success = await watchRewardedVideo()
    if (success) onClose()
  }, [watchRewardedVideo, onClose])

  const handleBuyNuts = useCallback(() => {
    onClose()
    onOpenShop?.()
  }, [onClose, onOpenShop])

  if (!isOpen) return null

  return createPortal(
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_300ms_ease-out]"
      onClick={handleClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Container (останов кликов внутри) */}
      <div 
        className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-5 mx-4 w-full max-w-sm text-center font-mono shadow-2xl shadow-orange-900/40 animate-[slideUp_300ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Крестик закрытия */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-lg leading-none p-1"
          aria-label="Закрыть"
        >
          ×
        </button>

        <h2 className="text-garage-yellow text-xs font-bold mb-3 text-center">
          Недостаточно гаек
        </h2>

        <p className="text-gray-300 text-[10px] text-center mb-4 flex items-center justify-center gap-1">
          Нужно ещё <span className="text-garage-yellow font-bold whitespace-nowrap">{deficit} <Hexagon className="inline-block w-3 h-3 align-text-bottom text-garage-yellow" /></span> для активации буста
        </p>

        <div className="flex flex-col gap-2">
          {canWatchVideo && (
            <button
              onClick={handleWatchAd}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold rounded transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <MonitorPlay className="w-3.5 h-3.5" /> Смотреть рекламу
            </button>
          )}

          <button
            onClick={handleBuyNuts}
            className="w-full py-2.5 bg-garage-yellow/20 hover:bg-garage-yellow/30 border border-garage-yellow/50 text-garage-yellow text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <Gem className="w-3.5 h-3.5" /> Купить гайки
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

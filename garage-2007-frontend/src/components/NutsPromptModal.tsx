// src/components/NutsPromptModal.tsx
import { useCallback } from 'react'
import { useGameStore } from '../store/gameStore'

interface NutsPromptModalProps {
  isOpen: boolean
  deficit: number
  onClose: () => void
}

export default function NutsPromptModal({ isOpen, deficit, onClose }: NutsPromptModalProps) {
  const watchRewardedVideo = useGameStore((s) => s.watchRewardedVideo)
  const canWatchVideo = useGameStore((s) => s.canWatchRewardedVideo())

  const handleWatchAd = useCallback(async () => {
    const success = await watchRewardedVideo()
    if (success) onClose()
  }, [watchRewardedVideo, onClose])

  // Заглушка для покупки гаек (Stage 14)
  const handleBuyNuts = useCallback(() => {
    if (import.meta.env.DEV) console.log('[Stage 14] purchaseNuts — не реализовано')
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-gray-900 border border-garage-yellow/50 rounded-lg p-5 mx-4 max-w-xs w-full font-mono">

        {/* Крестик закрытия */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-lg leading-none p-1"
          aria-label="Закрыть"
        >
          ×
        </button>

        <h2 className="text-garage-yellow text-xs font-bold mb-3 text-center">
          НЕДОСТАТОЧНО ГАЕК
        </h2>

        <p className="text-gray-300 text-[10px] text-center mb-4">
          Нужно ещё <span className="text-garage-yellow font-bold">{deficit} 🔩</span> для активации буста
        </p>

        <div className="flex flex-col gap-2">
          {canWatchVideo && (
            <button
              onClick={handleWatchAd}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold rounded transition-colors"
            >
              📺 Смотреть рекламу
            </button>
          )}

          <button
            onClick={handleBuyNuts}
            className="w-full py-2.5 bg-garage-yellow/20 hover:bg-garage-yellow/30 border border-garage-yellow/50 text-garage-yellow text-[10px] font-bold rounded transition-colors"
          >
            💎 Купить гайки
          </button>
        </div>
      </div>
    </div>
  )
}

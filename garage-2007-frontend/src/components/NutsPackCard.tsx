import { useCallback } from 'react'
import type { NutsPackId, NutsPack } from '@shared/types/purchase.js'

interface NutsPackCardProps {
  packId: NutsPackId
  pack: NutsPack
  isPurchasing: boolean
  onPurchase: (packId: NutsPackId) => void
  index: number
}

const PACK_THEMES: Record<NutsPackId, { cardBg: string; iconBg: string }> = {
  nuts_100: {
    cardBg: 'from-blue-950/80 to-cyan-950/60 border-blue-700/60',
    iconBg: 'bg-blue-700',
  },
  nuts_500: {
    cardBg: 'from-indigo-950/80 to-blue-950/60 border-indigo-700/60',
    iconBg: 'bg-indigo-700',
  },
  nuts_1500: {
    cardBg: 'from-emerald-950/80 to-teal-950/60 border-emerald-700/60',
    iconBg: 'bg-emerald-700',
  },
}

export default function NutsPackCard({ packId, pack, isPurchasing, onPurchase, index }: NutsPackCardProps) {
  const theme = PACK_THEMES[packId]

  const handleClick = useCallback(() => {
    if (!isPurchasing) onPurchase(packId)
  }, [isPurchasing, onPurchase, packId])

  return (
    <div
      className="animate-[slideUp_400ms_ease-out]"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'backwards' }}
    >
      <div className={`rounded-lg border p-3 bg-gradient-to-br ${theme.cardBg}`}>
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${theme.iconBg}`}>
            🔩
          </div>

          {/* Title + price */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                {pack.nuts} гаек
              </span>
              {packId === 'nuts_1500' && (
                <span className="bg-green-500 text-black text-[7px] font-bold px-1.5 py-0.5 rounded">
                  ЛУЧШАЯ ЦЕНА
                </span>
              )}
            </div>
            <span className="text-cyan-400 text-xs font-bold">
              {pack.stars} ⭐
            </span>
          </div>
        </div>

        {/* Buy button */}
        <button
          onClick={handleClick}
          disabled={isPurchasing}
          className={`w-full mt-2 py-2 rounded text-[10px] font-bold text-white bg-gradient-to-r from-blue-700 to-cyan-600 hover:from-blue-600 hover:to-cyan-500 transition-colors ${
            isPurchasing ? 'opacity-60 cursor-wait' : ''
          }`}
        >
          {isPurchasing ? 'Покупка...' : 'КУПИТЬ'}
        </button>
      </div>
    </div>
  )
}

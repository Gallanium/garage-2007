import { useState } from 'react'
import { useBalance, useNuts, formatLargeNumber } from '../store/gameStore'
import ShopModal from './ShopModal'

/**
 * Верхняя панель: баланс (₽) и гайки (🔩).
 */
export function GameHeader() {
  const balance = useBalance()
  const nuts = useNuts()
  const [showShop, setShowShop] = useState(false)

  return (
  <>
    <header className="relative p-3 bg-gray-950 border-b-2 border-orange-700/70 shadow-2xl shadow-orange-900/30 z-10">

      <div className="flex justify-between items-center">
        {/* Левая часть: Баланс */}
        <div className="flex flex-col">
          <span className="text-game-xs text-gray-400 uppercase tracking-wider font-mono">Баланс</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-garage-yellow font-mono tabular-nums tracking-tight">
              {formatLargeNumber(balance)}
            </span>
            <span className="text-sm text-garage-yellow/70 font-mono">₽</span>
          </div>
        </div>

        {/* Правая часть: Гайки (тап → ShopModal) */}
        <button
          onClick={() => setShowShop(true)}
          className="flex flex-col items-end border border-orange-700/40 hover:border-orange-500/60 rounded-lg transition-colors cursor-pointer px-2 py-1 -mr-2"
        >
          <span className="text-game-xs text-gray-400 uppercase tracking-wider font-mono">Гайки</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-orange-400 font-mono tabular-nums">
              {formatLargeNumber(nuts)}
            </span>
            <span className="text-base">🔩</span>
          </div>
        </button>
      </div>

    </header>

    <ShopModal isOpen={showShop} onClose={() => setShowShop(false)} />
  </>
  )
}

import { useState } from 'react'
import { useBalance, useNuts, formatLargeNumber } from '../store/gameStore'
import { Hexagon, Plus } from 'lucide-react'
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
    <header className="relative p-3 bg-gray-900 border-b-2 border-orange-700/70 shadow-2xl shadow-orange-900/30 z-10">

      <div className="flex justify-between items-center">
        {/* Левая часть: Баланс */}
        <div className="flex flex-col">
          <span className="text-game-xs text-gray-400 uppercase tracking-wider font-mono mb-0.5">Баланс</span>
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
          className="flex flex-col items-end group cursor-pointer text-right"
        >
          <span className="text-game-xs text-gray-400 uppercase tracking-wider font-mono mb-0.5 pr-0.5">Гайки</span>
          <div className="flex items-center gap-1.5">
            <div className="w-[22px] h-[22px] rounded-sm bg-gradient-to-b from-orange-400 to-orange-600 group-hover:from-orange-300 group-hover:to-orange-500 flex justify-center items-center text-white transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5 stroke-[4]" />
            </div>
            <span className="text-xl font-bold text-orange-400 font-mono tabular-nums tracking-tight">
              {formatLargeNumber(nuts)}
            </span>
            <Hexagon className="w-[20px] h-[20px] text-orange-400" />
          </div>
        </button>
      </div>

    </header>

    <ShopModal isOpen={showShop} onClose={() => setShowShop(false)} />
  </>
  )
}

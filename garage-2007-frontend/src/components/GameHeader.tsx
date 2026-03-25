import { useBalance, useNuts, formatLargeNumber, useGameStore } from '../store/gameStore'
import { Hexagon, Plus } from 'lucide-react'
import CountUp from 'react-countup'
import ShopModal from './ShopModal'

/**
 * Верхняя панель: баланс (₽) и гайки (🔩).
 */
export function GameHeader() {
  const balance = useBalance()
  const nuts = useNuts()
  const showShop = useGameStore((s) => s.showShopModal)

  return (
  <>
    <header className="relative p-3 bg-gray-900 border-b-2 border-orange-700/70 shadow-2xl shadow-orange-900/30 z-10">

      <div className="flex justify-between items-center">
        {/* Левая часть: Баланс */}
        <div className="flex flex-col">
          <span className="text-game-xs text-gray-400 uppercase tracking-wider font-mono mb-0.5">Баланс</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-garage-yellow font-mono tabular-nums tracking-tight">
              <CountUp start={0} end={balance} duration={1} preserveValue formattingFn={formatLargeNumber} />
            </span>
            <span className="text-sm text-garage-yellow/70 font-mono">₽</span>
          </div>
        </div>



        {/* Правая часть: Гайки (тап → ShopModal) */}
        <button
          onClick={() => useGameStore.setState({ showShopModal: true })}
          className="flex flex-col items-end group cursor-pointer text-right transition-transform active:scale-95"
        >
          <span className="text-game-xs text-gray-400 uppercase tracking-wider font-mono mb-0.5 pr-0.5">Гайки</span>
          <div className="flex items-end gap-1.5">
            <div className="w-[18px] h-[18px] mb-[1px] rounded-sm bg-gradient-to-b from-orange-400 to-orange-600 group-hover:from-orange-300 group-hover:to-orange-500 flex justify-center items-center text-white transition-colors shadow-sm">
              <Plus className="w-3 h-3 stroke-[4]" />
            </div>
            <span className="text-xl leading-none font-bold text-orange-400 font-mono tabular-nums tracking-tight">
              <CountUp start={0} end={nuts} duration={1} preserveValue formattingFn={formatLargeNumber} />
            </span>
            <Hexagon className="w-[18px] h-[18px] mb-[1px] text-orange-400" />
          </div>
        </button>
      </div>

    </header>

    <ShopModal isOpen={showShop} onClose={() => useGameStore.setState({ showShopModal: false })} />
  </>
  )
}

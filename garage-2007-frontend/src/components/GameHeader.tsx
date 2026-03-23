import { useState, useEffect } from 'react'
import { useBalance, useNuts, formatLargeNumber, useActiveEvent, GAME_EVENTS, type ActiveEvent } from '../store/gameStore'
import { Hexagon, Plus } from 'lucide-react'
import CountUp from 'react-countup'
import ShopModal from './ShopModal'

function EventPill({ event }: { event: ActiveEvent }) {
  const [expanded, setExpanded] = useState(true)
  
  useEffect(() => {
    const timer = setTimeout(() => setExpanded(false), 5000)
    return () => clearTimeout(timer)
  }, [event.id])

  const def = GAME_EVENTS[event.id]
  if (!def) return null

  const bgBorder = def.category === 'positive' ? 'bg-green-950/80 border-green-600/60 text-green-300' :
                   def.category === 'negative' ? 'bg-red-950/80 border-red-600/60 text-red-300' :
                   'bg-blue-950/80 border-blue-600/60 text-blue-300'

  return (
    <div 
      onClick={() => setExpanded(true)} 
      className={`transition-all duration-500 cursor-pointer overflow-hidden flex items-center border rounded-full backdrop-blur-md shadow-lg ${bgBorder} ${expanded ? 'max-w-[200px] px-2 py-1' : 'max-w-[36px] px-1.5 py-1 justify-center'}`}
      style={{ minWidth: expanded ? '120px' : '36px' }}
    >
      <span className="text-[14px] shrink-0 leading-none">{def.icon || '⚡'}</span>
      {expanded && (
         <div className="ml-1.5 whitespace-nowrap opacity-100 transition-opacity duration-300 flex flex-col items-start overflow-hidden">
            <span className="text-[9px] font-bold leading-tight font-mono">{def.name}</span>
         </div>
      )}
    </div>
  )
}

/**
 * Верхняя панель: баланс (₽) и гайки (🔩).
 */
export function GameHeader() {
  const balance = useBalance()
  const nuts = useNuts()
  const [showShop, setShowShop] = useState(false)
  const activeEvent = useActiveEvent()

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

        {/* Центральная часть: Уведомление о событии (компактная пилюля) */}
        {activeEvent && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20">
            <EventPill key={activeEvent.id} event={activeEvent} />
          </div>
        )}

        {/* Правая часть: Гайки (тап → ShopModal) */}
        <button
          onClick={() => setShowShop(true)}
          className="flex flex-col items-end group cursor-pointer text-right transition-transform active:scale-95"
        >
          <span className="text-game-xs text-gray-400 uppercase tracking-wider font-mono mb-0.5 pr-0.5">Гайки</span>
          <div className="flex items-center gap-1.5">
            <div className="w-[22px] h-[22px] rounded-sm bg-gradient-to-b from-orange-400 to-orange-600 group-hover:from-orange-300 group-hover:to-orange-500 flex justify-center items-center text-white transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5 stroke-[4]" />
            </div>
            <span className="text-xl font-bold text-orange-400 font-mono tabular-nums tracking-tight">
              <CountUp start={0} end={nuts} duration={1} preserveValue formattingFn={formatLargeNumber} />
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

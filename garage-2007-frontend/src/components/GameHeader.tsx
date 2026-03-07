import { useBalance, useNuts, formatLargeNumber } from '../store/gameStore'

/**
 * Верхняя панель: баланс (₽) и гайки (🔩).
 */
export function GameHeader() {
  const balance = useBalance()
  const nuts = useNuts()

  return (
    <header className="relative p-3 bg-gray-900/80 backdrop-blur-sm border-b-2 border-garage-rust shadow-lg z-10">

      {/* Центр: Название игры — абсолютно позиционирован, всегда в центре */}
      <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
        <div className="text-center">
          <h1 className="text-sm font-bold text-garage-yellow drop-shadow-lg font-mono">
            ГАРАЖ 2007
          </h1>
          <p className="text-[8px] text-gray-400">v0.1.0-MVP</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        {/* Левая часть: Баланс */}
        <div className="flex flex-col">
          <span className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-mono">Баланс</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-garage-yellow font-mono tabular-nums tracking-tight">
              {formatLargeNumber(balance)}
            </span>
            <span className="text-sm sm:text-base text-garage-yellow/70 font-mono">₽</span>
          </div>
        </div>

        {/* Правая часть: Гайки */}
        <div className="flex flex-col items-end">
          <span className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-mono">Гайки</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-bold text-orange-400 font-mono tabular-nums">
              {formatLargeNumber(nuts)}
            </span>
            <span className="text-base">🔩</span>
          </div>
        </div>
      </div>

    </header>
  )
}

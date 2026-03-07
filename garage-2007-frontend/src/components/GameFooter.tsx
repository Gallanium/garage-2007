import {
  useClickValue,
  useMomentaryClickIncome,
  usePassiveIncome,
  useBalance,
  useGarageLevel,
  useNextLevelCost,
  useGarageProgress,
  usePendingMilestoneInfo,
  useGameStore,
  GARAGE_LEVEL_NAMES,
  formatLargeNumber,
} from '../store/gameStore'

/**
 * Нижняя панель: статистика доходов, прогресс-бар уровня гаража, кнопка сброса.
 */
export function GameFooter() {
  const clickValue = useClickValue()
  const momentaryClickIncome = useMomentaryClickIncome()
  const passiveIncomePerSecond = usePassiveIncome()
  const balance = useBalance()
  const garageLevel = useGarageLevel()
  const nextLevelCost = useNextLevelCost()
  const garageProgress = useGarageProgress()
  const milestoneInfo = usePendingMilestoneInfo()
  const resetGame = useGameStore((s) => s.resetGame)

  return (
    <footer className="flex-shrink-0 bg-gray-900/90 backdrop-blur-sm border-t-2 border-garage-rust shadow-2xl">

      <div className="grid grid-cols-3 gap-1.5 p-3">

        {/* Доход за клик */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-2 border border-garage-yellow/30 shadow-md">
          <p className="text-game-xs sm:text-game-sm text-gray-400 mb-1 font-mono uppercase">За клик</p>
          <div className="flex items-baseline gap-0.5">
            <p className="text-base sm:text-lg font-bold text-garage-yellow font-mono">
              {formatLargeNumber(clickValue)}
            </p>
            <span className="text-[9px] sm:text-[11px] text-garage-yellow/70 font-mono">₽</span>
          </div>
        </div>

        {/* Моментальный доход */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-2 border border-blue-400/30 shadow-md">
          <p className="text-game-xs sm:text-game-sm text-gray-400 mb-1 font-mono uppercase">Момент.</p>
          <div className="flex items-baseline gap-0.5">
            <p className="text-base sm:text-lg font-bold text-blue-300 font-mono">
              {formatLargeNumber(momentaryClickIncome)}
            </p>
            <span className="text-[9px] sm:text-[11px] text-blue-300/70 font-mono">₽/с</span>
          </div>
        </div>

        {/* Пассивный доход */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-2 border border-green-400/30 shadow-md">
          <p className="text-game-xs sm:text-game-sm text-gray-400 mb-1 font-mono uppercase">Пассив.</p>
          <div className="flex items-baseline gap-0.5">
            <p className="text-base sm:text-lg font-bold text-green-300 font-mono">
              {passiveIncomePerSecond.toFixed(1)}
            </p>
            <span className="text-[9px] sm:text-[11px] text-green-300/70 font-mono">₽/с</span>
          </div>
        </div>

      </div>

      {/* Прогресс уровня гаража + кнопка сброса */}
      <div className="px-3 pb-3 space-y-2">

        <div>
          <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-garage-rust to-garage-yellow h-full transition-all duration-500"
              style={{ width: `${Math.round(garageProgress * 100)}%` }}
            />
          </div>
          <p className="text-game-xs sm:text-game-sm text-gray-500 mt-1 font-mono">
            {milestoneInfo
              ? `🔓 Апгрейд: «${GARAGE_LEVEL_NAMES[milestoneInfo.level as keyof typeof GARAGE_LEVEL_NAMES]}» — ур.${milestoneInfo.level}`
              : nextLevelCost
                ? `До ур.${garageLevel + 1}: ${formatLargeNumber(Math.max(0, nextLevelCost - balance))}₽ (${Math.round(garageProgress * 100)}%)`
                : 'Максимальный уровень!'}
          </p>
        </div>

        <div className="flex justify-end items-center gap-2">
          <button
            onClick={resetGame}
            className="bg-red-900/50 hover:bg-red-800/70
                       text-red-300 text-game-xs sm:text-game-sm font-medium py-1.5 px-2 rounded
                       transition-colors duration-200
                       border border-red-700/50 font-mono
                       active:scale-95 transform shrink-0"
            title="Сбросить игру к начальным значениям"
          >
            🔄 Сброс
          </button>
        </div>

      </div>

    </footer>
  )
}

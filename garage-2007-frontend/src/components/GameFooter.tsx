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
  useActiveBoostType,
  useActiveEvent,
  GAME_EVENTS,
} from '../store/gameStore'
import type { BoostType, EventCategory } from '../store/gameStore'
import { Unlock, RotateCcw } from 'lucide-react'

const BOOST_COLORS: Record<BoostType, { text: string; glow: string }> = {
  turbo:     { text: 'text-purple-300', glow: 'drop-shadow-[0_0_6px_rgba(192,132,252,0.6)]' },
  income_2x: { text: 'text-amber-300',  glow: 'drop-shadow-[0_0_6px_rgba(252,211,77,0.6)]' },
  income_3x: { text: 'text-red-300',    glow: 'drop-shadow-[0_0_6px_rgba(252,165,165,0.6)]' },
}

const EVENT_COLORS: Record<EventCategory, { text: string; glow: string }> = {
  positive: { text: 'text-green-300', glow: 'drop-shadow-[0_0_6px_rgba(134,239,172,0.6)]' },
  negative: { text: 'text-red-400',   glow: 'drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]' },
  neutral:  { text: 'text-blue-300',  glow: 'drop-shadow-[0_0_6px_rgba(147,197,253,0.6)]' },
}

/**
 * Нижняя панель: статистика доходов, прогресс-бар уровня гаража, кнопка сброса.
 */
export function GameFooter() {
  const clickValue = useClickValue()
  const momentaryClickIncome = useMomentaryClickIncome()
  const passiveIncomePerSecond = usePassiveIncome()
  const activeBoostType = useActiveBoostType()
  const getActiveMultiplier = useGameStore((s) => s.getActiveMultiplier)
  const getEventMultiplier = useGameStore((s) => s.getEventMultiplier)
  const activeEvent = useActiveEvent()

  const boostClickMultiplier = activeBoostType ? getActiveMultiplier('click') : 1
  const boostIncomeMultiplier = activeBoostType ? getActiveMultiplier('income') : 1
  const eventClickMultiplier = activeEvent ? getEventMultiplier('click') : 1
  const eventIncomeMultiplier = activeEvent ? getEventMultiplier('income') : 1
  const clickMultiplier = boostClickMultiplier * eventClickMultiplier
  const incomeMultiplier = boostIncomeMultiplier * eventIncomeMultiplier

  // Цвет: приоритет буст > событие
  const activeEventDef = activeEvent ? GAME_EVENTS[activeEvent.id] : null
  const clickBoostColors = activeBoostType ? BOOST_COLORS[activeBoostType] : null
  const passiveBoostColors = activeBoostType && activeBoostType !== 'turbo' ? BOOST_COLORS[activeBoostType] : null
  const clickEventColors = !clickBoostColors && activeEventDef && activeEventDef.effect.scope === 'click'
    ? EVENT_COLORS[activeEventDef.category] : null
  const passiveEventColors = !passiveBoostColors && activeEventDef && activeEventDef.effect.scope === 'income'
    ? EVENT_COLORS[activeEventDef.category] : null
  const balance = useBalance()
  const garageLevel = useGarageLevel()
  const nextLevelCost = useNextLevelCost()
  const garageProgress = useGarageProgress()
  const milestoneInfo = usePendingMilestoneInfo()
  const resetGame = useGameStore((s) => s.resetGame)

  return (
    <footer
      className="flex-shrink-0 bg-gray-900 border-t-2 border-orange-700/70 shadow-2xl shadow-orange-900/30"
      style={{ paddingBottom: 'var(--tg-safe-area-bottom)' }}
    >

      <div className="grid grid-cols-3 gap-1.5 p-3">

        {/* Доход за клик */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-2 border border-gray-700/50">
          <p className="text-game-xs text-gray-400 mb-1 font-mono uppercase">За клик</p>
          <div className="flex items-baseline gap-0.5">
            {(() => {
              const colors = clickBoostColors ?? clickEventColors
              return <>
                <p className={`text-base font-bold font-mono ${colors ? `${colors.text} ${colors.glow}` : 'text-garage-yellow'}`}>
                  {formatLargeNumber(clickValue * clickMultiplier)}
                </p>
                <span className={`text-[9px] font-mono ${colors ? colors.text : 'text-garage-yellow/70'}`}>₽</span>
              </>
            })()}
          </div>
        </div>

        {/* Моментальный доход */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-2 border border-gray-700/50">
          <p className="text-game-xs text-gray-400 mb-1 font-mono uppercase">Момент.</p>
          <div className="flex items-baseline gap-0.5">
            <p className="text-base font-bold text-blue-300 font-mono">
              {formatLargeNumber(momentaryClickIncome)}
            </p>
            <span className="text-[9px] text-blue-300/70 font-mono">₽/с</span>
          </div>
        </div>

        {/* Пассивный доход */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-2 border border-gray-700/50">
          <p className="text-game-xs text-gray-400 mb-1 font-mono uppercase">Пассив.</p>
          <div className="flex items-baseline gap-0.5">
            {(() => {
              const colors = passiveBoostColors ?? passiveEventColors
              return <>
                <p className={`text-base font-bold font-mono ${colors ? `${colors.text} ${colors.glow}` : 'text-green-300'}`}>
                  {(passiveIncomePerSecond * incomeMultiplier).toFixed(1)}
                </p>
                <span className={`text-[9px] font-mono ${colors ? colors.text : 'text-green-300/70'}`}>₽/с</span>
              </>
            })()}
          </div>
        </div>

      </div>

      {/* Прогресс уровня гаража + кнопка сброса */}
      <div className="px-3 pb-3 space-y-2">

        <div>
          <div className="bg-gray-800 rounded-full h-2 overflow-hidden relative">
            <div
              className="absolute top-0 left-0 bg-gradient-to-r from-garage-rust to-garage-yellow h-full transition-all duration-500"
              style={{ width: `${Math.round(garageProgress * 100)}%` }}
            />
          </div>
          <p className="text-game-xs text-gray-500 mt-1 font-mono flex items-center gap-1">
            {milestoneInfo
              ? <><Unlock className="w-3 h-3 text-cyan-400" /> Апгрейд: «{GARAGE_LEVEL_NAMES[milestoneInfo.level as keyof typeof GARAGE_LEVEL_NAMES]}» — ур.{milestoneInfo.level}</>
              : nextLevelCost
                ? `До ур.${garageLevel + 1}: ${formatLargeNumber(Math.max(0, nextLevelCost - balance))}₽ (${Math.round(garageProgress * 100)}%)`
                : 'Максимальный уровень!'}
          </p>
        </div>

        <div className="flex justify-end items-center gap-2">
          <button
            onClick={resetGame}
            className="bg-gradient-to-r from-red-900/60 to-red-800/40 hover:from-red-800/60 hover:to-red-700/40
                       text-red-300 text-game-xs font-medium py-1.5 px-2 rounded
                       transition-colors duration-200
                       border border-red-700/50 font-mono shrink-0"
            title="Сбросить игру к начальным значениям"
          >
            <RotateCcw className="inline-block w-3 h-3 align-text-bottom mr-1" /> Сброс
          </button>
        </div>

      </div>

    </footer>
  )
}

import { useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { formatLargeNumber } from '../store/gameStore'
import { useAudio } from '../contexts/AudioContext'

interface WorkerCardProps {
  icon: React.ReactNode
  title: string
  incomeLabel: string
  currentLevel: number
  maxLevel: number
  cost: number
  canAfford: boolean
  onPurchase: () => Promise<boolean> | boolean | void
  discountPercent?: number
}

const WorkerCard: React.FC<WorkerCardProps> = ({
  icon,
  title,
  incomeLabel,
  currentLevel,
  maxLevel,
  cost,
  canAfford,
  onPurchase,
  discountPercent = 0,
}) => {
  const isMaxed = currentLevel >= maxLevel
  const formattedCost = formatLargeNumber(cost)
  // Вычисляем старую цену
  const originalCost = discountPercent > 0 ? (cost / (1 - discountPercent / 100)) : cost
  const formattedOriginalCost = formatLargeNumber(originalCost)
  const { playSound } = useAudio()

  const handleClick = useCallback(async () => {
    if (canAfford && !isMaxed) {
      const ok = await onPurchase()
      if (ok) playSound('purchase', 'WorkerCard.purchase')
    }
  }, [canAfford, isMaxed, onPurchase, playSound])

  // Рендер сегментированного бара
  const renderSegments = () => {
    const segments = []
    for (let i = 0; i < maxLevel; i++) {
      const isFilled = i < currentLevel
      segments.push(
        <div
          key={i}
          className={`h-[6px] rounded-sm flex-1 transition-colors duration-300 ${
            isFilled 
              ? 'bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_5px_rgba(249,115,22,0.4)]' 
              : 'bg-black/50 border border-gray-700/50'
          }`}
        />
      )
    }
    return (
      <div className="flex gap-1 mb-3 mt-2">
        {segments}
      </div>
    )
  }

  return (
    <div
      className={`
        bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3
        ${!isMaxed && !canAfford ? 'opacity-50' : ''}
      `}
    >
      {/* ---- Верхняя строка: иконка + текст ---- */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-lg bg-blue-800 flex items-center justify-center text-white text-lg flex-shrink-0 shadow-inner">
            <span>{icon}</span>
          </div>
          {discountPercent > 0 && (
            <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-black text-[8px] font-bold px-1 py-0.5 rounded shadow-[0_0_8px_rgba(34,197,94,0.8)] border border-green-300 z-10 animate-[pulse_2s_infinite]">
              -{discountPercent}%
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-white font-mono truncate">{title}</h3>
          <p className="text-gray-400 text-[9px] font-mono mt-0.5 truncate">
            {incomeLabel}
          </p>
        </div>
      </div>

      {/* ---- Сегментированный бар ---- */}
      {renderSegments()}

      {/* ---- Нижняя часть: Уровень и Кнопка ---- */}
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-[10px] font-mono font-bold">
          {currentLevel}/{maxLevel}
        </span>

        {isMaxed ? (
          <div className="px-2 py-1.5 flex items-center justify-center gap-1.5 min-w-[80px]">
            <CheckCircle2 className="w-4 h-4 text-garage-yellow" />
            <span className="text-[10px] font-bold text-garage-yellow font-mono">
              Максимум
            </span>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canAfford}
            onClick={handleClick}
            className={`
              px-4 py-1.5 rounded text-[10px] font-bold min-w-[80px]
              transition-all duration-150
              ${
                canAfford
                  ? 'bg-gradient-to-r from-blue-700 to-cyan-600 hover:from-blue-600 hover:to-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.6)] active:scale-[0.95]'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {discountPercent > 0 ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="text-gray-400/80 line-through text-[8px] decoration-red-500/80">{formattedOriginalCost} ₽</span>
                <span>{formattedCost} ₽</span>
              </span>
            ) : (
              <>{formattedCost} ₽</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default WorkerCard

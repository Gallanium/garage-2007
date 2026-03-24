import { useCallback } from 'react'
import { formatLargeNumber } from '../store/gameStore'
import { useAudio } from '../contexts/AudioContext'

// ============================================
// ЦВЕТОВЫЕ ТЕМЫ КАРТОЧЕК
// ============================================

const CARD_THEMES = {
  orange: {
    icon: 'bg-orange-700',
    btn: 'from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400',
    glow: 'shadow-[0_0_12px_rgba(234,88,12,0.6)]',
  },
  purple: {
    icon: 'bg-purple-700',
    btn: 'from-purple-700 to-violet-600 hover:from-purple-600 hover:to-violet-500',
    glow: 'shadow-[0_0_12px_rgba(147,51,234,0.6)]',
  },
  blue: {
    icon: 'bg-blue-700',
    btn: 'from-blue-700 to-cyan-600 hover:from-blue-600 hover:to-cyan-500',
    glow: 'shadow-[0_0_12px_rgba(37,99,235,0.6)]',
  },
  green: {
    icon: 'bg-green-700',
    btn: 'from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500',
    glow: 'shadow-[0_0_12px_rgba(22,163,74,0.6)]',
  },
  neutral: {
    icon: 'bg-gray-700',
    btn: 'from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400',
    glow: 'shadow-[0_0_12px_rgba(75,85,99,0.5)]',
  },
} as const

type CardTheme = keyof typeof CARD_THEMES

/**
 * Пропсы компонента UpgradeCard
 */
interface UpgradeCardProps {
  /** Название апгрейда (например, "Улучшить доход") */
  title: string
  /** Описание эффекта апгрейда */
  description: string
  /** Текущий уровень апгрейда */
  currentLevel: number
  /** Стоимость следующего уровня в рублях */
  cost: number
  /** Может ли игрок позволить себе покупку */
  canAfford: boolean
  /** Коллбэк при нажатии кнопки "Купить" */
  onPurchase: () => void
  /** Опциональная иконка (emoji) */
  icon?: React.ReactNode
  /** Максимальный уровень (если задан, показывает "MAX" при достижении) */
  maxLevel?: number
  /** Цветовая тема карточки */
  colorTheme?: CardTheme
  /** Процент скидки (Например: 50) */
  discountPercent?: number
}

/**
 * Карточка апгрейда / работника.
 */
const UpgradeCard: React.FC<UpgradeCardProps> = ({
  title,
  description,
  currentLevel,
  cost,
  canAfford,
  onPurchase,
  icon,
  maxLevel,
  colorTheme = 'orange',
  discountPercent = 0,
}) => {
  const isMaxed = maxLevel != null && currentLevel >= maxLevel
  const theme = CARD_THEMES[colorTheme]
  const { playSound } = useAudio()

  const formattedCost = formatLargeNumber(cost)
  // Если есть скидка, вычисляем оригинальную цену для зачеркивания
  const originalCost = discountPercent > 0 ? (cost / (1 - discountPercent / 100)) : cost
  const formattedOriginalCost = formatLargeNumber(originalCost)

  const handleClick = useCallback(() => {
    if (canAfford && !isMaxed) {
      onPurchase()
      playSound('purchase')
    }
  }, [canAfford, isMaxed, onPurchase, playSound])

  return (
    <div
      className={`
        bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3
        ${!isMaxed && !canAfford ? 'opacity-50' : ''}
      `}
    >
      {/* ---- Верхняя строка: иконка + текст ---- */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative">
          {icon && (
            <div className={`w-10 h-10 rounded-lg ${theme.icon} flex items-center justify-center text-white text-lg flex-shrink-0`}>
              <span>{icon}</span>
            </div>
          )}
          {discountPercent > 0 && (
            <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-black text-[8px] font-bold px-1 py-0.5 rounded shadow-[0_0_8px_rgba(34,197,94,0.8)] border border-green-300 z-10 animate-[pulse_2s_infinite]">
              -{discountPercent}%
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white font-mono">{title}</h3>
            <span className="text-gray-500 text-[9px] font-mono">
              Ур: {currentLevel}{maxLevel != null ? `/${maxLevel}` : ''}
            </span>
          </div>
          <p className="text-gray-400 text-[9px] font-mono mt-0.5">{description}</p>
        </div>
      </div>

      {/* ---- Кнопка ---- */}
      {isMaxed ? (
        <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30">
          Максимальное количество
        </div>
      ) : (
        <button
          type="button"
          disabled={!canAfford}
          onClick={handleClick}
          className={`
            w-full py-2 rounded text-[10px] font-bold
            transition-all duration-150
            ${
              canAfford
                ? `bg-gradient-to-r ${theme.btn} text-white active:scale-[0.97] ${theme.glow}`
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
  )
}

export default UpgradeCard

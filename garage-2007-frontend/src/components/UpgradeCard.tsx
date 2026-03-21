import { useCallback } from 'react'
import { formatLargeNumber } from '../store/gameStore'

// ============================================
// ЦВЕТОВЫЕ ТЕМЫ КАРТОЧЕК
// ============================================

const CARD_THEMES = {
  orange: {
    card: 'from-orange-950/80 to-amber-950/60 border-orange-700/60',
    icon: 'bg-orange-700',
    btn: 'from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400',
  },
  purple: {
    card: 'from-purple-950/80 to-violet-950/60 border-purple-700/60',
    icon: 'bg-purple-700',
    btn: 'from-purple-700 to-violet-600 hover:from-purple-600 hover:to-violet-500',
  },
  blue: {
    card: 'from-blue-950/80 to-cyan-950/60 border-blue-700/60',
    icon: 'bg-blue-700',
    btn: 'from-blue-700 to-cyan-600 hover:from-blue-600 hover:to-cyan-500',
  },
  green: {
    card: 'from-green-950/80 to-emerald-950/60 border-green-700/60',
    icon: 'bg-green-700',
    btn: 'from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500',
  },
  neutral: {
    card: 'from-gray-900/80 to-gray-800/60 border-gray-700/40',
    icon: 'bg-gray-700',
    btn: 'from-gray-600 to-gray-500 hover:from-gray-500 hover:to-gray-400',
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
  icon?: string
  /** Максимальный уровень (если задан, показывает "MAX" при достижении) */
  maxLevel?: number
  /** Цветовая тема карточки */
  colorTheme?: CardTheme
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
}) => {
  const isMaxed = maxLevel != null && currentLevel >= maxLevel
  const theme = CARD_THEMES[colorTheme]

  const formattedCost = formatLargeNumber(cost)

  const handleClick = useCallback(() => {
    if (canAfford && !isMaxed) onPurchase()
  }, [canAfford, isMaxed, onPurchase])

  return (
    <div
      className={`
        bg-gradient-to-br ${theme.card} rounded-lg border p-3
        ${!isMaxed && !canAfford ? 'opacity-50' : ''}
      `}
    >
      {/* ---- Верхняя строка: иконка + текст ---- */}
      <div className="flex items-center gap-3 mb-2">
        {icon && (
          <div className={`w-10 h-10 rounded-lg ${theme.icon} flex items-center justify-center text-white text-lg flex-shrink-0`}>
            <span>{icon}</span>
          </div>
        )}
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
          MAX
        </div>
      ) : (
        <button
          type="button"
          disabled={!canAfford}
          onClick={handleClick}
          className={`
            w-full py-2 rounded text-[10px] font-bold
            transition-colors
            ${
              canAfford
                ? `bg-gradient-to-r ${theme.btn} text-white`
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <span className="text-cyan-400">{formattedCost}&nbsp;₽</span>
        </button>
      )}
    </div>
  )
}

export default UpgradeCard

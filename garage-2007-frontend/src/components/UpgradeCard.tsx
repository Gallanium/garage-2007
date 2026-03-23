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
  },
  purple: {
    icon: 'bg-purple-700',
    btn: 'from-purple-700 to-violet-600 hover:from-purple-600 hover:to-violet-500',
  },
  blue: {
    icon: 'bg-blue-700',
    btn: 'from-blue-700 to-cyan-600 hover:from-blue-600 hover:to-cyan-500',
  },
  green: {
    icon: 'bg-green-700',
    btn: 'from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500',
  },
  neutral: {
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
  icon?: React.ReactNode
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
  const { playSound } = useAudio()

  const formattedCost = formatLargeNumber(cost)

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
          Максимальное количество
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
          {formattedCost}&nbsp;₽
        </button>
      )}
    </div>
  )
}

export default UpgradeCard

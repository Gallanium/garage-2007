import { useCallback } from 'react'
import { formatLargeNumber } from '../store/gameStore'

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
}) => {
  const isMaxed = maxLevel != null && currentLevel >= maxLevel

  const formattedCost = formatLargeNumber(cost)

  const handleClick = useCallback(() => {
    if (canAfford && !isMaxed) onPurchase()
  }, [canAfford, isMaxed, onPurchase])

  return (
    <div
      className={`
        bg-gray-800 rounded-lg p-3
        border border-gray-700
        hover:border-gray-600 transition-colors duration-200
        ${!isMaxed && !canAfford ? 'opacity-50' : ''}
      `}
    >
      {/* ---- Заголовок ---- */}
      <div className="flex items-center gap-2 mb-1.5">
        {icon && <span className="text-xl">{icon}</span>}
        <h3 className="font-bold text-sm sm:text-base text-white font-mono">{title}</h3>
      </div>

      {/* ---- Описание ---- */}
      <p className="text-[10px] sm:text-xs text-gray-400 mb-2 font-mono">{description}</p>

      {/* ---- Нижняя строка: уровень + кнопка ---- */}
      <div className="flex justify-between items-center">
        <span className="text-[9px] sm:text-[11px] text-yellow-400 font-mono">
          Ур: {currentLevel}{maxLevel != null ? `/${maxLevel}` : ''}
        </span>

        {isMaxed ? (
          <span className="px-3 py-1.5 rounded text-[10px] sm:text-xs font-mono font-medium bg-green-700 text-green-200">
            MAX
          </span>
        ) : (
          <button
            type="button"
            disabled={!canAfford}
            onClick={handleClick}
            className={`
              px-2 py-1.5 rounded text-[10px] sm:text-xs font-mono font-medium
              transition-colors duration-200
              active:scale-95 transform
              ${
                canAfford
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {formattedCost}&nbsp;₽
          </button>
        )}
      </div>
    </div>
  )
}

export default UpgradeCard

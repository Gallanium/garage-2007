import { useCallback } from 'react'

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
}

/**
 * Карточка апгрейда / работника.
 *
 * Универсальный компонент для экрана апгрейдов и найма работников.
 * Визуально затемняется, когда у игрока недостаточно средств.
 * Стилистика соответствует гаражной палитре проекта (gray-800, yellow-400, blue-600).
 */
const UpgradeCard: React.FC<UpgradeCardProps> = ({
  title,
  description,
  currentLevel,
  cost,
  canAfford,
  onPurchase,
  icon,
}) => {
  /** Форматирование стоимости с разделителями тысяч */
  const formattedCost = cost.toLocaleString('ru-RU')

  /** Мемоизированный обработчик — не создаёт лишних замыканий при ре-рендере */
  const handleClick = useCallback(() => {
    if (canAfford) onPurchase()
  }, [canAfford, onPurchase])

  return (
    <div
      className={`
        bg-gray-800 rounded-lg p-4
        border border-gray-700
        hover:border-gray-600 transition-colors duration-200
        ${canAfford ? '' : 'opacity-50'}
      `}
    >
      {/* ---- Заголовок ---- */}
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-2xl">{icon}</span>}
        <h3 className="font-bold text-lg text-white font-mono">{title}</h3>
      </div>

      {/* ---- Описание ---- */}
      <p className="text-sm text-gray-400 mb-3 font-mono">{description}</p>

      {/* ---- Нижняя строка: уровень + кнопка ---- */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-yellow-400 font-mono">
          Уровень: {currentLevel}
        </span>

        <button
          type="button"
          disabled={!canAfford}
          onClick={handleClick}
          className={`
            px-4 py-2 rounded text-sm font-mono font-medium
            transition-colors duration-200
            active:scale-95 transform
            ${
              canAfford
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Купить за {formattedCost}&nbsp;₽
        </button>
      </div>
    </div>
  )
}

export default UpgradeCard
import { useCallback } from 'react'

/**
 * Описание одного таба
 */
export interface TabItem {
  /** Уникальный идентификатор таба */
  id: string
  /** Текстовая метка */
  label: string
  /** Опциональная иконка (emoji) */
  icon?: string
}

/**
 * Пропсы компонента TabNavigation
 */
interface TabNavigationProps {
  /** Идентификатор активного таба */
  activeTab: string
  /** Коллбэк при смене таба */
  onTabChange: (tab: string) => void
  /** Массив табов для отображения */
  tabs: TabItem[]
}

/**
 * Навигационная панель табов.
 *
 * Используется в нижней части экрана для переключения между разделами:
 * Апгрейды | Работники | Декор | Достижения | Лиги (GDD раздел 8.3).
 */
const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  tabs,
}) => {
  const handleClick = useCallback(
    (id: string) => () => onTabChange(id),
    [onTabChange],
  )

  return (
    <nav className="flex gap-1 bg-gray-950 p-1.5 rounded-lg border border-orange-700/30">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab

        return (
          <button
            key={tab.id}
            type="button"
            onClick={handleClick(tab.id)}
            className={`
              flex-1 flex flex-col items-center gap-0.5
              px-1 py-1.5 rounded text-game-xs font-mono font-medium
              transition-colors duration-200
              ${
                isActive
                  ? 'bg-gradient-to-r from-orange-700 to-amber-600 text-white'
                  : 'bg-gray-900 text-gray-500 [@media(hover:hover)]:hover:bg-gray-800'
              }
            `}
          >
            {tab.icon && <span className="text-base">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default TabNavigation
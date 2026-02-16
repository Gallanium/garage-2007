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
    <nav className="flex gap-2 bg-gray-900 p-2 rounded-lg">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab

        return (
          <button
            key={tab.id}
            type="button"
            onClick={handleClick(tab.id)}
            className={`
              px-4 py-2 rounded text-sm font-mono font-medium
              transition-colors duration-200
              ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }
            `}
          >
            {tab.icon && <span className="mr-1">{tab.icon}</span>}
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

export default TabNavigation
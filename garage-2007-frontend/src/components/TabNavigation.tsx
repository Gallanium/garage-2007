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
  icon?: React.ReactNode
  /** Уведомление на табе */
  badge?: number
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
    <nav className="flex gap-1 p-1.5 rounded-lg border border-orange-700/30">
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
              transition-all duration-200 active:scale-95
              ${
                isActive
                  ? 'bg-gradient-to-r from-orange-700 to-amber-600 text-white'
                  : 'bg-gray-900 text-gray-500 [@media(hover:hover)]:hover:bg-gray-800'
              }
            `}
          >
            {tab.icon && (
              <span className="relative flex items-center justify-center">
                {tab.icon}
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute top-0 right-0 translate-x-[60%] -translate-y-[60%] bg-gradient-to-br from-orange-400 to-orange-500 text-black text-[9px] font-bold px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-sm animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)] z-10">
                    {tab.badge}
                  </span>
                )}
              </span>
            )}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default TabNavigation
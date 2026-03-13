// src/components/EventBanner.tsx
import { useEffect, useRef, useState } from 'react'
import { useActiveEvent, useGameStore, GAME_EVENTS, BANNER_EXPAND_DURATION_MS } from '../store/gameStore'
import type { EventCategory } from '../store/gameStore'

const CATEGORY_STYLES: Record<EventCategory, { border: string; text: string; icon_bg: string }> = {
  positive: {
    border: 'border-green-600/60',
    text: 'text-green-300',
    icon_bg: 'bg-green-900/60',
  },
  negative: {
    border: 'border-red-600/60',
    text: 'text-red-300',
    icon_bg: 'bg-red-900/60',
  },
  neutral: {
    border: 'border-blue-600/60',
    text: 'text-blue-300',
    icon_bg: 'bg-blue-900/60',
  },
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function EventBanner() {
  const activeEvent = useActiveEvent()
  const clearEvent = useGameStore(s => s.clearEvent)
  const [remaining, setRemaining] = useState(0)
  const [isExpanded, setIsExpanded] = useState(true)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Запуск таймера авто-сворачивания
  const scheduleCollapse = () => {
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
    expandTimerRef.current = setTimeout(() => {
      setIsExpanded(false)
    }, BANNER_EXPAND_DURATION_MS)
  }

  // При новом событии — развернуть и запустить таймер
  useEffect(() => {
    if (!activeEvent) return
    setIsExpanded(true)
    scheduleCollapse()
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id])

  // Countdown таймер
  useEffect(() => {
    if (!activeEvent) return

    const update = () => {
      const ms = activeEvent.expiresAt - Date.now()
      if (ms <= 0) {
        clearEvent()
        return
      }
      setRemaining(ms)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [activeEvent, clearEvent])

  if (!activeEvent) return null
  const def = GAME_EVENTS[activeEvent.id]
  if (!def) return null

  const styles = CATEGORY_STYLES[def.category]

  const handleClick = () => {
    if (!isExpanded) {
      setIsExpanded(true)
      scheduleCollapse()
    }
  }

  return (
    <div
      className={`
        absolute top-2 left-3 z-10
        transition-[right] duration-500 ease-in-out
        animate-[slideUp_400ms_ease-out]
        ${isExpanded ? 'right-[88px]' : 'right-auto'}
      `}
      style={{ animationFillMode: 'backwards' }}
    >
      <div
        className={`
          bg-gray-950 border ${styles.border} font-mono shadow-lg
          flex items-center gap-2
          transition-all duration-500 ease-in-out
          ${isExpanded
            ? 'rounded-lg px-3 py-2 cursor-default'
            : 'rounded-full px-2.5 py-1.5 cursor-pointer'
          }
        `}
        onClick={handleClick}
      >
        {/* Иконка — всегда видна */}
        <div className={`
          rounded-md flex items-center justify-center flex-shrink-0
          transition-all duration-500 ease-in-out
          ${isExpanded ? 'w-8 h-8 text-base' : 'w-6 h-6 text-sm'}
          ${styles.icon_bg}
        `}>
          {def.icon}
        </div>

        {/* Название + описание — только в развёрнутом */}
        {isExpanded && (
          <div className="flex-1 min-w-0 animate-[fadeIn_300ms_ease-out]">
            <p className={`text-[10px] font-bold ${styles.text} leading-tight truncate`}>
              {def.name}
            </p>
            <p className="text-gray-500 text-[8px] leading-tight mt-0.5 truncate">
              {def.description}
            </p>
          </div>
        )}

        {/* Таймер — всегда виден */}
        <div className={`
          font-bold ${styles.text} flex-shrink-0 tabular-nums
          transition-all duration-500 ease-in-out
          ${isExpanded ? 'text-[10px]' : 'text-[9px]'}
        `}>
          {isExpanded ? '⏱ ' : ''}{formatCountdown(remaining)}
        </div>
      </div>
    </div>
  )
}

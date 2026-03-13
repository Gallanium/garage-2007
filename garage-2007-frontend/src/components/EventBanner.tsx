// src/components/EventBanner.tsx
import { useEffect, useRef, useState } from 'react'
import { useActiveEvent, useGameStore, GAME_EVENTS, BANNER_EXPAND_DURATION_MS } from '../store/gameStore'
import type { EventCategory, EventDefinition } from '../store/gameStore'

const DISMISS_DURATION_MS = 400

const CATEGORY_STYLES: Record<EventCategory, { border: string; text: string; icon_bg: string }> = {
  positive: { border: 'border-green-600/60', text: 'text-green-300', icon_bg: 'bg-green-900/60' },
  negative: { border: 'border-red-600/60',   text: 'text-red-300',   icon_bg: 'bg-red-900/60'   },
  neutral:  { border: 'border-blue-600/60',  text: 'text-blue-300',  icon_bg: 'bg-blue-900/60'  },
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

  // Локальная копия события — сохраняется во время dismiss-анимации
  const [displayedDef, setDisplayedDef] = useState<EventDefinition | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDismissing, setIsDismissing] = useState(false)

  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleCollapse = () => {
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
    expandTimerRef.current = setTimeout(() => setIsExpanded(false), BANNER_EXPAND_DURATION_MS)
  }

  // Реакция на появление нового события
  useEffect(() => {
    if (!activeEvent) return
    const def = GAME_EVENTS[activeEvent.id]
    if (!def) return

    // Отменить любой текущий dismiss
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)

    setDisplayedDef(def)
    setIsDismissing(false)
    setIsExpanded(true)
    scheduleCollapse()

    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id])

  // Реакция на исчезновение события — запуск dismiss-анимации
  useEffect(() => {
    if (activeEvent !== null) return
    if (!displayedDef) return

    setIsDismissing(true)
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current)

    dismissTimerRef.current = setTimeout(() => {
      setDisplayedDef(null)
      setIsDismissing(false)
    }, DISMISS_DURATION_MS)

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent])

  // Countdown
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

  if (!displayedDef) return null

  const styles = CATEGORY_STYLES[displayedDef.category]

  const handleClick = () => {
    if (!isExpanded && !isDismissing) {
      setIsExpanded(true)
      scheduleCollapse()
    }
  }

  return (
    <div
      className={`
        absolute top-2 left-3 z-10
        transition-[right] duration-500 ease-in-out
        ${isExpanded ? 'right-[88px]' : 'right-auto'}
        ${isDismissing
          ? 'animate-[fadeSlideOut_400ms_ease-in_forwards]'
          : 'animate-[slideUp_400ms_ease-out]'
        }
      `}
      style={{ animationFillMode: isDismissing ? 'forwards' : 'backwards' }}
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
          {displayedDef.icon}
        </div>

        {/* Текстовый блок — всегда в DOM, управляется через CSS */}
        <div className={`
          overflow-hidden
          transition-all duration-500 ease-in-out
          ${isExpanded ? 'max-w-xs opacity-100' : 'max-w-0 opacity-0'}
        `}>
          <div className="min-w-[120px]">
            <p className={`text-[10px] font-bold ${styles.text} leading-tight truncate`}>
              {displayedDef.name}
            </p>
            <p className="text-gray-500 text-[8px] leading-tight mt-0.5 truncate">
              {displayedDef.description}
            </p>
          </div>
        </div>

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

// src/components/EventBanner.tsx
import { useEffect, useState } from 'react'
import { useActiveEvent, useGameStore, GAME_EVENTS } from '../store/gameStore'
import type { EventCategory } from '../store/gameStore'

const CATEGORY_STYLES: Record<EventCategory, { border: string; text: string; icon_bg: string; badge: string }> = {
  positive: {
    border: 'border-green-600/60',
    text: 'text-green-300',
    icon_bg: 'bg-green-900/60',
    badge: 'bg-green-700',
  },
  negative: {
    border: 'border-red-600/60',
    text: 'text-red-300',
    icon_bg: 'bg-red-900/60',
    badge: 'bg-red-700',
  },
  neutral: {
    border: 'border-blue-600/60',
    text: 'text-blue-300',
    icon_bg: 'bg-blue-900/60',
    badge: 'bg-blue-700',
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

  return (
    <div
      className={`
        absolute top-2 left-3 right-3
        animate-[slideUp_400ms_ease-out]
        z-30
      `}
      style={{ animationFillMode: 'backwards' }}
    >
      <div className={`
        bg-gray-950 border ${styles.border} rounded-lg
        px-3 py-2 font-mono
        shadow-lg
        flex items-center gap-2
      `}>

        {/* Иконка */}
        <div className={`
          w-8 h-8 rounded-md flex items-center justify-center
          flex-shrink-0 ${styles.icon_bg} text-base
        `}>
          {def.icon}
        </div>

        {/* Название + описание */}
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold ${styles.text} leading-tight truncate`}>
            {def.name}
          </p>
          <p className="text-gray-500 text-[8px] leading-tight mt-0.5 truncate">
            {def.description}
          </p>
        </div>

        {/* Таймер */}
        <div className={`text-[10px] font-bold ${styles.text} flex-shrink-0 tabular-nums`}>
          ⏱ {formatCountdown(remaining)}
        </div>

      </div>
    </div>
  )
}

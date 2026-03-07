// src/components/BoostButton.tsx
// Круглая кнопка «БУСТ» — абсолютно позиционирована на GameCanvas,
// под кнопкой DailyRewardButton (top-3 right-3).
// При активном бусте показывает таймер обратного отсчёта.

import { useState, useEffect } from 'react'
import { useBoosts } from '../store/gameStore'

interface BoostButtonProps {
  onClick: () => void
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BoostButton: React.FC<BoostButtonProps> = ({ onClick }) => {
  const activeBoosts = useBoosts()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeBoost = activeBoosts.find(b => b.expiresAt > now)
  const remaining = activeBoost ? activeBoost.expiresAt - now : 0
  const isActive = !!activeBoost

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        absolute top-[84px] right-3 z-20
        w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full
        flex flex-col items-center justify-center
        backdrop-blur-sm border-2
        transition-colors duration-300
        active:scale-90 transform
        font-mono
        ${isActive
          ? 'bg-orange-900/80 border-orange-400 shadow-lg shadow-orange-500/40 animate-pulse-ring'
          : 'bg-gray-800/80 border-orange-600/60 hover:border-orange-500'
        }
      `}
      aria-label="Бусты"
    >
      <span className="text-xl sm:text-2xl leading-none">🚀</span>

      {isActive ? (
        <span className="text-[8px] sm:text-[9px] font-bold leading-none mt-0.5 text-orange-300">
          {formatTime(remaining)}
        </span>
      ) : (
        <span className="text-[8px] sm:text-[9px] font-bold leading-none mt-0.5 text-orange-400">
          БУСТ
        </span>
      )}
    </button>
  )
}

export default BoostButton

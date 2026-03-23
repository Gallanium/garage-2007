// ============================================
// КНОПКА ЕЖЕДНЕВНОЙ НАГРАДЫ (на игровом экране)
// ============================================

import { Flame } from 'lucide-react'

interface DailyRewardButtonProps {
  /** Текущая серия дней */
  streak: number
  /** Доступна ли награда для получения */
  canClaim: boolean
  /** Открыть модалку ежедневных наград */
  onClick: () => void
}

/**
 * Круглая кнопка в правом верхнем углу canvas-зоны.
 * Показывает стрик дней и сигнализирует о доступной награде.
 *
 * Размер: 64px (w-16 h-16), на sm: 72px (sm:w-[72px] sm:h-[72px])
 */
const DailyRewardButton: React.FC<DailyRewardButtonProps> = ({
  streak,
  canClaim,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        absolute top-2 right-3 z-20
        w-16 h-16 rounded-full
        flex flex-col items-center justify-center
        backdrop-blur-sm
        border-2
        transition-colors duration-300
        font-mono
        ${canClaim
          ? 'bg-orange-900/80 border-orange-500/60 shadow-lg shadow-orange-500/30 animate-pulse-ring'
          : 'bg-gray-900/80 border-gray-700/50'
        }
      `}
      aria-label={canClaim ? 'Забрать ежедневную награду' : 'Ежедневные награды'}
    >
      <span className={`leading-none flex justify-center ${canClaim ? 'text-orange-500' : 'grayscale opacity-50 text-gray-400'}`}>
        <Flame className="w-5 h-5" />
      </span>

      {/* Число стрика */}
      <span className={`text-[9px] font-bold leading-none mt-0.5 ${
        canClaim ? 'text-orange-300' : 'text-gray-500'
      }`}>
        {streak}
      </span>

      {/* Красный бейдж ! — только когда награда доступна */}
      {canClaim && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
                         flex items-center justify-center
                         text-[9px] font-bold text-white
                         border border-red-400">
          !
        </span>
      )}
    </button>
  )
}

export default DailyRewardButton

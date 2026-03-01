// ============================================
// КНОПКА ЕЖЕДНЕВНОЙ НАГРАДЫ (на игровом экране)
// ============================================

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
        absolute top-3 right-3 z-20
        w-11 h-11 rounded-full
        flex flex-col items-center justify-center
        backdrop-blur-sm
        border-2
        transition-all duration-300
        active:scale-90 transform
        font-mono
        ${canClaim
          ? 'bg-amber-900/80 border-amber-400/50 shadow-lg shadow-amber-400/30 animate-pulse-ring'
          : 'bg-gray-800/80 border-gray-600/50'
        }
      `}
      aria-label={canClaim ? 'Забрать ежедневную награду' : 'Ежедневные награды'}
    >
      {/* Иконка огня */}
      <span className={`text-sm leading-none ${canClaim ? '' : 'grayscale opacity-50'}`}>
        🔥
      </span>

      {/* Число стрика */}
      <span className={`text-[7px] sm:text-[8px] font-bold leading-none mt-0.5 ${
        canClaim ? 'text-amber-300' : 'text-gray-500'
      }`}>
        {streak}
      </span>

      {/* Красный бейдж ! — только когда награда доступна */}
      {canClaim && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full
                         flex items-center justify-center
                         text-[7px] font-bold text-white
                         border border-red-400
                         animate-bounce">
          !
        </span>
      )}
    </button>
  )
}

export default DailyRewardButton

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
        absolute top-3 right-3 z-20
        w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full
        flex flex-col items-center justify-center
        backdrop-blur-sm
        border-2
        transition-colors duration-300
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
      <span className={`text-xl sm:text-2xl leading-none ${canClaim ? '' : 'grayscale opacity-50'}`}>
        🔥
      </span>

      {/* Число стрика */}
      <span className={`text-[9px] sm:text-[11px] font-bold leading-none mt-0.5 ${
        canClaim ? 'text-amber-300' : 'text-gray-500'
      }`}>
        {streak}
      </span>

      {/* Красный бейдж ! — только когда награда доступна */}
      {canClaim && (
        <span className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full
                         flex items-center justify-center
                         text-[9px] sm:text-game-sm font-bold text-white
                         border border-red-400
                         animate-bounce">
          !
        </span>
      )}
    </button>
  )
}

export default DailyRewardButton

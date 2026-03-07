import { useCallback } from 'react'
import { formatLargeNumber } from '../store/gameStore'

// ============================================
// ТИПЫ
// ============================================

interface WelcomeBackModalProps {
  offlineEarnings: number
  offlineTime: number
  onClose: () => void
  isOpen: boolean
}

// ============================================
// УТИЛИТЫ
// ============================================

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const lastDigit = abs % 10

  if (abs >= 11 && abs <= 19) return many
  if (lastDigit === 1) return one
  if (lastDigit >= 2 && lastDigit <= 4) return few
  return many
}

function formatOfflineTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainHours = hours % 24
    const dayWord = pluralize(days, 'день', 'дня', 'дней')
    const hourWord = pluralize(remainHours, 'час', 'часа', 'часов')
    return remainHours > 0
      ? `${days} ${dayWord} ${remainHours} ${hourWord}`
      : `${days} ${dayWord}`
  }

  if (hours > 0) {
    const remainMinutes = minutes % 60
    const hourWord = pluralize(hours, 'час', 'часа', 'часов')
    const minWord = pluralize(remainMinutes, 'минуту', 'минуты', 'минут')
    return remainMinutes > 0
      ? `${hours} ${hourWord} ${remainMinutes} ${minWord}`
      : `${hours} ${hourWord}`
  }

  const minWord = pluralize(minutes, 'минуту', 'минуты', 'минут')
  return `${minutes} ${minWord}`
}

// ============================================
// КОМПОНЕНТ
// ============================================

const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({
  offlineEarnings,
  offlineTime,
  onClose,
  isOpen,
}) => {
  const handleOverlayClick = useCallback(() => { onClose() }, [onClose])
  const handleCardClick = useCallback((e: React.MouseEvent) => { e.stopPropagation() }, [])

  if (!isOpen) return null

  const formattedEarnings = formatLargeNumber(offlineEarnings)
  const formattedTime = formatOfflineTime(offlineTime)

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center
                 animate-[fadeIn_300ms_ease-out]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="С возвращением"
    >
      <div
        className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-6
                   max-w-sm w-[90%] mx-auto
                   border border-garage-rust/50 shadow-2xl
                   text-center
                   animate-[slideUp_400ms_ease-out]"
        onClick={handleCardClick}
      >
        <div className="text-4xl mb-2">🔧</div>

        <h2 className="text-base sm:text-lg font-bold text-yellow-400 mb-3 font-mono">
          С возвращением!
        </h2>

        <p className="text-game-sm sm:text-xs text-gray-300 mb-4 font-mono">
          Вас не было <span className="text-white font-semibold">{formattedTime}</span>
        </p>

        <div className="border-t border-gray-700 mb-4" />

        <p className="text-[9px] sm:text-[11px] text-gray-400 mb-2 font-mono uppercase tracking-wider">
          Работники заработали
        </p>

        <p className="text-2xl sm:text-3xl font-bold text-green-400 mb-1 font-mono">
          {formattedEarnings}
          <span className="text-lg sm:text-xl text-green-400/70 ml-1">₽</span>
        </p>

        <p className="text-[9px] sm:text-[11px] text-gray-500 mb-6 font-mono">
          Пассивный доход за оффлайн
        </p>

        <button
          type="button"
          onClick={onClose}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold
                     py-2.5 px-6 rounded-lg font-mono text-sm sm:text-base
                     transition-colors duration-200
                     active:scale-95 transform
                     shadow-lg shadow-yellow-500/20
                     w-full"
        >
          Забрать! 💰
        </button>
      </div>
    </div>
  )
}

export default WelcomeBackModal

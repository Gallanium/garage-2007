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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="С возвращением"
    >
      <div
        className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-4
                   mx-3 w-full max-w-sm font-mono
                   shadow-2xl shadow-orange-900/30 text-center"
        onClick={handleCardClick}
      >
        <div className="text-4xl mb-2">🔧</div>

        <div className="text-center mb-4">
          <h2 className="text-garage-yellow text-sm font-bold tracking-widest">
            С возвращением!
          </h2>
        </div>

        <p className="text-gray-400 text-[9px] mb-4 font-mono">
          Вас не было <span className="text-white font-semibold">{formattedTime}</span>
        </p>

        <div className="border-t border-orange-700/30 mb-4" />

        <p className="text-[9px] text-gray-500 mb-2 font-mono uppercase tracking-wider">
          Работники заработали
        </p>

        <p className="text-xl font-bold text-cyan-400 mb-1 font-mono">
          {formattedEarnings}
          <span className="text-base text-cyan-400/70 ml-1">₽</span>
        </p>

        <p className="text-[9px] text-gray-500 mb-4 font-mono">
          Пассивный доход за оффлайн
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded text-[10px] font-bold text-white
                     bg-gradient-to-r from-orange-600 to-amber-500
                     hover:from-orange-500 hover:to-amber-400
                     transition-colors"
        >
          Забрать! 💰
        </button>
      </div>
    </div>
  )
}

export default WelcomeBackModal

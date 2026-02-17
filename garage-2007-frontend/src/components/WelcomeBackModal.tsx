import { useCallback } from 'react'

// ============================================
// ТИПЫ
// ============================================

/**
 * Пропсы модального окна приветствия.
 */
interface WelcomeBackModalProps {
  /** Сумма заработанных денег за время отсутствия (₽) */
  offlineEarnings: number
  /** Время отсутствия в секундах */
  offlineTime: number
  /** Коллбэк при закрытии модального окна */
  onClose: () => void
  /** Флаг видимости */
  isOpen: boolean
}

// ============================================
// УТИЛИТЫ
// ============================================

/**
 * Возвращает правильное склонение русского слова
 * для числительных (1 день, 2 дня, 5 дней).
 *
 * @param n     - число
 * @param one   - форма для 1 (день)
 * @param few   - форма для 2-4 (дня)
 * @param many  - форма для 5-20 (дней)
 */
function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const lastDigit = abs % 10

  if (abs >= 11 && abs <= 19) return many
  if (lastDigit === 1) return one
  if (lastDigit >= 2 && lastDigit <= 4) return few
  return many
}

/**
 * Форматирует длительность в секундах в читаемую строку.
 *
 * Примеры:
 * - 90       → "1 минуту"
 * - 3700     → "1 час 1 минуту"
 * - 90000    → "1 день 1 час"
 *
 * @param seconds - время в секундах
 * @returns отформатированная строка
 */
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

/**
 * Модальное окно «С возвращением!»
 *
 * Показывается при возвращении игрока после оффлайна,
 * если за время отсутствия был начислен пассивный доход.
 * Закрывается по кнопке «Забрать!» или клику на оверлей.
 */
const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({
  offlineEarnings,
  offlineTime,
  onClose,
  isOpen,
}) => {
  /** Клик по оверлею (вне карточки) — закрываем */
  const handleOverlayClick = useCallback(() => {
    onClose()
  }, [onClose])

  /** Предотвращаем всплытие клика из карточки в оверлей */
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  if (!isOpen) return null

  const formattedEarnings = offlineEarnings.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  const formattedTime = formatOfflineTime(offlineTime)

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center
                 animate-[fadeIn_300ms_ease-out]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="С возвращением"
    >
      {/* Карточка модального окна */}
      <div
        className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-8
                   max-w-md w-[90%] mx-auto mt-32
                   border border-garage-rust/50 shadow-2xl
                   text-center
                   animate-[slideUp_400ms_ease-out]"
        onClick={handleCardClick}
      >
        {/* Иконка */}
        <div className="text-5xl mb-3">🔧</div>

        {/* Заголовок */}
        <h2 className="text-3xl font-bold text-yellow-400 mb-4 font-mono">
          С возвращением!
        </h2>

        {/* Время отсутствия */}
        <p className="text-gray-300 mb-6 font-mono">
          Вас не было <span className="text-white font-semibold">{formattedTime}</span>
        </p>

        {/* Разделитель */}
        <div className="border-t border-gray-700 mb-6" />

        {/* Заработок */}
        <p className="text-sm text-gray-400 mb-2 font-mono uppercase tracking-wider">
          Ваши работники заработали
        </p>

        <p className="text-5xl font-bold text-green-400 mb-2 font-mono">
          {formattedEarnings}
          <span className="text-3xl text-green-400/70 ml-1">₽</span>
        </p>

        <p className="text-xs text-gray-500 mb-8 font-mono">
          Пассивный доход за время отсутствия
        </p>

        {/* Кнопка */}
        <button
          type="button"
          onClick={onClose}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold
                     py-3 px-8 rounded-lg font-mono text-lg
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
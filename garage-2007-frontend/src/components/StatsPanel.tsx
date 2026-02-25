import {
  useGarageLevel,
  useTotalClicks,
  usePeakClickIncome,
  useTotalPlayTime,
  useTotalEarned,
  useSessionCount,
  formatLargeNumber,
  GARAGE_LEVEL_NAMES,
} from '../store/gameStore'

// ============================================
// УТИЛИТЫ
// ============================================

/** Форматирует секунды в ЧЧ:ММ:СС */
function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// ============================================
// КОМПОНЕНТ
// ============================================

/**
 * Панель статистики игрока.
 *
 * Отображает:
 * 1. Профиль — аватар-заглушка + никнейм (будущая интеграция с Telegram)
 * 2. Уровень гаража — число + текстовое название
 * 3. Общее число кликов за всё время
 * 4. Рекорд моментального дохода (₽/сек)
 * 5. Время в игре (ЧЧ:ММ:СС)
 */
const StatsPanel: React.FC = () => {
  const garageLevel = useGarageLevel()
  const totalClicks = useTotalClicks()
  const peakClickIncome = usePeakClickIncome()
  const totalPlayTime = useTotalPlayTime()
  const totalEarned = useTotalEarned()
  const sessionCount = useSessionCount()

  const levelName =
    GARAGE_LEVEL_NAMES[garageLevel as keyof typeof GARAGE_LEVEL_NAMES] ?? '—'

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">

      {/* ======== Профиль игрока ======== */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                          border border-gray-700 shadow-md">
        <div className="flex items-center gap-4">
          {/* Аватар-заглушка */}
          <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-600
                          flex items-center justify-center flex-shrink-0">
            <span className="text-3xl">👤</span>
          </div>
          {/* Никнейм + подпись */}
          <div>
            <p className="text-lg font-bold text-white font-mono">Игрок</p>
            <p className="text-xs text-gray-500 font-mono">
              Telegram-профиль (скоро)
            </p>
          </div>
        </div>
      </section>

      {/* ======== Уровень гаража ======== */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                          border border-yellow-400/30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-garage-rust to-garage-yellow
                          border border-garage-yellow/50 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🏗️</span>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono uppercase">Уровень гаража</p>
            <p className="text-xl font-bold text-yellow-400 font-mono">
              {garageLevel}{' '}
              <span className="text-sm text-yellow-400/70">— «{levelName}»</span>
            </p>
          </div>
        </div>
      </section>

      {/* ======== Статистика — грид ======== */}
      <section>
        <div className="grid grid-cols-1 gap-3">

          {/* Общее число кликов */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                          border border-gray-700 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👆</span>
                <p className="text-sm text-gray-400 font-mono">Всего кликов</p>
              </div>
              <p className="text-xl font-bold text-white font-mono">
                {formatLargeNumber(totalClicks)}
              </p>
            </div>
          </div>

          {/* Рекорд моментального дохода */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                          border border-orange-400/30 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <p className="text-sm text-gray-400 font-mono">Рекорд дохода (сек)</p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-xl font-bold text-orange-300 font-mono">
                  {formatLargeNumber(peakClickIncome)}
                </p>
                <span className="text-xs text-orange-300/70 font-mono">₽/с</span>
              </div>
            </div>
          </div>

          {/* Время в игре */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                          border border-green-400/30 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏱️</span>
                <p className="text-sm text-gray-400 font-mono">Время в игре</p>
              </div>
              <p className="text-xl font-bold text-green-300 font-mono">
                {formatPlayTime(totalPlayTime)}
              </p>
            </div>
          </div>

          {/* Всего заработано */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                          border border-gray-700 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <p className="text-sm text-gray-400 font-mono">Всего заработано</p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-xl font-bold text-white font-mono">
                  {formatLargeNumber(totalEarned)}
                </p>
                <span className="text-xs text-gray-400 font-mono">₽</span>
              </div>
            </div>
          </div>

          {/* Количество сессий */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                          border border-gray-700 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔄</span>
                <p className="text-sm text-gray-400 font-mono">Сессий</p>
              </div>
              <p className="text-xl font-bold text-white font-mono">
                {sessionCount}
              </p>
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}

export default StatsPanel

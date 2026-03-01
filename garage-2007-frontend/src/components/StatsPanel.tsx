import {
  useGarageLevel,
  useTotalClicks,
  usePeakClickIncome,
  useTotalPlayTime,
  useTotalEarned,
  useSessionCount,
  useBestStreak,
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
 */
const StatsPanel: React.FC = () => {
  const garageLevel = useGarageLevel()
  const totalClicks = useTotalClicks()
  const peakClickIncome = usePeakClickIncome()
  const totalPlayTime = useTotalPlayTime()
  const totalEarned = useTotalEarned()
  const sessionCount = useSessionCount()
  const bestStreak = useBestStreak()

  const levelName =
    GARAGE_LEVEL_NAMES[garageLevel as keyof typeof GARAGE_LEVEL_NAMES] ?? '—'

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">

      {/* ======== Профиль игрока ======== */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-gray-700 shadow-md">
        <div className="flex items-center gap-3">
          {/* Аватар-заглушка */}
          <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-gray-600
                          flex items-center justify-center flex-shrink-0">
            <span className="text-xl">👤</span>
          </div>
          {/* Никнейм + подпись */}
          <div>
            <p className="text-sm sm:text-base font-bold text-white font-mono">Игрок</p>
            <p className="text-[9px] sm:text-[11px] text-gray-500 font-mono">
              Telegram (скоро)
            </p>
          </div>
        </div>
      </section>

      {/* ======== Уровень гаража ======== */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-yellow-400/30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-garage-rust to-garage-yellow
                          border border-garage-yellow/50 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🏗️</span>
          </div>
          <div>
            <p className="text-[9px] sm:text-[11px] text-gray-400 font-mono uppercase">Уровень гаража</p>
            <p className="text-base sm:text-lg font-bold text-yellow-400 font-mono">
              {garageLevel}{' '}
              <span className="text-[10px] sm:text-xs text-yellow-400/70">— «{levelName}»</span>
            </p>
          </div>
        </div>
      </section>

      {/* ======== Статистика — грид ======== */}
      <section>
        <div className="grid grid-cols-1 gap-2">

          {/* Общее число кликов */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-gray-700 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">👆</span>
                <p className="text-[10px] sm:text-xs text-gray-400 font-mono">Всего кликов</p>
              </div>
              <p className="text-base sm:text-lg font-bold text-white font-mono">
                {formatLargeNumber(totalClicks)}
              </p>
            </div>
          </div>

          {/* Рекорд моментального дохода */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-orange-400/30 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <p className="text-[10px] sm:text-xs text-gray-400 font-mono">Рекорд (сек)</p>
              </div>
              <div className="flex items-baseline gap-0.5">
                <p className="text-base sm:text-lg font-bold text-orange-300 font-mono">
                  {formatLargeNumber(peakClickIncome)}
                </p>
                <span className="text-[9px] sm:text-[11px] text-orange-300/70 font-mono">₽/с</span>
              </div>
            </div>
          </div>

          {/* Время в игре */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-green-400/30 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                <p className="text-[10px] sm:text-xs text-gray-400 font-mono">Время в игре</p>
              </div>
              <p className="text-base sm:text-lg font-bold text-green-300 font-mono">
                {formatPlayTime(totalPlayTime)}
              </p>
            </div>
          </div>

          {/* Всего заработано */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-gray-700 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💰</span>
                <p className="text-[10px] sm:text-xs text-gray-400 font-mono">Заработано</p>
              </div>
              <div className="flex items-baseline gap-0.5">
                <p className="text-base sm:text-lg font-bold text-white font-mono">
                  {formatLargeNumber(totalEarned)}
                </p>
                <span className="text-[9px] sm:text-[11px] text-gray-400 font-mono">₽</span>
              </div>
            </div>
          </div>

          {/* Количество сессий */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-gray-700 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔄</span>
                <p className="text-[10px] sm:text-xs text-gray-400 font-mono">Сессий</p>
              </div>
              <p className="text-base sm:text-lg font-bold text-white font-mono">
                {sessionCount}
              </p>
            </div>
          </div>

          {/* Самая длинная серия */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3
                          border border-amber-400/30 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <p className="text-[10px] sm:text-xs text-gray-400 font-mono">Лучшая серия</p>
              </div>
              <div className="flex items-baseline gap-0.5">
                <p className="text-base sm:text-lg font-bold text-amber-300 font-mono">
                  {bestStreak}
                </p>
                <span className="text-[9px] sm:text-[11px] text-amber-300/70 font-mono">дн.</span>
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}

export default StatsPanel

import {
  useGarageLevel,
  useTotalClicks,
  usePeakClickIncome,
  useTotalPlayTime,
  useServerTotalEarned,
  useSessionCount,
  useBestStreak,
  formatLargeNumber,
  GARAGE_LEVEL_NAMES,
  useActiveEvent,
  GAME_EVENTS,
} from '../store/gameStore'
import { useTelegramUser } from '../hooks/useTelegram'
import { useState, useEffect } from 'react'
import { User, Building, MousePointer2, Trophy, Timer, Coins, RotateCcw, Flame, AudioWaveform } from 'lucide-react'

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
  const tgUser = useTelegramUser()
  const garageLevel = useGarageLevel()
  const totalClicks = useTotalClicks()
  const peakClickIncome = usePeakClickIncome()
  const totalPlayTime = useTotalPlayTime()
  const totalEarned = useServerTotalEarned()
  const sessionCount = useSessionCount()
  const bestStreak = useBestStreak()
  const activeEvent = useActiveEvent()

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!activeEvent) return
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(clock)
  }, [activeEvent])

  const levelName =
    GARAGE_LEVEL_NAMES[garageLevel as keyof typeof GARAGE_LEVEL_NAMES] ?? '—'

  return (
    <div className="flex flex-col gap-3 p-3" style={{ paddingBottom: 'calc(12px + var(--tg-safe-area-bottom, 0px))' }}>

      {/* ======== Профиль игрока ======== */}
      <section className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-lg border border-orange-700/40 p-3">
        <div className="flex items-center gap-3">
          {/* Аватар */}
          <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-orange-700/40
                          flex items-center justify-center flex-shrink-0 overflow-hidden">
            {tgUser?.photoUrl
              ? <img src={tgUser.photoUrl} alt="avatar" className="w-full h-full object-cover" />
              : <User className="w-6 h-6 text-gray-400" />
            }
          </div>
          {/* Имя + username */}
          <div>
            <p className="text-xs font-bold text-white font-mono">
              {tgUser ? `${tgUser.firstName}${tgUser.lastName ? ' ' + tgUser.lastName : ''}` : 'Игрок'}
            </p>
            <p className="text-[9px] text-gray-500 font-mono">
              {tgUser?.username ? `@${tgUser.username}` : tgUser ? `ID: ${tgUser.id}` : 'Подключите Telegram'}
            </p>
          </div>
        </div>
      </section>

      {/* ======== Уровень гаража ======== */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-700
                          flex items-center justify-center flex-shrink-0 text-white">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] text-gray-400 font-mono uppercase">Уровень гаража</p>
            <p className="text-base font-bold text-garage-yellow font-mono">
              {garageLevel}{' '}
              <span className="text-[9px] text-garage-yellow/70">— «{levelName}»</span>
            </p>
          </div>
        </div>
      </section>

      {/* ======== Активный Эффект (Событие) ======== */}
      {activeEvent && GAME_EVENTS[activeEvent.id] && (() => {
        const def = GAME_EVENTS[activeEvent.id]
        const remaining = Math.max(0, Math.ceil((activeEvent.expiresAt - now) / 1000))
        const m = Math.floor(remaining / 60)
        const s = remaining % 60
        const timeStr = `${m}:${s.toString().padStart(2, '0')}`

        const isPos = def.category === 'positive'
        const isNeg = def.category === 'negative'
        const bgGradient = isPos ? 'from-green-950/80 to-emerald-950/60'
                         : isNeg ? 'from-red-950/80 to-rose-950/60'
                         : 'from-blue-950/80 to-cyan-950/60'
        const borderColor = isPos ? 'border-green-700/50'
                          : isNeg ? 'border-red-700/50'
                          : 'border-blue-700/50'
        const textColor = isPos ? 'text-green-400'
                        : isNeg ? 'text-red-400'
                        : 'text-cyan-400'
        
        return (
          <section className={`bg-gradient-to-br ${bgGradient} rounded-lg border ${borderColor} p-3 shadow-lg shadow-black/20`}>
             <div className="flex items-center justify-between">
               <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-2">
                 <div className="flex items-center gap-1.5">
                    <AudioWaveform className={`w-4 h-4 shrink-0 ${textColor}`} />
                    <p className={`text-[10px] uppercase font-bold font-mono truncate ${textColor}`}>{def.name}</p>
                 </div>
                 <p className="text-[8px] text-gray-300 font-mono leading-relaxed line-clamp-2" style={{ overflowWrap: 'break-word' }}>
                   {def.description}
                 </p>
               </div>
               
               <div className="flex flex-col items-end shrink-0 border-l border-white/10 pl-3">
                 <p className={`text-sm font-bold font-mono tabular-nums ${textColor}`}>{timeStr}</p>
                 <p className="text-[8px] text-gray-500 font-mono uppercase tracking-widest mt-0.5">осталось</p>
               </div>
             </div>
          </section>
        )
      })()}

      {/* ======== Статистика — грид ======== */}
      <section>
        <div className="grid grid-cols-1 gap-2">

          {/* Общее число кликов */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-white flex-shrink-0">
                  <MousePointer2 className="w-5 h-5" />
                </div>
                <p className="text-[9px] text-gray-400 font-mono">Всего кликов</p>
              </div>
              <p className="text-base font-bold text-white font-mono">
                {formatLargeNumber(totalClicks)}
              </p>
            </div>
          </div>

          {/* Рекорд моментального дохода */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-700 flex items-center justify-center text-white flex-shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <p className="text-[9px] text-gray-400 font-mono">Рекорд (сек)</p>
              </div>
              <div className="flex items-baseline gap-0.5">
                <p className="text-base font-bold text-orange-300 font-mono">
                  {formatLargeNumber(peakClickIncome)}
                </p>
                <span className="text-[9px] text-orange-300/70 font-mono">₽/с</span>
              </div>
            </div>
          </div>

          {/* Время в игре */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center text-white flex-shrink-0">
                  <Timer className="w-5 h-5" />
                </div>
                <p className="text-[9px] text-gray-400 font-mono">Время в игре</p>
              </div>
              <p className="text-base font-bold text-green-300 font-mono">
                {formatPlayTime(totalPlayTime)}
              </p>
            </div>
          </div>

          {/* Всего заработано */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-white flex-shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <p className="text-[9px] text-gray-400 font-mono">Заработано</p>
              </div>
              <div className="flex items-baseline gap-0.5">
                <p className="text-base font-bold text-white font-mono">
                  {formatLargeNumber(totalEarned)}
                </p>
                <span className="text-[9px] text-gray-400 font-mono">₽</span>
              </div>
            </div>
          </div>

          {/* Количество сессий */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-white flex-shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <p className="text-[9px] text-gray-400 font-mono">Сессий</p>
              </div>
              <p className="text-base font-bold text-white font-mono">
                {sessionCount}
              </p>
            </div>
          </div>

          {/* Самая длинная серия */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-700 flex items-center justify-center text-white flex-shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <p className="text-[9px] text-gray-400 font-mono">Лучшая серия</p>
              </div>
              <div className="flex items-baseline gap-0.5">
                <p className="text-base font-bold text-amber-300 font-mono">
                  {bestStreak}
                </p>
                <span className="text-[9px] text-amber-300/70 font-mono">дн.</span>
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}

export default StatsPanel

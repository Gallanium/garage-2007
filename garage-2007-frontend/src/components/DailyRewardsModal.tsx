import { useCallback, useEffect, useState } from 'react'
import { DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS, type DailyRewardsState } from '../store/gameStore'

// ============================================
// ТИПЫ
// ============================================

interface DailyRewardsModalProps {
  isOpen: boolean
  dailyRewards: DailyRewardsState
  canClaim: boolean
  onClaim: () => void
  onClose: () => void
}

// ============================================
// УТИЛИТЫ
// ============================================

/** ЧЧ:ММ:СС до следующей награды, или null если время вышло */
function getTimeUntilNextReward(lastClaimTimestamp: number): string | null {
  if (lastClaimTimestamp === 0) return null
  const remaining = DAILY_STREAK_GRACE_PERIOD_MS - (Date.now() - lastClaimTimestamp)
  if (remaining <= 0) return null
  const h = Math.floor(remaining / 3600000)
  const m = Math.floor((remaining % 3600000) / 60000)
  const s = Math.floor((remaining % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Вычисляет всё необходимое для отображения из streak + canClaim.
 *
 * streak=0,  canClaim=true  → week 0 (Д1-Д7),  claimed=0, next=pos 1
 * streak=5,  canClaim=false → week 0 (Д1-Д7),  claimed=5, current=pos 5
 * streak=5,  canClaim=true  → week 0 (Д1-Д7),  claimed=5, next=pos 6
 * streak=7,  canClaim=false → week 0 (Д1-Д7),  claimed=7, weekComplete!
 * streak=7,  canClaim=true  → week 1 (Д8-Д14), claimed=0, next=pos 1
 * streak=9,  canClaim=false → week 1 (Д8-Д14), claimed=2, current=pos 2
 * streak=14, canClaim=false → week 1 (Д8-Д14), claimed=7, weekComplete!
 * streak=14, canClaim=true  → week 2 (Д15-Д21),claimed=0, next=pos 1
 */
function computeWeekInfo(streak: number, canClaim: boolean) {
  // Какую неделю показываем (0-based)
  const weekNumber = canClaim
    ? Math.floor(streak / 7)
    : (streak > 0 ? Math.floor((streak - 1) / 7) : 0)

  // Первый день этой недели
  const weekStartDay = weekNumber * 7 + 1

  // Сколько дней забрано в этой неделе (0-7)
  const claimedInWeek = streak - weekNumber * 7

  // Неделя полностью завершена (7/7 и ожидаем таймер)
  const isWeekComplete = claimedInWeek >= 7 && !canClaim

  // Награда для следующего дня (позиция в DAILY_REWARDS)
  const nextReward = DAILY_REWARDS[streak % 7]

  return { weekNumber, weekStartDay, claimedInWeek, isWeekComplete, nextReward }
}

// ============================================
// КОМПОНЕНТ КАРТОЧКИ ДНЯ
// ============================================

type DayCardState = 'claimed' | 'current' | 'next' | 'future' | 'weekDone'

interface DayCardProps {
  dayLabel: number
  reward: number
  state: DayCardState
  isBonusDay: boolean
}

const DayCard: React.FC<DayCardProps> = ({ dayLabel, reward, state, isBonusDay }) => {
  const base = 'rounded-lg p-1.5 text-center font-mono transition-all duration-200'
  const styles: Record<DayCardState, string> = {
    claimed: 'bg-green-900/40 border border-green-500/50',
    current: 'bg-green-900/40 border-2 border-green-400 shadow-lg shadow-green-400/20',
    next: 'bg-yellow-900/30 border-2 border-yellow-400 shadow-lg shadow-yellow-400/20 animate-pulse',
    future: 'bg-gray-800/60 border border-gray-700/50 opacity-60',
    weekDone: 'bg-gray-800/40 border border-gray-700/30 opacity-40',
  }
  const isClaimed = state === 'claimed' || state === 'current'
  const isDone = state === 'weekDone'

  return (
    <div className={`${base} ${styles[state]}`}>
      <p className={`text-[8px] sm:text-[10px] uppercase mb-0.5 ${isDone ? 'text-gray-600' : 'text-gray-400'}`}>
        Д{dayLabel}
      </p>
      <div className={`text-base sm:text-lg font-bold ${
        isDone ? 'text-gray-600 grayscale'
          : isClaimed ? 'text-green-400'
            : state === 'next' ? 'text-yellow-400'
              : 'text-gray-500'
      }`}>
        {isClaimed || isDone ? '✅' : `${reward}`}
      </div>
      <p className="text-[10px] sm:text-xs mt-0.5">
        {isClaimed || isDone ? '' : '🔩'}
      </p>
    </div>
  )
}

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================

const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
  isOpen,
  dailyRewards,
  canClaim,
  onClaim,
  onClose,
}) => {
  const [countdown, setCountdown] = useState<string | null>(null)
  const [timerExpired, setTimerExpired] = useState(false)
  const effectiveCanClaim = canClaim || timerExpired

  const handleOverlayClick = useCallback(() => { onClose() }, [onClose])
  const handleCardClick = useCallback((e: React.MouseEvent) => { e.stopPropagation() }, [])

  // --- Escape ---
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // --- Sync timerExpired с canClaim ---
  useEffect(() => { setTimerExpired(false) }, [canClaim])

  // --- Reset при закрытии ---
  useEffect(() => {
    if (!isOpen) { setTimerExpired(false); setCountdown(null) }
  }, [isOpen])

  // --- Таймер ---
  useEffect(() => {
    if (!isOpen) return
    setCountdown(getTimeUntilNextReward(dailyRewards.lastClaimTimestamp))
    const interval = setInterval(() => {
      const time = getTimeUntilNextReward(dailyRewards.lastClaimTimestamp)
      setCountdown(time)
      if (!time && !canClaim) setTimerExpired(true)
    }, 1000)
    return () => clearInterval(interval)
  }, [isOpen, dailyRewards.lastClaimTimestamp, canClaim])

  if (!isOpen) return null

  // --- Derived state ---
  const { weekStartDay, claimedInWeek, isWeekComplete, nextReward } =
    computeWeekInfo(dailyRewards.currentStreak, effectiveCanClaim)

  /** Состояние карточки по позиции 1-7 внутри недели */
  const getDayState = (pos: number): DayCardState => {
    if (pos <= claimedInWeek) {
      // Последний забранный день — выделяем как 'current' (если нельзя забрать)
      return (pos === claimedInWeek && !effectiveCanClaim) ? 'current' : 'claimed'
    }
    if (pos === claimedInWeek + 1 && effectiveCanClaim) return 'next'
    return 'future'
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center
                 animate-[fadeIn_300ms_ease-out]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Ежедневные награды"
    >
      <div
        className="relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-5
                   max-w-sm w-[90%] mx-auto
                   border border-yellow-500/50 shadow-2xl
                   animate-[slideUp_400ms_ease-out]"
        onClick={handleCardClick}
      >
        {/* Крестик */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-300
                     text-base sm:text-lg leading-none w-7 h-7 flex items-center justify-center
                     rounded-full hover:bg-gray-700/50 transition-colors duration-200"
          aria-label="Закрыть"
        >
          ✕
        </button>

        {/* Заголовок */}
        <div className="text-center mb-3">
          <div className="text-3xl mb-1">📅</div>
          <h2 className="text-sm sm:text-base font-bold text-yellow-400 font-mono">
            ЕЖЕДНЕВНАЯ НАГРАДА
          </h2>
          <p className="text-[9px] sm:text-[11px] text-gray-400 font-mono mt-1">
            Заходи каждый день!
          </p>
        </div>

        {/* Календарь 7 дней: 4 + 3 (+ штамп при завершении) */}
        <div className="relative overflow-hidden rounded-lg mb-3">
          <div className="space-y-1.5">
            <div className="grid grid-cols-4 gap-1.5">
              {DAILY_REWARDS.slice(0, 4).map((reward, i) => {
                const pos = i + 1
                return (
                  <DayCard
                    key={pos}
                    dayLabel={weekStartDay + i}
                    reward={reward}
                    state={isWeekComplete ? 'weekDone' : getDayState(pos)}
                    isBonusDay={pos === 7}
                  />
                )
              })}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DAILY_REWARDS.slice(4).map((reward, i) => {
                const pos = i + 5
                return (
                  <DayCard
                    key={pos}
                    dayLabel={weekStartDay + pos - 1}
                    reward={reward}
                    state={isWeekComplete ? 'weekDone' : getDayState(pos)}
                    isBonusDay={pos === 7}
                  />
                )
              })}
            </div>
          </div>

          {/* Штамп «НЕДЕЛЯ ЗАКРЫТА» под углом */}
          {isWeekComplete && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm sm:text-base font-bold font-mono uppercase tracking-wider
                            text-red-400/60 border-2 border-dashed border-red-400/40
                            px-5 py-1.5 rounded-sm">
                Неделя закрыта
              </p>
            </div>
          )}
        </div>

        {/* Таймер (когда награда недоступна) */}
        {!effectiveCanClaim && countdown && (
          <div className="text-center mb-3">
            <p className="text-[8px] sm:text-[10px] text-gray-500 font-mono mb-0.5">
              Следующая награда через
            </p>
            <p className="text-sm sm:text-base font-bold text-amber-400 font-mono tracking-wider">
              ⏳ {countdown}
            </p>
          </div>
        )}

        {/* Кнопка */}
        {effectiveCanClaim ? (
          <button
            type="button"
            onClick={onClaim}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold
                       py-2.5 px-6 rounded-lg font-mono text-sm sm:text-base
                       transition-colors duration-200 active:scale-95 transform
                       shadow-lg shadow-yellow-500/20 w-full"
          >
            Забрать {nextReward} 🔩
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="bg-gray-700 text-gray-500 font-bold
                       py-2.5 px-6 rounded-lg font-mono text-sm sm:text-base
                       cursor-not-allowed w-full border border-gray-600/50"
          >
            ✅ Получено
          </button>
        )}
      </div>
    </div>
  )
}

export default DailyRewardsModal

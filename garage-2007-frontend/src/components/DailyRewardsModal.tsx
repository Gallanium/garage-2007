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
}

const DayCard: React.FC<DayCardProps> = ({ dayLabel, reward, state }) => {
  const base = 'rounded-lg p-1.5 text-center font-mono'
  const styles: Record<DayCardState, string> = {
    claimed: 'bg-gray-800 border border-green-700/40',
    current: 'bg-gray-800 border-2 border-green-500/60',
    next: 'bg-gray-800 border-2 border-orange-500/60',
    future: 'bg-gray-800/60 border border-gray-700/40 opacity-50',
    weekDone: 'bg-gray-900/40 border border-gray-700/30 opacity-40',
  }
  const isClaimed = state === 'claimed' || state === 'current'
  const isDone = state === 'weekDone'

  return (
    <div className={`${base} ${styles[state]}`}>
      <p className={`text-game-xs uppercase mb-0.5 ${isDone ? 'text-gray-600' : 'text-gray-400'}`}>
        Д{dayLabel}
      </p>
      <div className={`text-base font-bold ${
        isDone ? 'text-gray-600 grayscale'
          : isClaimed ? 'text-green-400'
            : state === 'next' ? 'text-orange-300'
              : 'text-gray-500'
      }`}>
        {isClaimed || isDone ? '✅' : `${reward}`}
      </div>
      <p className="text-[9px] mt-0.5">
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
  const [, setTimerTick] = useState(0)
  const countdown = !isOpen ? null : getTimeUntilNextReward(dailyRewards.lastClaimTimestamp)
  const timerExpired = isOpen
    && !canClaim
    && dailyRewards.lastClaimTimestamp > 0
    && countdown === null
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

  // --- Таймер ---
  useEffect(() => {
    if (!isOpen || canClaim) return

    const interval = setInterval(() => {
      setTimerTick(currentTick => currentTick + 1)
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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ paddingTop: 'var(--tg-safe-area-top)', paddingBottom: 'var(--tg-safe-area-bottom)' }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Ежедневные награды"
    >
      <div
        className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-4
                   mx-3 w-full max-w-sm font-mono
                   shadow-2xl shadow-orange-900/30"
        onClick={handleCardClick}
      >
        {/* Крестик */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none p-1"
          aria-label="Закрыть"
        >
          ×
        </button>

        {/* Заголовок */}
        <div className="text-center mb-4">
          <h2 className="text-garage-yellow text-sm font-bold tracking-widest">
            ЕЖЕДНЕВНАЯ НАГРАДА
          </h2>
          <p className="text-gray-500 text-[9px] mt-1 tracking-wide">
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
                  />
                )
              })}
            </div>
          </div>

          {/* Штамп «НЕДЕЛЯ ЗАКРЫТА» */}
          {isWeekComplete && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm font-bold font-mono uppercase tracking-wider
                            text-orange-400/60 border border-orange-700/50
                            px-5 py-1.5 rounded-sm">
                Неделя закрыта
              </p>
            </div>
          )}
        </div>

        {/* Таймер (когда награда недоступна) */}
        {!effectiveCanClaim && countdown && (
          <div className="text-center mb-3">
            <p className="text-game-xs text-gray-500 font-mono mb-0.5">
              Следующая награда через
            </p>
            <p className="text-sm font-bold text-orange-300 font-mono tracking-wider">
              ⏳ {countdown}
            </p>
          </div>
        )}

        {/* Кнопка */}
        {effectiveCanClaim ? (
          <button
            type="button"
            onClick={onClaim}
            className="w-full py-2 rounded text-[10px] font-bold text-white
                       bg-gradient-to-r from-orange-600 to-amber-500
                       hover:from-orange-500 hover:to-amber-400
                       transition-colors"
          >
            Забрать {nextReward} 🔩
          </button>
        ) : (
          <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30">
            ✅ Получено
          </div>
        )}
      </div>
    </div>
  )
}

export default DailyRewardsModal

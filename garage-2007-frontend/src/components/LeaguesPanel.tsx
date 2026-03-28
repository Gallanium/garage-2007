// garage-2007-frontend/src/components/LeaguesPanel.tsx
import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { useAudio } from '../contexts/AudioContext'
import { LEAGUE_TIERS, getCurrentTier, getTierProgress } from '@shared/constants/leagues'
import { formatLargeNumber } from '../store/gameStore'
import { TierIcon } from './TierIcon'
import { LeaderboardRow } from './LeaderboardRow'
import { Hexagon, CheckCircle2 } from 'lucide-react'
import type { LeagueTier } from '@shared/types/leagues'

type SubTab = 'rating' | 'tiers' | 'rewards'

export default function LeaguesPanel({ isActive }: { isActive?: boolean }) {
  const { playSound } = useAudio()
  const [subTab, setSubTab] = useState<SubTab>('rating')
  const totalEarned = useGameStore(s => s.totalEarned)
  const leagueStatus = useGameStore(s => s.leagueStatus)
  const fetchLeagueStatus = useGameStore(s => s.fetchLeagueStatus)
  const fetchLeaderboard = useGameStore(s => s.fetchLeaderboard)

  useEffect(() => {
    if (isActive) {
      fetchLeagueStatus()
      fetchLeaderboard()
    }
  }, [isActive, fetchLeagueStatus, fetchLeaderboard])

  const handleSubTab = useCallback((tab: SubTab) => {
    setSubTab(tab)
    playSound('tab_switch', 'LeaguesPanel.subTab')
  }, [playSound])

  const progress = getTierProgress(totalEarned)
  const claimedTiers = leagueStatus?.claimedTiers ?? []

  return (
    <div className="flex flex-col gap-4 p-3" style={{ paddingBottom: 'calc(12px + var(--tg-safe-area-bottom, 0px))' }}>
      {/* Banner */}
      <div className="bg-gradient-to-br from-amber-950/80 to-orange-950/60 border-2 border-orange-700/70 rounded-xl p-5 text-center shadow-2xl shadow-orange-900/50">
        <div className="text-game-xs text-amber-400/70 uppercase tracking-widest mb-2 font-mono">Текущая лига</div>
        <div className="w-10 h-10 rounded-lg bg-orange-800/60 flex items-center justify-center mx-auto mb-2">
          <TierIcon icon={progress.current.icon} className="w-5 h-5 text-amber-400" />
        </div>
        <div className="text-amber-400 text-sm font-bold font-mono">{progress.current.name}</div>
        {leagueStatus && (
          <div className="text-gray-300 text-[9px] mt-2 font-mono">
            Позиция: <span className="text-orange-400 font-bold">#{leagueStatus.rank}</span> из {leagueStatus.totalInTier}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-4">
        <div className="text-[10px] text-gray-300 font-mono font-bold mb-2 text-center">
          {progress.next
            ? `До ${progress.next.name}: ${formatLargeNumber(progress.remaining)} ₽`
            : 'Максимальная лига'}
        </div>
        <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-orange-600 to-amber-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-gray-600 text-[8px] font-mono">{formatLargeNumber(progress.current.threshold)} ₽</span>
          {progress.next && <span className="text-gray-600 text-[8px] font-mono">{formatLargeNumber(progress.next.threshold)} ₽</span>}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-700/50">
        {(['rating', 'tiers', 'rewards'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => handleSubTab(tab)}
            className={`flex-1 py-2 rounded-md text-game-xs font-mono font-bold transition-all active:scale-95
              ${subTab === tab
                ? 'bg-gradient-to-r from-orange-700 to-amber-600 text-white'
                : 'bg-transparent text-gray-500'
              }`}
          >
            {tab === 'rating' ? 'Рейтинг' : tab === 'tiers' ? 'Все лиги' : 'Награды'}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="mt-1">
        {subTab === 'rating' && <RatingSubTab />}
        {subTab === 'tiers' && <TiersSubTab totalEarned={totalEarned} />}
        {subTab === 'rewards' && <RewardsSubTab totalEarned={totalEarned} claimedTiers={claimedTiers} />}
      </div>
    </div>
  )
}

// ── Sub-tab: Рейтинг ──────────────────────────────────────────────

function RatingSubTab() {
  const leaderboard = useGameStore(s => s.leaderboard)
  const leagueLoading = useGameStore(s => s.leagueLoading)

  if (leagueLoading && !leaderboard) {
    return <div className="text-center text-gray-500 text-[9px] py-8 font-mono">Загрузка...</div>
  }
  if (!leaderboard) {
    return <div className="text-center text-gray-500 text-[9px] py-8 font-mono">Нет данных</div>
  }

  return (
    <div className="flex flex-col gap-2">
      {leaderboard.top100.map((entry, i) => (
        <LeaderboardRow key={`top-${i}-${entry.rank}`} entry={entry} />
      ))}

      {leaderboard.neighbors.length > 0 && (
        <>
          <div className="text-center text-gray-600 text-[9px] py-1 font-mono">• • •</div>
          {leaderboard.neighbors.map((entry, i) => (
            <LeaderboardRow key={`nb-${i}-${entry.rank}`} entry={entry} />
          ))}
        </>
      )}
    </div>
  )
}

// ── Sub-tab: Все лиги ──────────────────────────────────────────────

function TiersSubTab({ totalEarned }: { totalEarned: number }) {
  const currentTier = getCurrentTier(totalEarned)

  return (
    <div className="flex flex-col gap-2">
      <div className="text-center text-gray-600 text-[8px] font-mono">
        Лиги не сбрасываются — прогресс навсегда
      </div>

      {LEAGUE_TIERS.map(tier => {
        const isPast = totalEarned >= tier.threshold && tier.id < currentTier.id
        const isCurrent = tier.id === currentTier.id
        const isNext = tier.id === currentTier.id + 1
        const isFuture = tier.id > currentTier.id + 1

        return (
          <TierRow
            key={tier.id}
            tier={tier}
            isPast={isPast}
            isCurrent={isCurrent}
            isNext={isNext}
            opacity={isFuture ? Math.max(0.4, 0.6 - (tier.id - currentTier.id - 1) * 0.06) : 1}
          />
        )
      })}
    </div>
  )
}

function TierRow({ tier, isPast, isCurrent, isNext, opacity }: {
  tier: LeagueTier; isPast: boolean; isCurrent: boolean; isNext: boolean; opacity: number
}) {
  let containerClass = 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50'
  let badge = ''
  let badgeClass = ''
  let iconBg = 'bg-gray-700/60'

  if (isPast) {
    containerClass = 'bg-gradient-to-br from-gray-800 to-gray-900 border-l-2 border-l-green-500/40 border-y border-r border-gray-700/50'
    badge = 'пройдено'
    badgeClass = 'text-green-500/60 text-[7px]'
    iconBg = 'bg-green-900/40'
  } else if (isCurrent) {
    containerClass = 'bg-gradient-to-br from-orange-950/30 to-gray-900 border-2 border-orange-700 shadow-lg shadow-orange-900/25'
    badge = 'текущая'
    badgeClass = 'bg-orange-500/20 text-orange-400'
    iconBg = 'bg-orange-800/50'
  } else if (isNext) {
    containerClass = 'bg-gradient-to-br from-gray-800 to-gray-900 border-l-2 border-l-amber-400/40 border-y border-r border-gray-700/50'
    badge = 'следующая'
    badgeClass = 'text-amber-400/60 text-[7px]'
    iconBg = 'bg-amber-900/30'
  }

  return (
    <div className={`flex items-center rounded-lg p-3 ${containerClass}`} style={{ opacity }}>
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <TierIcon icon={tier.icon} className={`w-5 h-5 ${isCurrent ? 'text-orange-400' : isPast ? 'text-green-400' : isNext ? 'text-amber-400' : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 ml-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold font-mono ${isCurrent ? 'text-orange-400' : isPast ? 'text-gray-400' : isNext ? 'text-white' : 'text-gray-400'}`}>
            {tier.name}
          </span>
          {badge && (
            <span className={`font-mono ${badgeClass.includes('bg-') ? 'text-[7px] px-1.5 py-0.5 rounded' : ''} ${badgeClass}`}>{badge}</span>
          )}
        </div>
        <div className={`text-game-xs font-mono mt-0.5 ${isNext ? 'text-amber-400 font-bold' : 'text-gray-500'}`}>
          от {formatLargeNumber(tier.threshold)} ₽
        </div>
      </div>
      <div className={`text-[9px] font-bold font-mono flex items-center gap-1 ${isPast ? 'text-green-400' : isNext ? 'text-amber-400' : isCurrent ? 'text-green-400' : 'text-gray-500'}`}>
        {tier.reward > 0 ? (
          <>+{tier.reward} <Hexagon className="w-3.5 h-3.5" /></>
        ) : '—'}
      </div>
    </div>
  )
}

// ── Sub-tab: Награды ──────────────────────────────────────────────

function RewardsSubTab({ totalEarned, claimedTiers }: { totalEarned: number; claimedTiers: number[] }) {
  const currentTier = getCurrentTier(totalEarned)
  const progress = getTierProgress(totalEarned)
  const rewardTiers = LEAGUE_TIERS.filter(t => t.reward > 0)
  const totalClaimed = rewardTiers.filter(t => claimedTiers.includes(t.id)).reduce((s, t) => s + t.reward, 0)
  const totalAll = rewardTiers.reduce((s, t) => s + t.reward, 0)
  const nextRewardTier = rewardTiers.find(t => !claimedTiers.includes(t.id) && totalEarned < t.threshold)
    ?? rewardTiers.find(t => !claimedTiers.includes(t.id))

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-4">
        <div className="grid grid-cols-3 text-center">
          <div>
            <div className="text-gray-500 text-game-xs tracking-widest font-mono uppercase">Получено</div>
            <div className="text-green-400 text-base font-bold font-mono flex items-center justify-center gap-1 tabular-nums">{totalClaimed} <Hexagon className="w-4 h-4" /></div>
          </div>
          <div>
            <div className="text-gray-500 text-game-xs tracking-widest font-mono uppercase">Следующая</div>
            <div className="text-amber-400 text-base font-bold font-mono flex items-center justify-center gap-1 tabular-nums">{nextRewardTier?.reward ?? '—'} <Hexagon className="w-4 h-4" /></div>
          </div>
          <div>
            <div className="text-gray-500 text-game-xs tracking-widest font-mono uppercase">Всего</div>
            <div className="text-gray-400 text-base font-bold font-mono flex items-center justify-center gap-1 tabular-nums">{totalAll} <Hexagon className="w-4 h-4" /></div>
          </div>
        </div>
      </div>

      <div className="text-center text-gray-700 text-[7px] font-mono">Награда выдаётся один раз при переходе в лигу</div>

      {/* Timeline */}
      <div className="pl-1">
        {rewardTiers.map((tier, i) => {
          const isClaimed = claimedTiers.includes(tier.id)
          const isNext = tier.id === nextRewardTier?.id
          const isFuture = !isClaimed && !isNext

          return (
            <div key={tier.id}>
              <div className={`flex items-center py-1 ${isFuture ? 'opacity-40' : ''}`}>
                <div className="w-8 flex flex-col items-center">
                  {isClaimed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : isNext ? (
                    <div className="w-6 h-6 rounded-full border-2 border-amber-400 bg-amber-400/10 flex items-center justify-center">
                      <TierIcon icon={tier.icon} className="w-3 h-3 text-amber-400" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center">
                      <TierIcon icon={tier.icon} className="w-3 h-3 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 ml-3">
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-mono ${isNext ? 'text-amber-400 font-bold' : isClaimed ? 'text-gray-400' : 'text-gray-500'}`}>
                      {tier.name}
                      {isClaimed && tier.id === currentTier.id && <span className="text-gray-500 text-game-xs ml-1.5 font-mono">&larr; ты здесь</span>}
                    </span>
                    <span className={`text-[9px] font-bold font-mono flex items-center gap-0.5 ${isClaimed ? 'text-green-400' : isNext ? 'text-amber-400' : 'text-gray-500'}`}>
                      +{tier.reward} <Hexagon className="w-3 h-3" />
                    </span>
                  </div>
                  {isNext && progress.next && (
                    <div className="text-gray-500 text-game-xs mt-0.5 font-mono">осталось {formatLargeNumber(progress.remaining)} ₽</div>
                  )}
                </div>
              </div>
              {/* Connector line */}
              {i < rewardTiers.length - 1 && (
                <div className={`w-px h-4 ml-[15px] ${isClaimed ? 'bg-green-500' : 'bg-gray-700'}`}
                  style={{ opacity: isFuture ? 0.4 : 1 }}
                />
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}

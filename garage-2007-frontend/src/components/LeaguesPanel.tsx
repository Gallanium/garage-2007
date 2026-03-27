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

export default function LeaguesPanel() {
  const { playSound } = useAudio()
  const [subTab, setSubTab] = useState<SubTab>('rating')
  const totalEarned = useGameStore(s => s.totalEarned)
  const leagueStatus = useGameStore(s => s.leagueStatus)
  const fetchLeagueStatus = useGameStore(s => s.fetchLeagueStatus)
  const fetchLeaderboard = useGameStore(s => s.fetchLeaderboard)

  useEffect(() => {
    fetchLeagueStatus()
    fetchLeaderboard()
  }, [fetchLeagueStatus, fetchLeaderboard])

  const handleSubTab = useCallback((tab: SubTab) => {
    setSubTab(tab)
    playSound('tab_switch', 'LeaguesPanel.subTab')
  }, [playSound])

  const progress = getTierProgress(totalEarned)
  const claimedTiers = leagueStatus?.claimedTiers ?? []

  return (
    <div className="flex flex-col gap-3 p-3" style={{ paddingBottom: 'calc(12px + var(--tg-safe-area-bottom, 0px))' }}>
      {/* Banner */}
      <div className="bg-gradient-to-br from-amber-950/80 to-orange-950/60 border-2 border-orange-700/70 rounded-xl p-4 text-center shadow-2xl shadow-orange-900/30">
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
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
        <div className="flex justify-between text-game-xs text-gray-500 mb-1.5 font-mono">
          <span>{progress.current.name}</span>
          <span>{progress.next?.name ?? 'MAX'}</span>
        </div>
        <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-orange-600 to-amber-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-amber-400 text-[9px] font-bold font-mono">{formatLargeNumber(totalEarned)} ₽</span>
          {progress.next && (
            <span className="text-gray-500 text-game-xs font-mono">
              до перехода: <span className="text-orange-400">{formatLargeNumber(progress.remaining)} ₽</span>
            </span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1">
        {(['rating', 'tiers', 'rewards'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => handleSubTab(tab)}
            className={`flex-1 py-1.5 rounded text-game-xs font-mono font-bold transition-all active:scale-95
              ${subTab === tab
                ? 'bg-gradient-to-r from-orange-700 to-amber-600 text-white'
                : 'bg-gray-900 text-gray-500 border border-gray-700/50'
              }`}
          >
            {tab === 'rating' ? 'Рейтинг' : tab === 'tiers' ? 'Все лиги' : 'Награды'}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'rating' && <RatingSubTab />}
      {subTab === 'tiers' && <TiersSubTab totalEarned={totalEarned} />}
      {subTab === 'rewards' && <RewardsSubTab totalEarned={totalEarned} claimedTiers={claimedTiers} />}
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
      {leaderboard.top100.map(entry => (
        <LeaderboardRow key={`top-${entry.rank}`} entry={entry} />
      ))}

      {leaderboard.neighbors.length > 0 && (
        <>
          <div className="text-center text-gray-600 text-[9px] py-1 font-mono">• • •</div>
          {leaderboard.neighbors.map(entry => (
            <LeaderboardRow key={`nb-${entry.rank}`} entry={entry} />
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
      <div className="text-center text-gray-500 text-game-xs tracking-widest mb-1 font-mono uppercase">
        Лиги не сбрасываются • Прогресс навсегда
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
            opacity={isFuture ? Math.max(0.3, 0.55 - (tier.id - currentTier.id - 1) * 0.08) : 1}
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
    containerClass = 'bg-gradient-to-br from-gray-800 to-gray-900 border-l-[3px] border-l-green-500 border-y border-r border-gray-700/50'
    badge = 'пройдено'
    badgeClass = 'bg-green-500/20 text-green-400'
    iconBg = 'bg-green-900/40'
  } else if (isCurrent) {
    containerClass = 'bg-gradient-to-br from-orange-950/30 to-gray-900 border-2 border-orange-700 shadow-lg shadow-orange-900/25'
    badge = 'текущая'
    badgeClass = 'bg-orange-500/20 text-orange-400'
    iconBg = 'bg-orange-800/50'
  } else if (isNext) {
    containerClass = 'bg-gradient-to-br from-gray-800 to-gray-900 border-l-[3px] border-l-amber-400 border-y border-r border-amber-400/30'
    badge = 'следующая'
    badgeClass = 'bg-amber-400/20 text-amber-400'
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
            <span className={`text-[7px] px-1.5 py-0.5 rounded font-mono ${badgeClass}`}>{badge}</span>
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
    <div className="flex flex-col gap-0">
      {/* Summary */}
      <div className="flex justify-between px-1 mb-3">
        <div>
          <div className="text-gray-500 text-game-xs tracking-widest font-mono uppercase">Получено</div>
          <div className="text-green-400 text-base font-bold font-mono flex items-center gap-1 tabular-nums">{totalClaimed} <Hexagon className="w-4 h-4" /></div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-game-xs tracking-widest font-mono uppercase">Следующая</div>
          <div className="text-amber-400 text-base font-bold font-mono flex items-center gap-1 tabular-nums">{nextRewardTier?.reward ?? '—'} <Hexagon className="w-4 h-4" /></div>
        </div>
        <div className="text-right">
          <div className="text-gray-500 text-game-xs tracking-widest font-mono uppercase">Всего</div>
          <div className="text-gray-400 text-base font-bold font-mono flex items-center gap-1 tabular-nums">{totalAll} <Hexagon className="w-4 h-4" /></div>
        </div>
      </div>

      <div className="h-px bg-gray-700/50 mb-3" />

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

      {/* Info note */}
      <div className="text-center mt-4 py-2 px-3 border border-orange-700/30 bg-orange-700/5 rounded-lg">
        <span className="text-orange-700 text-[8px] font-mono">Награда выдаётся один раз при переходе в лигу</span>
      </div>
    </div>
  )
}

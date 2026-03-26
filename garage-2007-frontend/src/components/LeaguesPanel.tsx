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
    <div className="flex flex-col gap-3 p-3 font-mono">
      {/* Banner */}
      <div className="bg-gradient-to-br from-amber-950/80 to-orange-950/60 border-2 border-orange-700/70 rounded-xl p-4 text-center shadow-2xl shadow-orange-900/30">
        <div className="text-[6px] text-amber-400/70 uppercase tracking-widest mb-2">Текущая лига</div>
        <TierIcon icon={progress.current.icon} className="w-6 h-6 mx-auto text-amber-400 mb-1" />
        <div className="text-amber-400 text-sm font-bold">{progress.current.name}</div>
        {leagueStatus && (
          <div className="text-gray-300 text-[8px] mt-2">
            Позиция: <span className="text-orange-400 font-bold">#{leagueStatus.rank}</span> из {leagueStatus.totalInTier}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="flex justify-between text-[6px] text-gray-500 mb-1">
          <span>{progress.current.name}</span>
          <span>{progress.next?.name ?? 'MAX'}</span>
        </div>
        <div className="bg-gray-800 rounded h-2.5 overflow-hidden border border-gray-700">
          <div
            className="bg-gradient-to-r from-amber-500 to-orange-600 h-full rounded transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-amber-400 text-[8px] font-bold">{formatLargeNumber(totalEarned)} ₽</span>
          {progress.next && (
            <span className="text-gray-500 text-[6px]">
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
            className={`flex-1 py-1.5 rounded text-[7px] font-bold transition-all active:scale-95
              ${subTab === tab
                ? 'bg-gradient-to-r from-orange-700 to-amber-600 text-white'
                : 'bg-gray-900 text-gray-500 border border-gray-800'
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
    <div className="flex flex-col gap-1">
      {leaderboard.top100.map(entry => (
        <LeaderboardRow key={`top-${entry.rank}`} entry={entry} />
      ))}

      {leaderboard.neighbors.length > 0 && (
        <>
          <div className="text-center text-gray-600 text-[8px] py-1 font-mono">• • •</div>
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
    <div className="flex flex-col gap-1 font-mono">
      <div className="text-center text-gray-600 text-[5px] tracking-widest mb-1">
        ЛИГИ НЕ СБРАСЫВАЮТСЯ • ПРОГРЕСС НАВСЕГДА
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
  let borderClass = 'border-l-[3px] border-l-gray-700 bg-gray-950'
  let badge = ''
  let badgeClass = ''

  if (isPast) {
    borderClass = 'border-l-[3px] border-l-green-500 bg-gray-900'
    badge = 'пройдено'
    badgeClass = 'bg-green-500/20 text-green-400'
  } else if (isCurrent) {
    borderClass = 'border-2 border-orange-700 bg-gradient-to-r from-orange-950/20 to-gray-900 shadow-lg shadow-orange-900/25'
    badge = 'текущая'
    badgeClass = 'bg-orange-500/20 text-orange-400'
  } else if (isNext) {
    borderClass = 'border-l-[3px] border-l-amber-400 border border-amber-400/30 bg-gray-900'
    badge = 'следующая'
    badgeClass = 'bg-amber-400/20 text-amber-400'
  }

  return (
    <div className={`flex items-center rounded-lg p-2.5 font-mono ${borderClass}`} style={{ opacity }}>
      <TierIcon icon={tier.icon} className={`w-4 h-4 ${isCurrent ? 'text-orange-400' : isPast ? 'text-green-400' : 'text-gray-400'}`} />
      <div className="flex-1 ml-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[8px] ${isCurrent ? 'text-orange-400 font-bold' : isPast ? 'text-gray-500' : isNext ? 'text-white' : 'text-gray-500'}`}>
            {tier.name}
          </span>
          {badge && (
            <span className={`text-[5px] px-1 py-0.5 rounded ${badgeClass}`}>{badge}</span>
          )}
        </div>
        <div className={`text-[6px] ${isNext ? 'text-amber-400 font-bold' : 'text-gray-600'}`}>
          от {formatLargeNumber(tier.threshold)} ₽
        </div>
      </div>
      <div className={`text-[7px] font-bold flex items-center gap-0.5 ${isPast ? 'text-green-400' : isNext ? 'text-amber-400' : isCurrent ? 'text-green-400' : 'text-gray-600'}`}>
        {tier.reward > 0 ? (
          <>+{tier.reward} <Hexagon className="w-2.5 h-2.5" /></>
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
    <div className="flex flex-col gap-0 font-mono">
      {/* Summary */}
      <div className="flex justify-between px-1 mb-3">
        <div>
          <div className="text-gray-600 text-[5px] tracking-widest">ПОЛУЧЕНО</div>
          <div className="text-green-400 text-sm font-bold flex items-center gap-0.5">{totalClaimed} <Hexagon className="w-3 h-3" /></div>
        </div>
        <div className="text-center">
          <div className="text-gray-600 text-[5px] tracking-widest">СЛЕДУЮЩАЯ</div>
          <div className="text-amber-400 text-sm font-bold flex items-center gap-0.5">{nextRewardTier?.reward ?? '—'} <Hexagon className="w-3 h-3" /></div>
        </div>
        <div className="text-right">
          <div className="text-gray-600 text-[5px] tracking-widest">ВСЕГО</div>
          <div className="text-gray-500 text-sm font-bold flex items-center gap-0.5">{totalAll} <Hexagon className="w-3 h-3" /></div>
        </div>
      </div>

      <div className="h-px bg-gray-800 mb-3" />

      {/* Timeline */}
      <div className="pl-0.5">
        {rewardTiers.map((tier, i) => {
          const isClaimed = claimedTiers.includes(tier.id)
          const isNext = tier.id === nextRewardTier?.id
          const isFuture = !isClaimed && !isNext

          return (
            <div key={tier.id}>
              <div className={`flex items-center ${isFuture ? 'opacity-40' : ''}`}>
                <div className="w-7 flex flex-col items-center">
                  {isClaimed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : isNext ? (
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-amber-400 bg-amber-400/10 flex items-center justify-center">
                      <TierIcon icon={tier.icon} className="w-2.5 h-2.5 text-amber-400" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-700 flex items-center justify-center">
                      <TierIcon icon={tier.icon} className="w-2.5 h-2.5 text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 ml-2.5">
                  <div className="flex justify-between items-center">
                    <span className={`text-[7px] ${isNext ? 'text-amber-400 font-bold' : isClaimed ? 'text-gray-500' : 'text-gray-600'}`}>
                      {tier.name}
                      {isClaimed && tier.id === currentTier.id && <span className="text-gray-600 text-[5px] ml-1">&larr; ты здесь</span>}
                    </span>
                    <span className={`text-[7px] font-bold flex items-center gap-0.5 ${isClaimed ? 'text-green-400' : isNext ? 'text-amber-400' : 'text-gray-600'}`}>
                      +{tier.reward} <Hexagon className="w-2 h-2" />
                    </span>
                  </div>
                  {isNext && progress.next && (
                    <div className="text-gray-500 text-[5px] mt-0.5">осталось {formatLargeNumber(progress.remaining)} ₽</div>
                  )}
                </div>
              </div>
              {/* Connector line */}
              {i < rewardTiers.length - 1 && (
                <div className={`w-px h-3.5 ml-[13px] ${isClaimed ? 'bg-green-500' : 'bg-gray-700'}`}
                  style={{ opacity: isFuture ? 0.4 : 1 }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Info note */}
      <div className="text-center mt-4 py-1.5 px-3 border border-orange-700/30 bg-orange-700/5 rounded-lg">
        <span className="text-orange-700 text-[5px]">награда выдаётся один раз при переходе в лигу</span>
      </div>
    </div>
  )
}

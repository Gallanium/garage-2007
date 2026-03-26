// shared/constants/leagues.ts
import type { LeagueTier } from '../types/leagues.js'

export const LEAGUE_TIERS: readonly LeagueTier[] = [
  { id: 1, name: 'Новичок',      icon: 'Shield',   threshold: 0,                       reward: 0 },
  { id: 2, name: 'Подмастерье',  icon: 'Wrench',   threshold: 50_000,                  reward: 10 },
  { id: 3, name: 'Мастер',       icon: 'Settings',  threshold: 1_000_000,               reward: 25 },
  { id: 4, name: 'Профессионал', icon: 'HardHat',  threshold: 50_000_000,              reward: 50 },
  { id: 5, name: 'Эксперт',      icon: 'Zap',      threshold: 1_000_000_000,           reward: 100 },
  { id: 6, name: 'Элита',        icon: 'Star',     threshold: 50_000_000_000,          reward: 200 },
  { id: 7, name: 'Легенда',      icon: 'Gem',      threshold: 1_000_000_000_000,       reward: 500 },
  { id: 8, name: 'Магнат',       icon: 'Crown',    threshold: 1_000_000_000_000_000,   reward: 1000 },
] as const

export function getCurrentTier(totalEarned: number): LeagueTier {
  for (let i = LEAGUE_TIERS.length - 1; i >= 0; i--) {
    if (totalEarned >= LEAGUE_TIERS[i].threshold) return LEAGUE_TIERS[i]
  }
  return LEAGUE_TIERS[0]
}

export function getNextTier(totalEarned: number): LeagueTier | null {
  const current = getCurrentTier(totalEarned)
  const idx = LEAGUE_TIERS.findIndex(t => t.id === current.id)
  return idx < LEAGUE_TIERS.length - 1 ? LEAGUE_TIERS[idx + 1] : null
}

export function getTierProgress(totalEarned: number): {
  current: LeagueTier
  next: LeagueTier | null
  percent: number
  remaining: number
} {
  const current = getCurrentTier(totalEarned)
  const next = getNextTier(totalEarned)
  if (!next) return { current, next: null, percent: 100, remaining: 0 }
  const range = next.threshold - current.threshold
  const progress = totalEarned - current.threshold
  return {
    current,
    next,
    percent: Math.min(100, Math.floor((progress / range) * 100)),
    remaining: next.threshold - totalEarned,
  }
}

export function getUnclaimedTierRewards(totalEarned: number, claimed: number[]): LeagueTier[] {
  return LEAGUE_TIERS.filter(t => t.reward > 0 && totalEarned >= t.threshold && !claimed.includes(t.id))
}

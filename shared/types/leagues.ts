// shared/types/leagues.ts

export interface LeagueTier {
  readonly id: number
  readonly name: string
  readonly icon: string      // lucide-react icon component name
  readonly threshold: number  // totalEarned threshold
  readonly reward: number     // one-time nuts reward
}

export interface LeagueStatusResponse {
  currentTier: LeagueTier
  nextTier: LeagueTier | null
  totalEarned: number
  progressPercent: number
  remainingToNext: number
  rank: number
  totalInTier: number
  claimedTiers: number[]
}

export interface LeaderboardEntry {
  rank: number
  name: string
  totalEarned: number
  isCurrentUser: boolean
}

export interface LeaderboardResponse {
  top100: LeaderboardEntry[]
  neighbors: LeaderboardEntry[]
  playerRank: number
  totalInTier: number
}

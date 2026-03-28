import { AppError } from '../middleware/errorHandler.js'
import { prisma } from '../utils/prisma.js'
import { getCurrentTier, getNextTier, getTierProgress, getUnclaimedTierRewards } from '@shared/constants/leagues.js'
import { logBalanceChange } from './auditService.js'
import { logger } from '../utils/logger.js'
import type { LeagueStatusResponse, LeaderboardEntry, LeaderboardResponse } from '@shared/types/leagues.js'
import type { GameSave, Prisma } from '@prisma/client'

export async function getLeagueStatus(userId: number): Promise<LeagueStatusResponse> {
  const gs = await prisma.gameSave.findUnique({ where: { userId } })
  if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

  const progress = getTierProgress(gs.totalEarned)
  const tier = progress.current
  const nextTier = progress.next
  const tierMax = nextTier?.threshold ?? Number.MAX_SAFE_INTEGER

  const rankResult = await prisma.$queryRaw<Array<{ rank: number; total: number }>>`
    SELECT
      (SELECT COUNT(*)::int + 1 FROM game_saves
       WHERE total_earned > ${gs.totalEarned}
         AND total_earned >= ${tier.threshold}
         AND total_earned < ${tierMax}) as rank,
      (SELECT COUNT(*)::int FROM game_saves
       WHERE total_earned >= ${tier.threshold}
         AND total_earned < ${tierMax}) as total
  `
  const { rank, total } = rankResult[0] ?? { rank: 0, total: 0 }

  return {
    currentTier: tier,
    nextTier,
    totalEarned: gs.totalEarned,
    progressPercent: progress.percent,
    remainingToNext: progress.remaining,
    rank,
    totalInTier: total,
    claimedTiers: gs.claimedLeagueTiers,
  }
}

export async function getLeaderboard(userId: number): Promise<LeaderboardResponse> {
  const gs = await prisma.gameSave.findUnique({ where: { userId } })
  if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

  const tier = getCurrentTier(gs.totalEarned)
  const nextTier = getNextTier(gs.totalEarned)
  const tierMax = nextTier?.threshold ?? Number.MAX_SAFE_INTEGER

  const top100Raw = await prisma.$queryRaw<Array<{
    id: number; first_name: string | null; username: string | null; total_earned: number; rank: number
  }>>`
    SELECT u.id, u.first_name, u.username, gs.total_earned,
           RANK() OVER (ORDER BY gs.total_earned DESC)::int as rank
    FROM game_saves gs
    JOIN users u ON u.id = gs.user_id
    WHERE gs.total_earned >= ${tier.threshold}
      AND gs.total_earned < ${tierMax}
    ORDER BY gs.total_earned DESC
    LIMIT 100
  `

  const playerRankResult = await prisma.$queryRaw<Array<{ rank: number; total: number }>>`
    SELECT
      (SELECT COUNT(*)::int + 1 FROM game_saves
       WHERE total_earned > ${gs.totalEarned}
         AND total_earned >= ${tier.threshold}
         AND total_earned < ${tierMax}) as rank,
      (SELECT COUNT(*)::int FROM game_saves
       WHERE total_earned >= ${tier.threshold}
         AND total_earned < ${tierMax}) as total
  `
  const playerRank = playerRankResult[0]?.rank ?? 0
  const totalInTier = playerRankResult[0]?.total ?? 0

  let neighborsRaw: typeof top100Raw = []
  if (playerRank > 100) {
    // Offset-based approach: skip to player's vicinity without materializing full RANK() CTE.
    // Uses RANK() (not ROW_NUMBER) for consistency with top100 query — ties get equal ranks.
    const offset = Math.max(0, playerRank - 6) // 5 above the player (0-indexed offset)
    neighborsRaw = await prisma.$queryRaw`
      SELECT sub.id, sub.first_name, sub.username, sub.total_earned,
             (${offset} + sub.rn)::int as rank
      FROM (
        SELECT u.id, u.first_name, u.username, gs.total_earned,
               RANK() OVER (ORDER BY gs.total_earned DESC)::int as rn
        FROM game_saves gs
        JOIN users u ON u.id = gs.user_id
        WHERE gs.total_earned >= ${tier.threshold}
          AND gs.total_earned < ${tierMax}
        ORDER BY gs.total_earned DESC
        OFFSET ${offset}
        LIMIT 11
      ) sub
    `
  }

  const mapEntry = (row: typeof top100Raw[0]): LeaderboardEntry => ({
    rank: row.rank,
    name: row.first_name || row.username || 'Игрок',
    totalEarned: row.total_earned,
    isCurrentUser: row.id === userId,
  })

  return {
    top100: top100Raw.map(mapEntry),
    neighbors: neighborsRaw.map(mapEntry),
    playerRank,
    totalInTier,
  }
}

export async function checkAndClaimTierRewards(
  userId: number,
  gameSave: GameSave,
  tx: Prisma.TransactionClient,
): Promise<{ claimedTiers: number[]; nutsAwarded: number }> {
  const unclaimed = getUnclaimedTierRewards(gameSave.totalEarned, gameSave.claimedLeagueTiers)
  if (unclaimed.length === 0) return { claimedTiers: [], nutsAwarded: 0 }

  const totalNuts = unclaimed.reduce((sum, t) => sum + t.reward, 0)
  const newClaimedIds = unclaimed.map(t => t.id)
  const allClaimed = [...gameSave.claimedLeagueTiers, ...newClaimedIds]

  // Guard: prevent duplicate tier IDs (OCC normally prevents this, but defensive check)
  if (new Set(allClaimed).size !== allClaimed.length) {
    logger.warn({ userId, allClaimed }, 'duplicate_tier_claim_prevented')
    return { claimedTiers: [], nutsAwarded: 0 }
  }

  await tx.gameSave.update({
    where: { userId },
    data: {
      nuts: { increment: totalNuts },
      claimedLeagueTiers: allClaimed,
    },
  })

  let runningNuts = gameSave.nuts
  for (const tier of unclaimed) {
    const afterNuts = runningNuts + tier.reward
    await tx.balanceLog.create({
      data: {
        userId,
        actionType: 'league_promotion',
        currency: 'nuts',
        amount: tier.reward,
        balanceBefore: runningNuts,
        balanceAfter: afterNuts,
        metadata: { tierId: tier.id, tierName: tier.name },
      },
    })
    logBalanceChange({
      userId,
      actionType: 'league_promotion',
      currency: 'nuts',
      amount: tier.reward,
      balanceBefore: runningNuts,
      balanceAfter: afterNuts,
      metadata: { tierId: tier.id, tierName: tier.name },
    })
    runningNuts = afterNuts
  }

  logger.info({ userId, tiers: newClaimedIds, nutsAwarded: totalNuts }, 'league_promotion')
  return { claimedTiers: newClaimedIds, nutsAwarded: totalNuts }
}

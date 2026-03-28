import crypto from 'node:crypto'
import { prisma } from '../utils/prisma.js'
import {
  REFERRAL_REWARD_INVITER,
  REFERRAL_REWARD_INVITEE,
  REFERRAL_ACTIVATION_LEVEL,
  REFERRAL_CODE_LENGTH,
  getUnclaimedMilestones,
} from '@shared/constants/referrals.js'
import type { ReferralStatusResponse } from '@shared/types/referrals.js'
import { REFERRAL_MILESTONES } from '@shared/constants/referrals.js'
import { logBalanceChange } from './auditService.js'
import { logger } from '../utils/logger.js'
import type { GameSave, Prisma } from '@prisma/client'

// Characters excluding ambiguous: 0/O, 1/l/I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

function generateCode(): string {
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH)
  let code = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return code
}

/**
 * Generate a unique referral code for the user.
 * If they already have one, return the existing code.
 */
export async function generateReferralCode(userId: number): Promise<string> {
  // Check if user already has a code
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } })
  if (user?.referralCode) return user.referralCode

  // Try up to 5 times to generate a unique code
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      })
      logger.info({ userId, code }, 'referral_code_generated')
      return code
    } catch (err: unknown) {
      // Unique constraint violation — retry with a new code
      const prismaErr = err as { code?: string }
      if (prismaErr.code === 'P2002') continue
      throw err
    }
  }

  throw new Error('Failed to generate unique referral code after 5 attempts')
}

/**
 * Get referral status for a user: code, active referrals, total earned, claimed milestones.
 */
export async function getReferralStatus(userId: number): Promise<ReferralStatusResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referralCode: true,
      referrals: {
        select: {
          id: true,
          gameSave: {
            select: { garageLevel: true },
          },
        },
      },
    },
  })

  if (!user) throw new Error('User not found')

  const gs = await prisma.gameSave.findUnique({
    where: { userId },
    select: { claimedReferralMilestones: true, nuts: true },
  })

  const activeReferrals = user.referrals.filter(
    r => r.gameSave && r.gameSave.garageLevel >= REFERRAL_ACTIVATION_LEVEL,
  ).length

  // Sum all referral-related nuts from BalanceLog
  const totalEarnedResult = await prisma.balanceLog.aggregate({
    where: {
      userId,
      currency: 'nuts',
      actionType: { in: ['referral_inviter_bonus', 'referral_milestone'] },
    },
    _sum: { amount: true },
  })

  return {
    referralCode: user.referralCode,
    activeReferrals,
    totalEarned: totalEarnedResult._sum.amount ?? 0,
    claimedMilestones: gs?.claimedReferralMilestones ?? [],
    milestones: [...REFERRAL_MILESTONES],
  }
}

/**
 * Link a new user to an inviter via referral code.
 * Awards the invitee a starter bonus of nuts.
 */
export async function linkReferral(newUserId: number, referralCode: string): Promise<void> {
  const inviter = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true },
  })

  if (!inviter) {
    logger.warn({ newUserId, referralCode }, 'referral_code_not_found')
    return
  }

  // Prevent self-referral
  if (inviter.id === newUserId) {
    logger.warn({ newUserId, referralCode }, 'referral_self_referral')
    return
  }

  // Check if user already has a referrer
  const user = await prisma.user.findUnique({
    where: { id: newUserId },
    select: { referredBy: true },
  })

  if (user?.referredBy) {
    logger.warn({ newUserId, existingReferrer: user.referredBy }, 'referral_already_linked')
    return
  }

  await prisma.$transaction(async (tx) => {
    // Link user to inviter
    await tx.user.update({
      where: { id: newUserId },
      data: { referredBy: inviter.id },
    })

    // Give invitee starter bonus — only if they have a game save
    const gs = await tx.gameSave.findUnique({
      where: { userId: newUserId },
      select: { nuts: true },
    })

    if (gs) {
      await tx.gameSave.update({
        where: { userId: newUserId },
        data: { nuts: { increment: REFERRAL_REWARD_INVITEE } },
      })

      await tx.balanceLog.create({
        data: {
          userId: newUserId,
          actionType: 'referral_invitee_bonus',
          currency: 'nuts',
          amount: REFERRAL_REWARD_INVITEE,
          balanceBefore: gs.nuts,
          balanceAfter: gs.nuts + REFERRAL_REWARD_INVITEE,
          metadata: { inviterId: inviter.id },
        },
      })
    }
  })

  logBalanceChange({
    userId: newUserId,
    actionType: 'referral_invitee_bonus',
    currency: 'nuts',
    amount: REFERRAL_REWARD_INVITEE,
    balanceBefore: 0,
    balanceAfter: REFERRAL_REWARD_INVITEE,
    metadata: { inviterId: inviter.id, referralCode },
  })

  logger.info({ newUserId, inviterId: inviter.id, referralCode }, 'referral_linked')
}

/**
 * Check if the user qualifies for inviter bonus (garageLevel >= 2 + has referredBy).
 * Awards the inviter nuts and checks for milestone rewards.
 * Runs inside a Prisma transaction.
 */
export async function checkAndClaimReferralRewards(
  userId: number,
  gameSave: GameSave,
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (gameSave.garageLevel < REFERRAL_ACTIVATION_LEVEL) return

  // Get the user's referrer info
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { referredBy: true },
  })

  if (!user?.referredBy) return

  const inviterId = user.referredBy

  // Idempotency: check if inviter bonus already awarded for this referral
  const existingBonus = await tx.balanceLog.findFirst({
    where: {
      userId: inviterId,
      actionType: 'referral_inviter_bonus',
      metadata: { path: ['referralId'], equals: userId },
    },
  })

  if (!existingBonus) {
    // Award inviter bonus
    const inviterGs = await tx.gameSave.findUnique({
      where: { userId: inviterId },
      select: { nuts: true },
    })

    if (inviterGs) {
      await tx.gameSave.update({
        where: { userId: inviterId },
        data: { nuts: { increment: REFERRAL_REWARD_INVITER } },
      })

      await tx.balanceLog.create({
        data: {
          userId: inviterId,
          actionType: 'referral_inviter_bonus',
          currency: 'nuts',
          amount: REFERRAL_REWARD_INVITER,
          balanceBefore: inviterGs.nuts,
          balanceAfter: inviterGs.nuts + REFERRAL_REWARD_INVITER,
          metadata: { referralId: userId },
        },
      })

      logBalanceChange({
        userId: inviterId,
        actionType: 'referral_inviter_bonus',
        currency: 'nuts',
        amount: REFERRAL_REWARD_INVITER,
        balanceBefore: inviterGs.nuts,
        balanceAfter: inviterGs.nuts + REFERRAL_REWARD_INVITER,
        metadata: { referralId: userId },
      })

      logger.info({ inviterId, referralId: userId }, 'referral_inviter_bonus_awarded')
    }
  }

  // Check milestone rewards for the inviter
  const inviterReferrals = await tx.user.findMany({
    where: { referredBy: inviterId },
    select: {
      gameSave: { select: { garageLevel: true } },
    },
  })

  const activeCount = inviterReferrals.filter(
    r => r.gameSave && r.gameSave.garageLevel >= REFERRAL_ACTIVATION_LEVEL,
  ).length

  const inviterGs = await tx.gameSave.findUnique({
    where: { userId: inviterId },
    select: { claimedReferralMilestones: true, nuts: true },
  })

  if (!inviterGs) return

  const unclaimed = getUnclaimedMilestones(activeCount, inviterGs.claimedReferralMilestones)
  if (unclaimed.length === 0) return

  const totalNuts = unclaimed.reduce((sum, m) => sum + m.reward, 0)
  const newClaimedCounts = unclaimed.map(m => m.count)
  const allClaimed = [...inviterGs.claimedReferralMilestones, ...newClaimedCounts]

  await tx.gameSave.update({
    where: { userId: inviterId },
    data: {
      nuts: { increment: totalNuts },
      claimedReferralMilestones: allClaimed,
    },
  })

  for (const milestone of unclaimed) {
    await tx.balanceLog.create({
      data: {
        userId: inviterId,
        actionType: 'referral_milestone',
        currency: 'nuts',
        amount: milestone.reward,
        balanceBefore: inviterGs.nuts,
        balanceAfter: inviterGs.nuts + milestone.reward,
        metadata: { milestoneCount: milestone.count },
      },
    })

    logBalanceChange({
      userId: inviterId,
      actionType: 'referral_milestone',
      currency: 'nuts',
      amount: milestone.reward,
      balanceBefore: inviterGs.nuts,
      balanceAfter: inviterGs.nuts + milestone.reward,
      metadata: { milestoneCount: milestone.count },
    })
  }

  logger.info(
    { inviterId, milestones: newClaimedCounts, nutsAwarded: totalNuts },
    'referral_milestones_claimed',
  )
}

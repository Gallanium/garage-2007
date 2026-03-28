// shared/constants/referrals.ts
import type { ReferralMilestone } from '../types/referrals.js'

export const REFERRAL_REWARD_INVITER = 15
export const REFERRAL_REWARD_INVITEE = 10
export const REFERRAL_ACTIVATION_LEVEL = 2
export const REFERRAL_CODE_LENGTH = 6

export const REFERRAL_MILESTONES: readonly ReferralMilestone[] = [
  { count: 3,  reward: 30 },
  { count: 5,  reward: 50 },
  { count: 10, reward: 100 },
  { count: 25, reward: 250 },
  { count: 50, reward: 500 },
] as const

export function getUnclaimedMilestones(
  activeCount: number,
  claimed: number[],
): ReferralMilestone[] {
  return REFERRAL_MILESTONES.filter(
    m => activeCount >= m.count && !claimed.includes(m.count),
  )
}

export function getNextMilestone(
  activeCount: number,
): ReferralMilestone | null {
  return REFERRAL_MILESTONES.find(m => m.count > activeCount) ?? null
}

export function getTotalMilestoneRewards(): number {
  return REFERRAL_MILESTONES.reduce((sum, m) => sum + m.reward, 0)
}

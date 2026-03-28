// shared/types/referrals.ts

export interface ReferralMilestone {
  readonly count: number
  readonly reward: number
}

export interface ReferralStatusResponse {
  referralCode: string | null
  activeReferrals: number
  totalEarned: number
  claimedMilestones: number[]
  milestones: ReferralMilestone[]
}

// garage-2007-frontend/tests/referrals.test.ts
import { describe, it, expect } from 'vitest'
import {
  REFERRAL_MILESTONES,
  REFERRAL_REWARD_INVITER,
  REFERRAL_REWARD_INVITEE,
  getUnclaimedMilestones,
  getNextMilestone,
  getTotalMilestoneRewards,
} from '@shared/constants/referrals'

describe('Referral constants', () => {
  it('has 5 milestones', () => {
    expect(REFERRAL_MILESTONES).toHaveLength(5)
  })

  it('rewards are 15 inviter / 10 invitee', () => {
    expect(REFERRAL_REWARD_INVITER).toBe(15)
    expect(REFERRAL_REWARD_INVITEE).toBe(10)
  })

  it('getUnclaimedMilestones finds unclaimed', () => {
    const unclaimed = getUnclaimedMilestones(7, [3])
    expect(unclaimed).toHaveLength(1)
    expect(unclaimed[0].count).toBe(5)
  })

  it('getUnclaimedMilestones returns empty when all claimed', () => {
    expect(getUnclaimedMilestones(5, [3, 5])).toHaveLength(0)
  })

  it('getUnclaimedMilestones returns empty when count too low', () => {
    expect(getUnclaimedMilestones(2, [])).toHaveLength(0)
  })

  it('getNextMilestone returns next uncrossed', () => {
    expect(getNextMilestone(7)?.count).toBe(10)
  })

  it('getNextMilestone returns null at max', () => {
    expect(getNextMilestone(50)).toBeNull()
  })

  it('getTotalMilestoneRewards sums to 930', () => {
    expect(getTotalMilestoneRewards()).toBe(930)
  })
})

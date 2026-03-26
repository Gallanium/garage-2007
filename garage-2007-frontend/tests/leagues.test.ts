import { describe, it, expect } from 'vitest'
import { getCurrentTier, getNextTier, getTierProgress, getUnclaimedTierRewards, LEAGUE_TIERS } from '@shared/constants/leagues'

describe('League tiers', () => {
  it('returns Новичок for 0 totalEarned', () => {
    expect(getCurrentTier(0).name).toBe('Новичок')
  })

  it('returns Подмастерье for 50K', () => {
    expect(getCurrentTier(50_000).name).toBe('Подмастерье')
  })

  it('returns Магнат for max', () => {
    expect(getCurrentTier(1_000_000_000_000_000).name).toBe('Магнат')
  })

  it('getNextTier returns null for Магнат', () => {
    expect(getNextTier(1_000_000_000_000_000)).toBeNull()
  })

  it('getNextTier returns Подмастерье for Новичок', () => {
    expect(getNextTier(0)?.name).toBe('Подмастерье')
  })

  it('getTierProgress computes correctly', () => {
    const p = getTierProgress(25_000)
    expect(p.current.name).toBe('Новичок')
    expect(p.next?.name).toBe('Подмастерье')
    expect(p.percent).toBe(50)
    expect(p.remaining).toBe(25_000)
  })

  it('getTierProgress returns 100% at max tier', () => {
    const p = getTierProgress(2_000_000_000_000_000)
    expect(p.percent).toBe(100)
    expect(p.next).toBeNull()
  })

  it('getUnclaimedTierRewards finds unclaimed tiers', () => {
    const unclaimed = getUnclaimedTierRewards(1_500_000, [2])
    expect(unclaimed).toHaveLength(1)
    expect(unclaimed[0].name).toBe('Мастер')
  })

  it('getUnclaimedTierRewards skips Новичок (0 reward)', () => {
    const unclaimed = getUnclaimedTierRewards(100, [])
    expect(unclaimed).toHaveLength(0)
  })

  it('LEAGUE_TIERS has 8 tiers', () => {
    expect(LEAGUE_TIERS).toHaveLength(8)
  })
})

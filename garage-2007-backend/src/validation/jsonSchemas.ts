import { z } from 'zod'

export const activeBoostSchema = z.object({
  type: z.string(),
  activatedAt: z.number(),
  expiresAt: z.number(),
})

export const parsedBoostsSchema = z.object({
  active: z.array(activeBoostSchema),
}).catch({ active: [] })

export const activeEventSchema = z.object({
  id: z.string(),
  activatedAt: z.number(),
  expiresAt: z.number(),
  eventSeed: z.number(),
})

export const parsedEventsSchema = z.object({
  activeEvent: activeEventSchema.nullable(),
  cooldownEnd: z.number(),
}).catch({ activeEvent: null, cooldownEnd: 0 })

export const dailyRewardsSchema = z.object({
  lastClaimTimestamp: z.number(),
  currentStreak: z.number().int().min(0),
}).catch({ lastClaimTimestamp: 0, currentStreak: 0 })

export const rewardedVideoSchema = z.object({
  lastWatchedTimestamp: z.number(),
  totalWatches: z.number().int().min(0),
}).catch({ lastWatchedTimestamp: 0, totalWatches: 0 })

export const achievementEntrySchema = z.object({
  unlocked: z.boolean(),
  claimed: z.boolean(),
  unlockedAt: z.number().optional(),
})

export const achievementsSchema = z.record(z.string(), achievementEntrySchema)
  .catch({})

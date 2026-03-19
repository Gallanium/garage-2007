import { z } from 'zod'

export const gameStateResponseSchema = z.object({
  balance: z.number(),
  nuts: z.number(),
  totalClicks: z.number(),
  garageLevel: z.number(),
  milestonesPurchased: z.array(z.number()),
  totalEarned: z.number(),
  sessionCount: z.number(),
  lastSessionDate: z.string(),
  peakClickIncome: z.number(),
  totalPlayTimeSeconds: z.number(),
  bestStreak: z.number(),
  upgrades: z.object({
    clickPower: z.object({ level: z.number(), cost: z.number(), baseCost: z.number() }),
    workSpeed: z.object({ level: z.number(), cost: z.number(), baseCost: z.number() }),
  }),
  workers: z.object({
    apprentice: z.object({ count: z.number(), cost: z.number() }),
    mechanic: z.object({ count: z.number(), cost: z.number() }),
    master: z.object({ count: z.number(), cost: z.number() }),
    brigadier: z.object({ count: z.number(), cost: z.number() }),
    director: z.object({ count: z.number(), cost: z.number() }),
  }),
  achievements: z.record(z.object({
    unlocked: z.boolean(),
    claimed: z.boolean(),
    unlockedAt: z.number().optional(),
  })),
  dailyRewards: z.object({
    lastClaimTimestamp: z.number(),
    currentStreak: z.number(),
  }),
  rewardedVideo: z.object({
    lastWatchedTimestamp: z.number(),
    totalWatches: z.number(),
  }),
  boosts: z.object({
    active: z.array(z.object({
      type: z.string(),
      activatedAt: z.number(),
      expiresAt: z.number(),
    })),
  }),
  events: z.object({
    activeEvent: z.object({
      id: z.string(),
      activatedAt: z.number(),
      expiresAt: z.number(),
      eventSeed: z.number(),
    }).nullable(),
    cooldownEnd: z.number(),
  }),
  decorations: z.object({
    owned: z.array(z.string()),
    active: z.array(z.string()),
  }),
}).passthrough()

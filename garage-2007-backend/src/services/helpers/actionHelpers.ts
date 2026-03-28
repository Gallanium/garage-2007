import { parsedBoostsSchema, parsedEventsSchema } from '../../validation/jsonSchemas.js'
import { BOOST_DEFINITIONS } from '@shared/constants/boosts.js'
import { GAME_EVENTS } from '@shared/constants/events.js'
import { ACHIEVEMENTS, getTotalWorkerCount } from '@shared/constants/achievements.js'
import { AppError } from '../../middleware/errorHandler.js'
import type { BoostType, AchievementProgressField, WorkerType } from '@shared/types/game.js'
import type { GameSave } from '@prisma/client'

// ── Internal Types ──────────────────────────────────────────────────────────

export interface ActiveBoostData {
  type: string
  activatedAt: number
  expiresAt: number
}

export interface ParsedBoosts {
  active: ActiveBoostData[]
}

export interface ActiveEventData {
  id: string
  activatedAt: number
  expiresAt: number
  eventSeed: number
}

export interface ParsedEvents {
  activeEvent: ActiveEventData | null
  cooldownEnd: number
}

export type ActionResult = {
  success: boolean
  gameState: Record<string, unknown>
  actionResult: Record<string, unknown>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function parseBoosts(boosts: unknown): ParsedBoosts {
  const parsed = parsedBoostsSchema.parse(boosts)
  const now = Date.now()
  return { active: parsed.active.filter(x => x.expiresAt > now) }
}

export function parseEvents(events: unknown): ParsedEvents {
  const parsed = parsedEventsSchema.parse(events)
  const now = Date.now()
  return {
    activeEvent: parsed.activeEvent && parsed.activeEvent.expiresAt > now ? parsed.activeEvent : null,
    cooldownEnd: parsed.cooldownEnd,
  }
}

export function getBoostMultiplier(boosts: ParsedBoosts, scope: 'income' | 'click'): number {
  let mult = 1
  const now = Date.now()
  for (const b of boosts.active) {
    if (b.expiresAt <= now) continue
    const def = BOOST_DEFINITIONS[b.type as BoostType]
    if (!def) continue
    // income_2x, income_3x apply to both income and click scopes; turbo affects 'click' scope only
    if (b.type === 'income_2x' || b.type === 'income_3x') {
      mult *= def.multiplier
    } else if (scope === 'click' && b.type === 'turbo') {
      mult *= def.multiplier
    }
  }
  return mult
}

export function getEventMultiplier(events: ParsedEvents, scope: 'income' | 'click'): number {
  if (!events.activeEvent) return 1
  const ev = GAME_EVENTS[events.activeEvent.id]
  if (!ev || ev.effect.scope !== scope) return 1
  return ev.effect.multiplier
}

export function getEventCostMultiplier(events: ParsedEvents): number {
  if (!events.activeEvent) return 1
  const ev = GAME_EVENTS[events.activeEvent.id]
  if (!ev || ev.effect.scope !== 'cost') return 1
  return ev.effect.multiplier
}

export async function checkIdempotencyInTx(
  tx: { balanceLog: { findFirst: (args: { where: { idempotencyKey: string } }) => Promise<unknown> } },
  idempotencyKey?: string,
): Promise<void> {
  if (!idempotencyKey) return
  const existing = await tx.balanceLog.findFirst({ where: { idempotencyKey } })
  if (existing) throw new AppError(409, 'IDEMPOTENT_REQUEST', 'This action has already been processed')
}

export function workerCountField(wt: WorkerType): string { return `${wt}Count` }
export function workerCostField(wt: WorkerType): string { return `${wt}Cost` }

export function getAchievementProgress(gs: GameSave, field: AchievementProgressField): number {
  switch (field) {
    case 'garageLevel': return gs.garageLevel
    case 'totalEarned': return gs.totalEarned
    case 'totalClicks': return gs.totalClicks
    case 'totalWorkerCount': return getTotalWorkerCount({
      apprentice: { count: gs.apprenticeCount, cost: 0 },
      mechanic: { count: gs.mechanicCount, cost: 0 },
      master: { count: gs.masterCount, cost: 0 },
      brigadier: { count: gs.brigadierCount, cost: 0 },
      director: { count: gs.directorCount, cost: 0 },
    })
    case 'milestonesCount': return gs.milestonesPurchased.length
  }
}

export function weightedRandomPick<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * totalWeight
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

// src/store/actions/persistenceActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState, UpgradesState, WorkersState, AchievementId, PlayerAchievement } from '../types'
import { saveGameFull, loadGame, calculateOfflineEarnings, clearSave, SAVE_VERSION } from '../../utils/storageService'
import { roundCurrency } from '../../utils/math'
import { BASE_COSTS } from '../constants/economy'
import { DECORATION_CATALOG } from '../constants/decorations'
import { checkAutoLevel } from '../formulas/progression'
import { calculateClickIncome, calculateTotalPassiveIncome } from '../formulas/income'
import { initialState } from '../initialState'

type Slice = Pick<GameStore,
  | 'saveProgress' | 'loadProgress' | 'addOfflineEarnings'
  | 'clearOfflineEarnings' | 'startPassiveIncome' | 'resetGame'
  | 'applyServerState'>

export const createPersistenceSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  saveProgress: () => {
    const s = get()
    const ok = saveGameFull({
      version: SAVE_VERSION,
      timestamp: 0,
      playerData: {
        balance: s.balance,
        nuts: s.nuts,
        totalClicks: s.totalClicks,
        garageLevel: s.garageLevel,
        milestonesPurchased: s.milestonesPurchased,
      },
      upgrades: {
        clickPower: { level: s.upgrades.clickPower.level, cost: s.upgrades.clickPower.cost },
        workSpeed:  { level: s.upgrades.workSpeed.level,  cost: s.upgrades.workSpeed.cost  },
      },
      workers: {
        apprentice: { count: s.workers.apprentice.count, cost: s.workers.apprentice.cost },
        mechanic:   { count: s.workers.mechanic.count,   cost: s.workers.mechanic.cost   },
        master:     { count: s.workers.master.count,     cost: s.workers.master.cost     },
        brigadier:  { count: s.workers.brigadier.count,  cost: s.workers.brigadier.cost  },
        director:   { count: s.workers.director.count,   cost: s.workers.director.cost   },
      },
      stats: {
        totalEarned: s.totalEarned,
        sessionCount: s.sessionCount,
        lastSessionDate: s.lastSessionDate,
        peakClickIncome: s.peakClickIncome,
        totalPlayTimeSeconds: s.totalPlayTimeSeconds,
        bestStreak: s.bestStreak,
      },
      achievements: s.achievements as Record<string, { unlocked: boolean; claimed: boolean; unlockedAt?: number }>,
      dailyRewards: s.dailyRewards,
      rewardedVideo: {
        lastWatchedTimestamp: s.rewardedVideo.lastWatchedTimestamp,
        totalWatches: s.rewardedVideo.totalWatches,
      },
      boosts: {
        active: s.boosts.active.map(b => ({
          type: b.type,
          activatedAt: b.activatedAt,
          expiresAt: b.expiresAt,
        })),
      },
      events: {
        activeEvent: s.events.activeEvent,
        cooldownEnd: s.events.cooldownEnd,
      },
      decorations: {
        owned: s.decorations.owned,
        active: s.decorations.active,
      },
    })
    if (!ok) console.error('[Save] Ошибка сохранения')
  },

  loadProgress: () => {
    const saveData = loadGame()
    if (!saveData) {
      _set({ isLoaded: true, sessionCount: 1, lastSessionDate: new Date().toISOString() })
      return
    }

    const playerDataAny = saveData.playerData as unknown as Record<string, unknown>
    const restoredPurchased: number[] =
      Array.isArray(playerDataAny.milestonesPurchased)
        ? (playerDataAny.milestonesPurchased as number[])
        : []

    // Heal corrupted saves: if garageLevel was set past a milestone without purchasing it,
    // auto-add those milestones to milestonesPurchased to restore consistency.
    const savedGarageLevel = saveData.playerData.garageLevel ?? 1
    for (const ml of [5, 10, 15, 20] as const) {
      if (savedGarageLevel >= ml && !restoredPurchased.includes(ml)) {
        restoredPurchased.push(ml)
      }
    }

    const mechanicSave = saveData.workers.mechanic
    const shouldResetMechanics = mechanicSave?.count > 0 && !restoredPurchased.includes(5)
    const savedWorkers = saveData.workers as unknown as Record<string, { count?: number; cost?: number }>
    const savedBrigadier = savedWorkers.brigadier ?? savedWorkers.foreman

    const restoredWorkers: WorkersState = {
      apprentice: { count: saveData.workers.apprentice.count, cost: saveData.workers.apprentice.cost },
      mechanic:   {
        count: shouldResetMechanics ? 0 : (mechanicSave?.count ?? 0),
        cost:  shouldResetMechanics ? BASE_COSTS.mechanic : (mechanicSave?.cost ?? BASE_COSTS.mechanic),
      },
      master:    { count: savedWorkers.master?.count    ?? 0, cost: savedWorkers.master?.cost    ?? BASE_COSTS.master    },
      brigadier: { count: savedBrigadier?.count         ?? 0, cost: savedBrigadier?.cost         ?? BASE_COSTS.brigadier },
      director:  { count: savedWorkers.director?.count  ?? 0, cost: savedWorkers.director?.cost  ?? BASE_COSTS.director  },
    }

    const restoredUpgrades: UpgradesState = {
      clickPower: { ...initialState.upgrades.clickPower, level: saveData.upgrades.clickPower.level, cost: saveData.upgrades.clickPower.cost },
      workSpeed:  { ...initialState.upgrades.workSpeed,  level: saveData.upgrades.workSpeed.level,  cost: saveData.upgrades.workSpeed.cost  },
    }

    const passiveIncome = calculateTotalPassiveIncome(restoredWorkers as unknown as Record<string, { count: number }>, restoredUpgrades.workSpeed.level)
    const offlineEarnings = calculateOfflineEarnings(passiveIncome, saveData.timestamp, 24)
    const now = Date.now()
    const offlineTimeAway = saveData.timestamp > 0 ? Math.floor((now - saveData.timestamp) / 1000) : 0
    const restoredBoosts = (saveData.boosts?.active ?? [])
      .filter(b => b.expiresAt > now)
      .map(b => ({ type: b.type as import('../types').BoostType, activatedAt: b.activatedAt, expiresAt: b.expiresAt }))

    const savedEvents = saveData.events
    const restoredActiveEvent = savedEvents?.activeEvent && savedEvents.activeEvent.expiresAt > now
      ? savedEvents.activeEvent
      : null
    const restoredEvents = {
      activeEvent: restoredActiveEvent,
      cooldownEnd: savedEvents?.cooldownEnd ?? 0,
    }

    const savedAchievements = (saveData.achievements ?? {}) as Record<string, PlayerAchievement>
    const restoredAchievements: Record<AchievementId, PlayerAchievement> = { ...initialState.achievements }
    for (const key of Object.keys(savedAchievements)) {
      if (key in restoredAchievements) restoredAchievements[key as AchievementId] = savedAchievements[key]
    }

    _set({
      balance: saveData.playerData.balance,
      nuts: saveData.playerData.nuts ?? 0,
      totalClicks: saveData.playerData.totalClicks,
      garageLevel: checkAutoLevel(saveData.playerData.balance, 1, restoredPurchased),
      milestonesPurchased: restoredPurchased,
      clickValue: calculateClickIncome(restoredUpgrades.clickPower.level),
      upgrades: restoredUpgrades,
      workers: restoredWorkers,
      totalEarned: saveData.stats.totalEarned ?? 0,
      sessionCount: (saveData.stats.sessionCount ?? 0) + 1,
      lastSessionDate: new Date().toISOString(),
      passiveIncomePerSecond: passiveIncome,
      isLoaded: true,
      lastOfflineEarnings: offlineEarnings,
      lastOfflineTimeAway: offlineTimeAway,
      peakClickIncome: saveData.stats.peakClickIncome ?? 0,
      totalPlayTimeSeconds: saveData.stats.totalPlayTimeSeconds ?? 0,
      bestStreak: saveData.stats.bestStreak ?? 0,
      achievements: restoredAchievements,
      dailyRewards: saveData.dailyRewards ?? initialState.dailyRewards,
      rewardedVideo: saveData.rewardedVideo
        ? { ...initialState.rewardedVideo, ...saveData.rewardedVideo }
        : initialState.rewardedVideo,
      boosts: { active: restoredBoosts },
      events: restoredEvents,
      decorations: {
        owned: (saveData.decorations?.owned ?? []).filter(id => DECORATION_CATALOG[id]),
        active: (saveData.decorations?.active ?? []).filter(id => DECORATION_CATALOG[id]),
      },
    })

    get().checkForMilestone()
    get().checkAchievements()
    get().checkDailyReward()
  },

  addOfflineEarnings: (amount: number) => {
    _set((s: GameState) => {
      const newBalance = roundCurrency(s.balance + amount)
      const newLevel = checkAutoLevel(newBalance, s.garageLevel, s.milestonesPurchased)
      const result: Partial<GameState> = {
        balance: newBalance,
        totalEarned: roundCurrency(s.totalEarned + amount),
      }
      if (newLevel !== s.garageLevel) result.garageLevel = newLevel
      return result
    })
    get().checkForMilestone()
  },

  clearOfflineEarnings: () => _set({ lastOfflineEarnings: 0, lastOfflineTimeAway: 0 }),

  startPassiveIncome: () => {
    let tick = 0
    const id = setInterval(() => {
      tick++
      get().tickBoosts()
      get().tickEvents()
      const { passiveIncomePerSecond, garageLevel: prevLevel } = get()
      const boostMultiplier = get().getActiveMultiplier('income')
      const eventMultiplier = get().getEventMultiplier('income')
      _set((s: GameState) => {
        const result: Partial<GameState> = {
          momentaryClickIncome: s._clickIncomeThisTick,
          _clickIncomeThisTick: 0,
          peakClickIncome: Math.max(s.peakClickIncome, s._clickIncomeThisTick),
          totalPlayTimeSeconds: s.totalPlayTimeSeconds + 1,
        }
        if (passiveIncomePerSecond > 0) {
          const earned = roundCurrency(passiveIncomePerSecond * boostMultiplier * eventMultiplier)
          const newBalance = roundCurrency(s.balance + earned)
          const newLevel = checkAutoLevel(newBalance, s.garageLevel, s.milestonesPurchased)
          result.balance = newBalance
          result.totalEarned = roundCurrency(s.totalEarned + earned)
          if (newLevel !== s.garageLevel) result.garageLevel = newLevel
        }
        return result
      })
      if (passiveIncomePerSecond > 0) get().checkForMilestone()
      if (get().garageLevel !== prevLevel) get().saveProgress()
      if (tick % 60 === 0) {
        get().checkAchievements()
        get().triggerRandomEvent()
      }
    }, 1000)
    return () => clearInterval(id)
  },

  resetGame: () => {
    clearSave()
    _set({ ...initialState, isLoaded: true })
  },

  applyServerState: (serverState: Record<string, unknown>) => {
    const s = serverState
    const workers = s.workers as Record<string, { count: number; cost: number }> | undefined
    const upgrades = s.upgrades as Record<string, { level: number; cost: number; baseCost: number }> | undefined
    const boostsData = s.boosts as { active: Array<{ type: string; activatedAt: number; expiresAt: number }> } | undefined
    const eventsData = s.events as { activeEvent: { id: string; activatedAt: number; expiresAt: number; eventSeed: number } | null; cooldownEnd: number } | undefined
    const decoData = s.decorations as { owned: string[]; active: string[] } | undefined
    const dailyData = s.dailyRewards as { lastClaimTimestamp: number; currentStreak: number } | undefined
    const videoData = s.rewardedVideo as { lastWatchedTimestamp: number; totalWatches: number } | undefined
    const achievementsData = s.achievements as Record<string, { unlocked: boolean; claimed: boolean; unlockedAt?: number }> | undefined

    const restoredAchievements: Record<AchievementId, PlayerAchievement> = { ...initialState.achievements }
    if (achievementsData) {
      for (const key of Object.keys(achievementsData)) {
        if (key in restoredAchievements) restoredAchievements[key as AchievementId] = achievementsData[key]
      }
    }

    // garageLevel is non-decreasing: if server sends a lower value (pending clicks not yet
    // synced), keep the local value. Server will catch up on next sync.
    const currentGarageLevel = get().garageLevel

    _set({
      balance: (s.balance as number) ?? 0,
      nuts: (s.nuts as number) ?? 0,
      totalClicks: (s.totalClicks as number) ?? 0,
      garageLevel: Math.max(currentGarageLevel, (s.garageLevel as number) ?? 1),
      milestonesPurchased: (s.milestonesPurchased as number[]) ?? [],
      totalEarned: (s.totalEarned as number) ?? 0,
      sessionCount: (s.sessionCount as number) ?? 0,
      lastSessionDate: (s.lastSessionDate as string) ?? '',
      peakClickIncome: (s.peakClickIncome as number) ?? 0,
      totalPlayTimeSeconds: (s.totalPlayTimeSeconds as number) ?? 0,
      bestStreak: (s.bestStreak as number) ?? 0,
      clickValue: calculateClickIncome(upgrades?.clickPower?.level ?? 0),
      passiveIncomePerSecond: calculateTotalPassiveIncome(
        workers ?? initialState.workers as unknown as Record<string, { count: number }>,
        upgrades?.workSpeed?.level ?? 0,
      ),
      upgrades: upgrades ? {
        clickPower: { level: upgrades.clickPower.level, cost: upgrades.clickPower.cost, baseCost: upgrades.clickPower.baseCost },
        workSpeed: { level: upgrades.workSpeed.level, cost: upgrades.workSpeed.cost, baseCost: upgrades.workSpeed.baseCost },
      } : initialState.upgrades,
      workers: workers ? {
        apprentice: workers.apprentice,
        mechanic: workers.mechanic,
        master: workers.master,
        brigadier: workers.brigadier,
        director: workers.director,
      } : initialState.workers,
      achievements: restoredAchievements,
      dailyRewards: dailyData ?? initialState.dailyRewards,
      rewardedVideo: videoData
        ? { ...initialState.rewardedVideo, ...videoData }
        : initialState.rewardedVideo,
      boosts: boostsData
        ? { active: boostsData.active.map(b => ({ type: b.type as import('../types').BoostType, activatedAt: b.activatedAt, expiresAt: b.expiresAt })) }
        : initialState.boosts,
      events: eventsData ?? initialState.events,
      decorations: decoData
        ? { owned: decoData.owned.filter(id => DECORATION_CATALOG[id]), active: decoData.active.filter(id => DECORATION_CATALOG[id]) }
        : initialState.decorations,
      isLoaded: true,
      // NOTE: _clicksSinceLastSync is NOT reset here — pending clicks must survive
      // action responses and be flushed on the next 30s sync tick.
    })

    get().checkForMilestone()
    get().checkAchievements()
    get().checkDailyReward()
  },
})

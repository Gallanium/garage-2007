// src/store/selectors.ts
// All useXxx() selector hooks. Imported by gameStore.ts and re-exported
// so components keep importing from '../store/gameStore'.
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from './gameStore'
import { GARAGE_LEVEL_THRESHOLDS, MILESTONE_LEVELS, MILESTONE_UPGRADES } from './constants/garageLevels'
import { calculateWorkSpeedMultiplier } from './formulas/income'

export const useBalance               = () => useGameStore((s) => s.balance)
export const useClickValue            = () => useGameStore((s) => s.clickValue)
export const useTotalClicks           = () => useGameStore((s) => s.totalClicks)
export const useGarageLevel           = () => useGameStore((s) => s.garageLevel)
export const usePassiveIncome         = () => useGameStore((s) => s.passiveIncomePerSecond)
export const useMomentaryClickIncome  = () => useGameStore((s) => s.momentaryClickIncome)
export const useUpgrades              = () => useGameStore((s) => s.upgrades)
export const useWorkers               = () => useGameStore((s) => s.workers)
export const useNuts                  = () => useGameStore((s) => s.nuts)
export const useTotalEarned           = () => useGameStore((s) => s.totalEarned)
export const useIsLoaded              = () => useGameStore((s) => s.isLoaded)
export const useSessionCount          = () => useGameStore((s) => s.sessionCount)
export const useLastOfflineEarnings   = () => useGameStore((s) => s.lastOfflineEarnings)
export const useLastOfflineTimeAway   = () => useGameStore((s) => s.lastOfflineTimeAway)
export const usePeakClickIncome       = () => useGameStore((s) => s.peakClickIncome)
export const useTotalPlayTime         = () => useGameStore((s) => s.totalPlayTimeSeconds)
export const useBestStreak            = () => useGameStore((s) => s.bestStreak)
export const useAchievements          = () => useGameStore((s) => s.achievements)
export const useHasNewAchievements    = () => useGameStore((s) => s.hasNewAchievements)
export const useClaimAchievement      = () => useGameStore((s) => s.claimAchievement)
export const useClearNewAchievementsFlag = () => useGameStore((s) => s.clearNewAchievementsFlag)
export const useRewardedVideo         = () => useGameStore((s) => s.rewardedVideo)
export const useCanWatchRewardedVideo = () => useGameStore((s) => s.canWatchRewardedVideo())
export const useWatchRewardedVideo    = () => useGameStore((s) => s.watchRewardedVideo)
export const useMilestonesPurchased   = () => useGameStore((s) => s.milestonesPurchased)
export const useShowMilestoneModal    = () => useGameStore((s) => s.showMilestoneModal)
export const usePendingMilestoneLevel = () => useGameStore((s) => s.pendingMilestoneLevel)
export const useCheckForMilestone     = () => useGameStore((s) => s.checkForMilestone)
export const usePurchaseMilestone     = () => useGameStore((s) => s.purchaseMilestone)
export const useCloseMilestoneModal   = () => useGameStore((s) => s.closeMilestoneModal)
export const usePurchaseWorkSpeedUpgrade = () => useGameStore((s) => s.purchaseWorkSpeedUpgrade)
export const useWorkSpeedLevel        = () => useGameStore((s) => s.upgrades.workSpeed.level)
export const useWorkSpeedMultiplier   = () => useGameStore((s) => calculateWorkSpeedMultiplier(s.upgrades.workSpeed.level))

export const useNextLevelCost = () =>
  useGameStore((s) => {
    if (s.garageLevel >= 20) return null
    return GARAGE_LEVEL_THRESHOLDS[s.garageLevel + 1] ?? null
  })

export const useGarageProgress = () =>
  useGameStore((s) => {
    if (s.garageLevel >= 20) return 1
    const next = GARAGE_LEVEL_THRESHOLDS[s.garageLevel + 1]
    if (!next) return 1
    const curr = GARAGE_LEVEL_THRESHOLDS[s.garageLevel] ?? 0
    const range = next - curr
    if (range <= 0) return 1
    return Math.min(Math.max((s.balance - curr) / range, 0), 1)
  })

export const useBoosts            = () => useGameStore((s) => s.boosts.active)
export const useActivateBoost     = () => useGameStore((s) => s.activateBoost)
export const useHasActiveBoost    = (type: import('./types').BoostType) =>
  useGameStore((s) => s.boosts.active.some(b => b.type === type))
export const useHasAnyActiveBoost = () => useGameStore((s) => s.boosts.active.length > 0)
export const useActiveBoostType   = () => useGameStore((s) => {
  const now = Date.now()
  const active = s.boosts.active.find(b => b.expiresAt > now)
  return active?.type ?? null
})

export const useActiveEvent        = () => useGameStore((s) => s.events.activeEvent)
export const useEventCooldownEnd   = () => useGameStore((s) => s.events.cooldownEnd)
export const useHasActiveEvent     = () => useGameStore((s) => s.events.activeEvent !== null)

export const usePendingMilestoneInfo = () =>
  useGameStore(
    useShallow((s) => {
      for (const level of MILESTONE_LEVELS) {
        if (!s.milestonesPurchased.includes(level)) {
          const threshold = GARAGE_LEVEL_THRESHOLDS[level]
          if (threshold !== undefined && s.balance >= threshold) {
            return { level, upgrade: MILESTONE_UPGRADES[level] }
          }
          return null
        }
      }
      return null
    })
  )

export const useDecorations        = () => useGameStore((s) => s.decorations)
export const useOwnedDecorations   = () => useGameStore(useShallow((s) => s.decorations.owned))
export const useActiveDecorations  = () => useGameStore(useShallow((s) => s.decorations.active))
export const usePurchaseDecoration = () => useGameStore((s) => s.purchaseDecoration)
export const useToggleDecoration   = () => useGameStore((s) => s.toggleDecoration)

// src/store/actions/upgradeActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { BASE_COSTS, CLICK_UPGRADE_MAX_LEVEL } from '../constants/economy'
import { calculateUpgradeCost } from '../formulas/costs'
import { calculateClickIncome, calculateTotalPassiveIncome } from '../formulas/income'
import { formatLargeNumber } from '../formulas/progression'

type Slice = Pick<GameStore, 'purchaseClickUpgrade' | 'purchaseWorkSpeedUpgrade'>

export const createUpgradeSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseClickUpgrade: () => {
    const { balance, upgrades } = get()
    const { clickPower } = upgrades
    if (clickPower.level >= CLICK_UPGRADE_MAX_LEVEL) {
      console.warn(`[ClickUpgrade] Максимальный уровень: ${CLICK_UPGRADE_MAX_LEVEL}`)
      return false
    }
    if (balance < clickPower.cost) {
      console.warn(`[ClickUpgrade] Недостаточно средств: нужно ${formatLargeNumber(clickPower.cost)} ₽`)
      return false
    }
    const newLevel = clickPower.level + 1
    _set((s: GameState) => ({
      balance: s.balance - clickPower.cost,
      clickValue: calculateClickIncome(newLevel),
      upgrades: {
        ...s.upgrades,
        clickPower: { ...s.upgrades.clickPower, level: newLevel, cost: calculateUpgradeCost(BASE_COSTS.clickUpgrade, newLevel) },
      },
    }))
    get().saveProgress()
    return true
  },

  purchaseWorkSpeedUpgrade: () => {
    const state = get()
    const { workSpeed } = state.upgrades
    if (!state.milestonesPurchased.includes(5)) {
      console.warn('[Purchase] 🔒 Апгрейд скорости не разблокирован (milestone 5)')
      return
    }
    if (state.balance < workSpeed.cost) {
      console.warn(`[Purchase] 💰 Недостаточно средств: нужно ${formatLargeNumber(workSpeed.cost)}₽`)
      return
    }
    const newLevel = workSpeed.level + 1
    _set((s: GameState) => ({
      balance: s.balance - workSpeed.cost,
      passiveIncomePerSecond: calculateTotalPassiveIncome(s.workers, newLevel),
      upgrades: {
        ...s.upgrades,
        workSpeed: { ...s.upgrades.workSpeed, level: newLevel, cost: calculateUpgradeCost(BASE_COSTS.workSpeed, newLevel) },
      },
    }))
    get().saveProgress()
  },
})

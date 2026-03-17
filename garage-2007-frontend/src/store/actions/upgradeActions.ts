// src/store/actions/upgradeActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { BASE_COSTS, CLICK_UPGRADE_MAX_LEVEL } from '../constants/economy'
import { calculateUpgradeCost } from '../formulas/costs'
import { calculateClickIncome, calculateTotalPassiveIncome } from '../formulas/income'
import { formatLargeNumber } from '../formulas/progression'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'purchaseClickUpgrade' | 'purchaseWorkSpeedUpgrade'>

export const createUpgradeSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseClickUpgrade: () => {
    const { balance, upgrades } = get()
    const { clickPower } = upgrades
    if (clickPower.level >= CLICK_UPGRADE_MAX_LEVEL) {
      if (import.meta.env.DEV) console.warn(`[ClickUpgrade] Максимальный уровень: ${CLICK_UPGRADE_MAX_LEVEL}`)
      return false
    }
    const effectiveCost = Math.floor(clickPower.cost * get().getEventCostMultiplier())
    if (balance < effectiveCost) {
      if (import.meta.env.DEV) console.warn(`[ClickUpgrade] Недостаточно средств: нужно ${formatLargeNumber(effectiveCost)} ₽`)
      return false
    }
    const newLevel = clickPower.level + 1
    _set((s: GameState) => ({
      balance: s.balance - effectiveCost,
      clickValue: calculateClickIncome(newLevel),
      upgrades: {
        ...s.upgrades,
        clickPower: { ...s.upgrades.clickPower, level: newLevel, cost: calculateUpgradeCost(BASE_COSTS.clickUpgrade, newLevel) },
      },
    }))
    get().saveProgress()
    if (api.isOnline()) {
      api.performAction('purchase_upgrade', { upgradeType: 'clickPower' }).then(r => {
        if (r?.gameState) get().applyServerState(r.gameState)
      })
    }
    return true
  },

  purchaseWorkSpeedUpgrade: () => {
    const state = get()
    const { workSpeed } = state.upgrades
    if (!state.milestonesPurchased.includes(5)) {
      if (import.meta.env.DEV) console.warn('[Purchase] 🔒 Апгрейд скорости не разблокирован (milestone 5)')
      return
    }
    const effectiveWorkSpeedCost = Math.floor(workSpeed.cost * get().getEventCostMultiplier())
    if (state.balance < effectiveWorkSpeedCost) {
      if (import.meta.env.DEV) console.warn(`[Purchase] 💰 Недостаточно средств: нужно ${formatLargeNumber(effectiveWorkSpeedCost)}₽`)
      return
    }
    const newLevel = workSpeed.level + 1
    _set((s: GameState) => ({
      balance: s.balance - effectiveWorkSpeedCost,
      passiveIncomePerSecond: calculateTotalPassiveIncome(s.workers as unknown as Record<string, { count: number }>, newLevel),
      upgrades: {
        ...s.upgrades,
        workSpeed: { ...s.upgrades.workSpeed, level: newLevel, cost: calculateUpgradeCost(BASE_COSTS.workSpeed, newLevel) },
      },
    }))
    get().saveProgress()
    if (api.isOnline()) {
      api.performAction('purchase_upgrade', { upgradeType: 'workSpeed' }).then(r => {
        if (r?.gameState) get().applyServerState(r.gameState)
      })
    }
  },
})

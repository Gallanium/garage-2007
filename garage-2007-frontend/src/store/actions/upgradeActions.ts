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
  purchaseClickUpgrade: async () => {
    const state = get()
    const { balance, upgrades } = state
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

    // Optimistic + rollback: ruble action
    const snapshot = {
      balance: state.balance,
      clickValue: state.clickValue,
      upgrades: { ...state.upgrades, clickPower: { ...state.upgrades.clickPower } },
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
      const r = await api.performAction('purchase_upgrade', { upgradeType: 'clickPower' })
      if (!r) {
        // Rollback on network failure (server unreachable)
        _set(snapshot)
        get().saveProgress()
        console.warn('[ClickUpgrade] Server rejected purchase_upgrade — rolled back')
        // TODO: show user-facing error toast
      } else if (r.gameState) {
        get().applyServerState(r.gameState)
      }
    }
    return true
  },

  purchaseWorkSpeedUpgrade: async () => {
    const state = get()
    const { workSpeed } = state.upgrades
    if (!state.milestonesPurchased.includes(5)) {
      if (import.meta.env.DEV) console.warn('[Purchase] Апгрейд скорости не разблокирован (milestone 5)')
      return
    }
    const effectiveWorkSpeedCost = Math.floor(workSpeed.cost * get().getEventCostMultiplier())
    if (state.balance < effectiveWorkSpeedCost) {
      if (import.meta.env.DEV) console.warn(`[Purchase] Недостаточно средств: нужно ${formatLargeNumber(effectiveWorkSpeedCost)}₽`)
      return
    }

    // Optimistic + rollback: ruble action
    const snapshot = {
      balance: state.balance,
      passiveIncomePerSecond: state.passiveIncomePerSecond,
      upgrades: { ...state.upgrades, workSpeed: { ...state.upgrades.workSpeed } },
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
      const r = await api.performAction('purchase_upgrade', { upgradeType: 'workSpeed' })
      if (!r) {
        // Rollback on network failure (server unreachable)
        _set(snapshot)
        get().saveProgress()
        console.warn('[WorkSpeedUpgrade] Server rejected purchase_upgrade — rolled back')
        // TODO: show user-facing error toast
      } else if (r.gameState) {
        get().applyServerState(r.gameState)
      }
    }
  },
})

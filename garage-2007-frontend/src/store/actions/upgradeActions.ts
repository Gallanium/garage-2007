// src/store/actions/upgradeActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState } from '../types'
import { BASE_COSTS, CLICK_UPGRADE_MAX_LEVEL } from '../constants/economy'
import { calculateUpgradeCost } from '../formulas/costs'
import { calculateClickIncome, calculateTotalPassiveIncome } from '../formulas/income'
import { formatLargeNumber } from '../formulas/progression'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'purchaseClickUpgrade' | 'purchaseWorkSpeedUpgrade'>

// Concurrency guards — prevent double-fire from mobile tap events
let _clickUpgradePending = false
let _workSpeedUpgradePending = false

export const createUpgradeSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  purchaseClickUpgrade: async () => {
    if (_clickUpgradePending) return false
    _clickUpgradePending = true
    try {
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

      if (!api.isOnline()) {
        console.warn('[ClickUpgrade] Cannot purchase: not connected to server')
        return false
      }

      if (api.isActionThrottled()) {
        if (import.meta.env.DEV) console.warn('[ClickUpgrade] Client-side rate limit reached, try again later')
        return false
      }

      // Flush pending clicks so backend has accurate balance
      if ((get()._pendingClickBuffer ?? []).length > 0) {
        const flushOk = await get().flushPendingClicks()
        if (!flushOk) {
          get().showToast('Ошибка синхронизации, попробуйте снова', 'error')
          return false
        }
      }
      // Re-validate balance after flush (server state may differ from optimistic)
      if (get().balance < Math.floor(get().upgrades.clickPower.cost * get().getEventCostMultiplier())) {
        if (import.meta.env.DEV) console.warn('[ClickUpgrade] Insufficient balance after sync')
        return false
      }

      // Re-read state after flush
      const stateAfterFlush = get()
      const effectiveCostAfterFlush = Math.floor(stateAfterFlush.upgrades.clickPower.cost * stateAfterFlush.getEventCostMultiplier())

      // Optimistic + rollback: ruble action
      const snapshot = {
        balance: stateAfterFlush.balance,
        clickValue: stateAfterFlush.clickValue,
        upgrades: { ...stateAfterFlush.upgrades, clickPower: { ...stateAfterFlush.upgrades.clickPower } },
      }

      const newLevel = stateAfterFlush.upgrades.clickPower.level + 1
      _set((s: GameState) => ({
        balance: s.balance - effectiveCostAfterFlush,
        clickValue: calculateClickIncome(newLevel),
        upgrades: {
          ...s.upgrades,
          clickPower: {
            ...s.upgrades.clickPower,
            level: newLevel,
            cost: calculateUpgradeCost(BASE_COSTS.clickUpgrade, newLevel),
          },
        },
      }))
      get().saveProgress()

      const r = await api.performAction('purchase_upgrade', { upgradeType: 'clickPower' })
      if (!r?.gameState) {
        _set(snapshot)
        get().saveProgress()
        console.warn('[ClickUpgrade] Server rejected purchase_upgrade — rolled back')
        get().showToast('Ошибка покупки улучшения', 'error')
        return false
      }

      get().applyServerState(r.gameState)
      return true
    } finally { _clickUpgradePending = false }
  },

  purchaseWorkSpeedUpgrade: async () => {
    if (_workSpeedUpgradePending) return false
    _workSpeedUpgradePending = true
    try {
      const state = get()
      const { workSpeed } = state.upgrades
      if (!state.milestonesPurchased.includes(5)) {
        if (import.meta.env.DEV) console.warn('[Purchase] Апгрейд скорости не разблокирован (milestone 5)')
        return false
      }

      const effectiveWorkSpeedCost = Math.floor(workSpeed.cost * get().getEventCostMultiplier())
      if (state.balance < effectiveWorkSpeedCost) {
        if (import.meta.env.DEV) console.warn(`[Purchase] Недостаточно средств: нужно ${formatLargeNumber(effectiveWorkSpeedCost)}₽`)
        return false
      }

      if (!api.isOnline()) {
        console.warn('[WorkSpeedUpgrade] Cannot purchase: not connected to server')
        return false
      }

      if (api.isActionThrottled()) {
        if (import.meta.env.DEV) console.warn('[WorkSpeedUpgrade] Client-side rate limit reached, try again later')
        return false
      }

      // Flush pending clicks so backend has accurate balance
      if ((get()._pendingClickBuffer ?? []).length > 0) {
        const flushOk = await get().flushPendingClicks()
        if (!flushOk) {
          get().showToast('Ошибка синхронизации, попробуйте снова', 'error')
          return false
        }
      }
      // Re-read state after flush
      const stateAfterFlush = get()
      const effectiveCostAfterFlush = Math.floor(stateAfterFlush.upgrades.workSpeed.cost * stateAfterFlush.getEventCostMultiplier())
      if (stateAfterFlush.balance < effectiveCostAfterFlush) {
        if (import.meta.env.DEV) console.warn('[WorkSpeedUpgrade] Insufficient balance after sync')
        return false
      }

      // Optimistic + rollback: ruble action
      const snapshot = {
        balance: stateAfterFlush.balance,
        passiveIncomePerSecond: stateAfterFlush.passiveIncomePerSecond,
        upgrades: { ...stateAfterFlush.upgrades, workSpeed: { ...stateAfterFlush.upgrades.workSpeed } },
      }

      const newLevel = stateAfterFlush.upgrades.workSpeed.level + 1
      _set((s: GameState) => ({
        balance: s.balance - effectiveCostAfterFlush,
        passiveIncomePerSecond: calculateTotalPassiveIncome(
          s.workers as unknown as Record<string, { count: number }>,
          newLevel,
        ),
        upgrades: {
          ...s.upgrades,
          workSpeed: {
            ...s.upgrades.workSpeed,
            level: newLevel,
            cost: calculateUpgradeCost(BASE_COSTS.workSpeed, newLevel),
          },
        },
      }))
      get().saveProgress()

      const r = await api.performAction('purchase_upgrade', { upgradeType: 'workSpeed' })
      if (!r?.gameState) {
        _set(snapshot)
        get().saveProgress()
        console.warn('[WorkSpeedUpgrade] Server rejected purchase_upgrade — rolled back')
        get().showToast('Ошибка покупки улучшения', 'error')
        return false
      }

      get().applyServerState(r.gameState)
      return true
    } finally { _workSpeedUpgradePending = false }
  },
})

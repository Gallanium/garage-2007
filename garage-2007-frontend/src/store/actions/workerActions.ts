// src/store/actions/workerActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, GameState, WorkerType } from '../types'
import { BASE_COSTS, WORKER_LIMITS } from '../constants/economy'
import { calculateWorkerCost } from '../formulas/costs'
import { calculateTotalPassiveIncome } from '../formulas/income'
import { formatLargeNumber } from '../formulas/progression'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore, 'hireWorker'>

export const createWorkerSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  hireWorker: async (workerType: WorkerType) => {
    const state = get()
    const worker = state.workers[workerType]
    const limit = WORKER_LIMITS[workerType]

    if (worker.count >= limit) {
      if (import.meta.env.DEV) console.warn(`[Hire] Лимит для ${workerType}: ${worker.count}/${limit}`)
      return
    }

    const requiredMilestone: Record<WorkerType, number> = {
      apprentice: 0, mechanic: 5, master: 10, brigadier: 15, director: 20,
    }
    const milestone = requiredMilestone[workerType]
    if (milestone > 0 && !state.milestonesPurchased.includes(milestone)) {
      if (import.meta.env.DEV) console.warn(`[Hire] ${workerType} не разблокирован (milestone ${milestone})`)
      return
    }

    const effectiveWorkerCost = Math.floor(worker.cost * get().getEventCostMultiplier())
    if (state.balance < effectiveWorkerCost) {
      if (import.meta.env.DEV) console.warn(`[Hire] Недостаточно средств для ${workerType}: нужно ${formatLargeNumber(effectiveWorkerCost)}₽`)
      return
    }

    // Optimistic + rollback: ruble action
    const snapshot = {
      balance: state.balance,
      passiveIncomePerSecond: state.passiveIncomePerSecond,
      workers: {
        ...state.workers,
        [workerType]: { ...state.workers[workerType] },
      },
    }

    const newCount = worker.count + 1
    const newCost = calculateWorkerCost(BASE_COSTS[workerType as keyof typeof BASE_COSTS] as number, newCount)
    const workersAfter = { ...state.workers, [workerType]: { count: newCount, cost: newCost } }
    const newPassive = calculateTotalPassiveIncome(workersAfter as unknown as Record<string, { count: number }>, state.upgrades.workSpeed.level)

    _set((s: GameState) => ({
      balance: s.balance - effectiveWorkerCost,
      passiveIncomePerSecond: newPassive,
      workers: { ...s.workers, [workerType]: { count: newCount, cost: newCost } },
    }))

    get().saveProgress()
    get().checkAchievements()

    if (api.isOnline()) {
      const r = await api.performAction('hire_worker', { workerType })
      if (!r) {
        // Rollback on network failure (server unreachable)
        _set(snapshot)
        get().saveProgress()
        console.warn(`[Hire] Server rejected hire_worker (${workerType}) — rolled back`)
        // TODO: show user-facing error toast
      } else if (r.gameState) {
        get().applyServerState(r.gameState)
      }
    }
  },
})

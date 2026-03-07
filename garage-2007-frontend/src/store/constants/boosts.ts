// src/store/constants/boosts.ts
import type { BoostType, BoostDefinition } from '../types'

export const BOOST_DEFINITIONS: Record<BoostType, BoostDefinition> = {
  income_2x: {
    label: 'Двойной доход',
    costNuts: 50,
    durationMs: 3_600_000,
    multiplier: 2,
    description: '×2 ко всему доходу на 1 час',
  },
  income_3x: {
    label: 'Тройной доход',
    costNuts: 80,
    durationMs: 1_800_000,
    multiplier: 3,
    description: '×3 ко всему доходу на 30 мин',
  },
  turbo: {
    label: 'Суперклик',
    costNuts: 30,
    durationMs: 900_000,
    multiplier: 5,
    description: '×5 к доходу за клик на 15 мин',
  },
}

// Группы взаимоисключающих бустов — нельзя активировать одновременно
export const BOOST_CONFLICT_GROUPS: BoostType[][] = [
  ['income_2x', 'income_3x'],
]

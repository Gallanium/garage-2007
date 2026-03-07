// src/store/constants/boosts.ts
import type { BoostType, BoostDefinition } from '../types'

export const BOOST_DEFINITIONS: Record<BoostType, BoostDefinition> = {
  income_2x: {
    label: 'X2 Доход',
    costNuts: 30,
    durationMs: 3_600_000,
    multiplier: 2,
    description: 'Пассив + клики ×2',
    unlockLevel: 5,   // requires milestonesPurchased.includes(5)
  },
  income_3x: {
    label: 'X3 Доход',
    costNuts: 50,
    durationMs: 1_800_000,
    multiplier: 3,
    description: 'Пассив + клики ×3',
    unlockLevel: 10,  // requires milestonesPurchased.includes(10)
  },
  turbo: {
    label: 'Суперклик',
    costNuts: 15,
    durationMs: 900_000,
    multiplier: 5,
    description: 'Клики ×5',
    unlockLevel: 0,   // always available (garageLevel >= 1)
  },
}

// Оставить экспорт пустым — группы конфликтов убраны (все взаимоисключающие)
// Логика «один буст» — в boostActions через boosts.active.length > 0

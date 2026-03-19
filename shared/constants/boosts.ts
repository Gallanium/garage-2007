// shared/constants/boosts.ts
import type { BoostType, BoostDefinition } from '../types/game.js'

export const BOOST_DEFINITIONS: Record<BoostType, BoostDefinition> = {
  income_2x: {
    label: 'Турбо-доход',
    costNuts: 30,
    durationMs: 3_600_000,
    multiplier: 2,
    description: 'Пассив + клики ×2',
    unlockLevel: 5,
  },
  income_3x: {
    label: 'Нитро-ускорение',
    costNuts: 50,
    durationMs: 1_800_000,
    multiplier: 3,
    description: 'Пассив + клики ×3',
    unlockLevel: 10,
  },
  turbo: {
    label: 'Суперклик',
    costNuts: 15,
    durationMs: 900_000,
    multiplier: 5,
    description: 'Клики ×5',
    unlockLevel: 0,
  },
}

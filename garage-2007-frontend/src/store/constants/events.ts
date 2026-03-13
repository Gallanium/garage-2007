// src/store/constants/events.ts
import type { EventDefinition, EventCategory } from '../types'

export const GAME_EVENTS: Record<string, EventDefinition> = {
  // ── Позитивные ──────────────────────────────────────────────────────────────
  client_rush: {
    id: 'client_rush',
    name: 'Наплыв клиентов',
    description: '+30% доход 3 мин',
    icon: '🚗',
    category: 'positive',
    effect: { scope: 'income', multiplier: 1.3 },
    durationMs: 180_000,
    weight: 3,
  },
  parts_discount: {
    id: 'parts_discount',
    name: 'Скидки на запчасти',
    description: '-20% стоимость 2 мин',
    icon: '🔧',
    category: 'positive',
    effect: { scope: 'cost', multiplier: 0.8 },
    durationMs: 120_000,
    weight: 2,
  },
  lucky_find: {
    id: 'lucky_find',
    name: 'Удачная находка',
    description: '+20% доход 2 мин',
    icon: '💰',
    category: 'positive',
    effect: { scope: 'income', multiplier: 1.2 },
    durationMs: 120_000,
    weight: 3,
  },
  vip_client: {
    id: 'vip_client',
    name: 'VIP-клиент',
    description: '+50% за клик 1 мин',
    icon: '⭐',
    category: 'positive',
    effect: { scope: 'click', multiplier: 1.5 },
    durationMs: 60_000,
    weight: 2,
  },

  // ── Негативные ──────────────────────────────────────────────────────────────
  equipment_break: {
    id: 'equipment_break',
    name: 'Поломка оборудования',
    description: '-20% доход 2 мин',
    icon: '💥',
    category: 'negative',
    effect: { scope: 'income', multiplier: 0.8 },
    durationMs: 120_000,
    weight: 3,
  },
  tax_inspection: {
    id: 'tax_inspection',
    name: 'Проверка налоговой',
    description: '-30% доход 1 мин',
    icon: '📋',
    category: 'negative',
    effect: { scope: 'income', multiplier: 0.7 },
    durationMs: 60_000,
    weight: 2,
  },
  power_outage: {
    id: 'power_outage',
    name: 'Отключили свет',
    description: '-20% за клик 1.5 мин',
    icon: '🔌',
    category: 'negative',
    effect: { scope: 'click', multiplier: 0.8 },
    durationMs: 90_000,
    weight: 1,
  },

  // ── Нейтральные ─────────────────────────────────────────────────────────────
  neighbor_visit: {
    id: 'neighbor_visit',
    name: 'Сосед зашёл в гости',
    description: '+10% доход 1 мин',
    icon: '🍺',
    category: 'neutral',
    effect: { scope: 'income', multiplier: 1.1 },
    durationMs: 60_000,
    weight: 3,
  },
  radio_plays: {
    id: 'radio_plays',
    name: 'Хорошая песня по радио',
    description: '+10% за клик 1.5 мин',
    icon: '🎵',
    category: 'neutral',
    effect: { scope: 'click', multiplier: 1.1 },
    durationMs: 90_000,
    weight: 2,
  },
  stray_cat: {
    id: 'stray_cat',
    name: 'Забежал кот',
    description: '+5% доход 2 мин',
    icon: '🐱',
    category: 'neutral',
    effect: { scope: 'income', multiplier: 1.05 },
    durationMs: 120_000,
    weight: 2,
  },
}

/** Вероятности по GDD: 50% позитивные, 30% негативные, 20% нейтральные */
export const EVENT_CATEGORY_WEIGHTS: Record<EventCategory, number> = {
  positive: 50,
  negative: 30,
  neutral: 20,
}

/** Минимальный cooldown между событиями: 15 мин */
export const EVENT_COOLDOWN_MS = 900_000

/** Дополнительная случайная задержка до следующего события: 0-15 мин */
export const EVENT_RANDOM_DELAY_MS = 900_000

/** Проверка в passive tick каждые N тиков (1 тик = 1 сек) */
export const EVENT_CHECK_INTERVAL = 60

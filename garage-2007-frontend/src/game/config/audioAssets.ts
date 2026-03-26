import clickNormal from '../../assets/sounds/click_normal.mp3'
import clickCritical from '../../assets/sounds/click_critical.mp3'
import purchase from '../../assets/sounds/purchase.mp3'
import levelUp from '../../assets/sounds/level_up.mp3'
import achievement from '../../assets/sounds/achievement.mp3'
import modalOpen from '../../assets/sounds/modal_open.mp3'
import modalClose from '../../assets/sounds/modal_close.mp3'
import tabSwitch from '../../assets/sounds/tab_switch.mp3'
import boostActivate from '../../assets/sounds/boost_activate.mp3'
import dailyReward from '../../assets/sounds/daily_reward.mp3'

// Event-specific sounds
import eventClientRush from '../../assets/sounds/events/event_client_rush.mp3'
import eventPartsDiscount from '../../assets/sounds/events/event_parts_discount.mp3'
import eventLuckyFind from '../../assets/sounds/events/event_lucky_find.mp3'
import eventVipClient from '../../assets/sounds/events/event_vip_client.mp3'
import eventEquipmentBreak from '../../assets/sounds/events/event_equipment_break.mp3'
import eventTaxInspection from '../../assets/sounds/events/event_tax_inspection.mp3'
import eventPowerOutage from '../../assets/sounds/events/event_power_outage.mp3'
import eventNeighborVisit from '../../assets/sounds/events/event_neighbor_visit.mp3'
import eventRadioPlays from '../../assets/sounds/events/event_radio_plays.mp3'
import eventStrayCat from '../../assets/sounds/events/event_stray_cat.mp3'

export const AUDIO_ASSETS = {
  click_normal: clickNormal,
  click_critical: clickCritical,
  purchase: purchase,
  level_up: levelUp,
  achievement: achievement,
  modal_open: modalOpen,
  modal_close: modalClose,
  tab_switch: tabSwitch,
  boost_activate: boostActivate,
  daily_reward: dailyReward,

  // Positive events
  event_client_rush: eventClientRush,
  event_parts_discount: eventPartsDiscount,
  event_lucky_find: eventLuckyFind,
  event_vip_client: eventVipClient,

  // Negative events
  event_equipment_break: eventEquipmentBreak,
  event_tax_inspection: eventTaxInspection,
  event_power_outage: eventPowerOutage,

  // Neutral events
  event_neighbor_visit: eventNeighborVisit,
  event_radio_plays: eventRadioPlays,
  event_stray_cat: eventStrayCat,
} as const

export type SfxKey = keyof typeof AUDIO_ASSETS
export type EventSfxKey = Extract<SfxKey, `event_${string}`>

export const EVENT_SFX_KEYS = {
  client_rush: 'event_client_rush',
  parts_discount: 'event_parts_discount',
  lucky_find: 'event_lucky_find',
  vip_client: 'event_vip_client',
  equipment_break: 'event_equipment_break',
  tax_inspection: 'event_tax_inspection',
  power_outage: 'event_power_outage',
  neighbor_visit: 'event_neighbor_visit',
  radio_plays: 'event_radio_plays',
  stray_cat: 'event_stray_cat',
} as const satisfies Record<string, EventSfxKey>

export function isSfxKey(value: string): value is SfxKey {
  return Object.prototype.hasOwnProperty.call(AUDIO_ASSETS, value)
}

/**
 * Per-key volume multipliers to balance perceived loudness
 * without re-encoding MP3 files (re-encoding breaks Web Audio).
 * Multiplier is relative to DEFAULT_VOLUME in AudioManager.
 * 1.0 = no change. Recalculate after replacing sound files.
 * Reference: click_normal = -17.0 LUFS (multiplier 1.0).
 */
export const VOLUME_OVERRIDES: Partial<Record<SfxKey, number>> = {
  // Regular SFX outliers
  achievement: 2.2,     // -23.8 LUFS
  tab_switch: 1.4,      // -20.2 LUFS
  modal_close: 1.3,     // -19.5 LUFS

  // Event sounds — most normalized to ~-17.8 LUFS, no override needed
  event_radio_plays: 4.5, // -30.1 LUFS, very quiet
}

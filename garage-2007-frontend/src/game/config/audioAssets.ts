import clickNormal from '../../assets/sounds/click_normal.mp3'
import clickCritical from '../../assets/sounds/click_critical.mp3'
import purchase from '../../assets/sounds/purchase.mp3'
import levelUp from '../../assets/sounds/level_up.mp3'
import achievement from '../../assets/sounds/achievement.mp3'
import modalOpen from '../../assets/sounds/modal_open.mp3'
import modalClose from '../../assets/sounds/modal_close.mp3'
import tabSwitch from '../../assets/sounds/tab_switch.mp3'
import boostActivate from '../../assets/sounds/boost_activate.mp3'
import eventPositive from '../../assets/sounds/event_positive.mp3'
import eventNegative from '../../assets/sounds/event_negative.mp3'
import dailyReward from '../../assets/sounds/daily_reward.mp3'

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
  event_positive: eventPositive,
  event_negative: eventNegative,
  daily_reward: dailyReward,
} as const

export type SfxKey = keyof typeof AUDIO_ASSETS

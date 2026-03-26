import { useCallback } from 'react'
import {
  Building, Wrench, Settings as SettingsIcon, Building2, Crown,
  Banknote, Coins, Gem, Pointer, MousePointer2, Zap,
  HardHat, Users, UsersRound, Trophy, Hexagon, Check, Gift
} from 'lucide-react'
import type { AchievementDefinition, PlayerAchievement, AchievementId } from '../store/gameStore'
import { useAudio } from '../contexts/AudioContext'

// ============================================
// ТИПЫ
// ============================================

interface AchievementCardProps {
  definition: AchievementDefinition
  playerState: PlayerAchievement
  currentProgress: number
  onClaim: (id: string) => Promise<boolean> | boolean | void
}

// ============================================
// КОМПОНЕНТ
// ============================================

const ACHIEVEMENT_ICONS: Record<AchievementId, React.ReactNode> = {
  garage_level_2:  <Building className="w-5 h-5 text-white" />,
  garage_level_5:  <Wrench className="w-5 h-5 text-white" />,
  garage_level_10: <SettingsIcon className="w-5 h-5 text-white" />,
  garage_level_15: <Building2 className="w-5 h-5 text-white" />,
  garage_level_20: <Crown className="w-5 h-5 text-white" />,
  earned_10k:      <Banknote className="w-5 h-5 text-white" />,
  earned_1m:       <Coins className="w-5 h-5 text-white" />,
  earned_1b:       <Gem className="w-5 h-5 text-white" />,
  clicks_100:      <Pointer className="w-5 h-5 text-white" />,
  clicks_1000:     <MousePointer2 className="w-5 h-5 text-white" />,
  clicks_10000:    <Zap className="w-5 h-5 text-white" />,
  workers_1:       <HardHat className="w-5 h-5 text-white" />,
  workers_5:       <Users className="w-5 h-5 text-white" />,
  workers_10:      <UsersRound className="w-5 h-5 text-white" />,
  all_milestones:  <Trophy className="w-5 h-5 text-white" />,
}

/**
 * Карточка одного достижения (3 состояния)
 */
const AchievementCard: React.FC<AchievementCardProps> = ({
  definition,
  playerState,
  currentProgress,
  onClaim,
}) => {
  const { id, title, description, icon, targetValue, nutsReward } = definition
  const { unlocked, claimed } = playerState

  const progress = Math.min(currentProgress / targetValue, 1)
  const progressPercent = Math.round(progress * 100)
  const { playSound } = useAudio()

  const handleClaim = useCallback(async () => {
    const ok = await onClaim(id)
    if (ok) playSound('purchase')
  }, [id, onClaim, playSound])

  // ═══ CLAIMED (забрано) ═══
  if (claimed) {
    return (
      <div className="bg-gradient-to-br from-gray-900/40 to-gray-800/30 rounded-lg border border-gray-700/30 p-3 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg opacity-50 flex-shrink-0">
            {ACHIEVEMENT_ICONS[id as AchievementId] || icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="text-xs font-bold text-white/50 font-mono">{title}</h3>
              <Check className="inline-block w-4 h-4 text-green-400" />
            </div>
            <p className="text-[9px] text-gray-500 font-mono">{description}</p>
            <p className="text-[9px] text-gray-600 font-mono mt-0.5 whitespace-nowrap flex items-center justify-start gap-1">
              Забрано: <span className="flex items-center gap-0.5"><span className="leading-none translate-y-[0.5px]">{nutsReward}</span><Hexagon className="w-3 h-3 text-gray-500" /></span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ═══ UNLOCKED (разблокировано, можно забрать) ═══
  if (unlocked) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-orange-700/40 p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-orange-700 flex items-center justify-center text-lg flex-shrink-0">
            {ACHIEVEMENT_ICONS[id as AchievementId] || icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white font-mono">{title}</h3>
              <span className="flex items-center gap-0.5 text-white text-xs font-bold whitespace-nowrap">
                <span className="leading-none translate-y-px">{nutsReward}</span>
                <Hexagon className="w-3.5 h-3.5 text-orange-400" />
              </span>
            </div>
            <p className="text-[9px] text-gray-400 font-mono mt-0.5">{description}</p>
          </div>
        </div>

        <button
          onClick={handleClaim}
          className="w-full py-2 rounded text-[10px] font-bold text-white
                     bg-gradient-to-r from-orange-600 to-amber-500
                     hover:from-orange-500 hover:to-amber-400
                     transition-colors flex items-center justify-center gap-1"
        >
          Забрать <Gift className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  // ═══ LOCKED (заблокировано, показываем прогресс) ═══
  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-lg border border-gray-700/40 p-3 opacity-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg opacity-40 flex-shrink-0">
          {ACHIEVEMENT_ICONS[id as AchievementId] || icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="text-xs font-bold text-white/60 font-mono">{title}</h3>
            <div className="flex items-center gap-0.5 text-gray-500 text-[9px] font-mono">
              <span className="leading-none translate-y-[0.5px]">{nutsReward}</span>
              <Hexagon className="w-3 h-3 text-gray-500" />
            </div>
          </div>
          <p className="text-[9px] text-gray-500 font-mono mb-1.5">{description}</p>

          <div>
            <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden mb-1">
              <div
                className="bg-gradient-to-r from-orange-600 to-amber-500 h-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-game-xs text-gray-500 font-mono">
              {currentProgress.toLocaleString()} / {targetValue.toLocaleString()} ({progressPercent}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AchievementCard

import { useCallback } from 'react'
import type { AchievementDefinition, PlayerAchievement } from '../store/gameStore'

// ============================================
// ТИПЫ
// ============================================

interface AchievementCardProps {
  definition: AchievementDefinition
  playerState: PlayerAchievement
  currentProgress: number
  onClaim: (id: string) => void
}

// ============================================
// КОМПОНЕНТ
// ============================================

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

  const handleClaim = useCallback(() => {
    onClaim(id)
  }, [id, onClaim])

  // ═══ CLAIMED (забрано) ═══
  if (claimed) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 opacity-60">
        <div className="flex items-start gap-2">
          <div className="text-xl opacity-50">{icon}</div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold text-game-sm sm:text-xs text-white/70 font-mono">{title}</h3>
              <span className="text-base">✅</span>
            </div>
            <p className="text-[9px] sm:text-[11px] text-gray-500 font-mono mb-1">{description}</p>
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-mono">
              Забрано: {nutsReward} 🔩
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ═══ UNLOCKED (разблокировано, можно забрать) ═══
  if (unlocked) {
    return (
      <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-lg p-3
                      border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/10">
        <div className="flex items-start gap-2">
          <div className="text-xl">{icon}</div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold text-game-sm sm:text-xs text-yellow-400 font-mono">{title}</h3>
              <span className="text-[9px] sm:text-[11px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded font-mono">
                +{nutsReward} 🔩
              </span>
            </div>
            <p className="text-[9px] sm:text-[11px] text-gray-300 font-mono mb-2">{description}</p>

            <button
              onClick={handleClaim}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold
                         py-1.5 px-3 rounded font-mono text-game-sm sm:text-xs transition-colors duration-200
                         active:scale-95 transform"
            >
              ЗАБРАТЬ 🎁
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══ LOCKED (заблокировано, показываем прогресс) ═══
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-start gap-2">
        <div className="text-xl opacity-40">{icon}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-bold text-game-sm sm:text-xs text-white/60 font-mono">{title}</h3>
            <span className="text-[9px] sm:text-[11px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded font-mono">
              {nutsReward} 🔩
            </span>
          </div>
          <p className="text-[9px] sm:text-[11px] text-gray-500 font-mono mb-1.5">{description}</p>

          <div>
            <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden mb-1">
              <div
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-game-xs sm:text-game-sm text-gray-500 font-mono">
              {currentProgress.toLocaleString()} / {targetValue.toLocaleString()} ({progressPercent}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AchievementCard

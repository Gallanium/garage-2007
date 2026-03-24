import {
  useGameStore,
  ACHIEVEMENTS,
  type AchievementId,
} from '../store/gameStore'
import { getAchievementProgress } from '../store/constants/achievements'
import { useShallow } from 'zustand/react/shallow'
import { Hexagon } from 'lucide-react'
import AchievementCard from './AchievementCard'

// ============================================
// КОМПОНЕНТ
// ============================================

/**
 * Панель достижений
 */
const AchievementsPanel: React.FC = () => {
  const achievements = useGameStore((s) => s.achievements)
  const claimAchievement = useGameStore((s) => s.claimAchievement)

  const stats = useGameStore(
    useShallow((s) => {
      const all = Object.values(s.achievements)
      return {
        total: all.length,
        unlocked: all.filter((a) => a.unlocked).length,
        claimed: all.filter((a) => a.claimed).length,
        totalNutsAvailable: Object.values(ACHIEVEMENTS)
          .filter((def) => s.achievements[def.id].unlocked && !s.achievements[def.id].claimed)
          .reduce((sum, def) => sum + def.nutsReward, 0),
      }
    }),
  )

  const sortedAchievements = Object.entries(ACHIEVEMENTS).sort(([idA], [idB]) => {
    const stateA = achievements[idA as AchievementId]
    const stateB = achievements[idB as AchievementId]

    if (stateA.claimed && !stateB.claimed) return 1
    if (!stateA.claimed && stateB.claimed) return -1
    if (stateA.unlocked && !stateB.unlocked) return -1
    if (!stateA.unlocked && stateB.unlocked) return 1
    return 0
  })

  return (
    <div className="flex flex-col gap-3 p-3" style={{ paddingBottom: 'calc(12px + var(--tg-safe-area-bottom, 0px))' }}>

      {/* ======== Компактная шапка: прогресс + награды ======== */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
        <div className="flex items-center justify-between gap-3">

          {/* Левая часть: прогресс */}
          <div className="flex-1 min-w-0">
            <p className="text-game-xs text-gray-500 uppercase tracking-widest font-mono mb-1">
              Прогресс
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-garage-yellow font-mono tabular-nums">
                {stats.claimed}
              </span>
              <span className="text-[9px] text-gray-500 font-mono">/</span>
              <span className="text-[9px] text-gray-400 font-mono tabular-nums">
                {stats.total}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden ml-1">
                <div
                  className="bg-gradient-to-r from-orange-600 to-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? Math.round((stats.claimed / stats.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Правая часть: к получению */}
          <div className="flex-shrink-0 text-right">
            <p className="text-game-xs text-gray-500 uppercase tracking-widest font-mono mb-1">
              К получению
            </p>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className={`text-base leading-none translate-y-[1.5px] font-bold font-mono tabular-nums ${stats.totalNutsAvailable > 0 ? 'text-white' : 'text-gray-600'}`}>
                {stats.totalNutsAvailable}
              </span>
              <Hexagon className={`w-4 h-4 ${stats.totalNutsAvailable > 0 ? 'text-orange-400' : 'text-gray-500'}`} />
            </div>
          </div>

        </div>
      </section>

      {/* ======== Список достижений ======== */}
      <section>
        <div className="grid grid-cols-1 gap-2">
          {sortedAchievements.map(([id, definition]) => {
            const achievementId = id as AchievementId
            const playerState = achievements[achievementId]
            const currentProgress = getAchievementProgress(useGameStore.getState(), definition.progressField)

            return (
              <AchievementCard
                key={id}
                definition={definition}
                playerState={playerState}
                currentProgress={currentProgress}
                onClaim={(id) => claimAchievement(id as AchievementId)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default AchievementsPanel

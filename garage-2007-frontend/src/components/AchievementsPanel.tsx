import {
  useGameStore,
  ACHIEVEMENTS,
  type AchievementId,
} from '../store/gameStore'
import { useShallow } from 'zustand/react/shallow'
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
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">

      {/* ======== Компактная шапка: прогресс + награды ======== */}
      <section className="bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-700/50">
        <div className="flex items-center justify-between gap-3">

          {/* Левая часть: прогресс */}
          <div className="flex-1 min-w-0">
            <p className="text-[8px] sm:text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">
              Прогресс
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-bold text-yellow-400 font-mono tabular-nums">
                {stats.claimed}
              </span>
              <span className="text-[10px] sm:text-xs text-gray-500 font-mono">/</span>
              <span className="text-[10px] sm:text-xs text-gray-400 font-mono tabular-nums">
                {stats.total}
              </span>
              <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden ml-1">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? Math.round((stats.claimed / stats.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Правая часть: к получению */}
          <div className="flex-shrink-0 text-right">
            <p className="text-[8px] sm:text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">
              К получению
            </p>
            <div className="flex items-center justify-end gap-1">
              <span className={`text-base sm:text-lg font-bold font-mono tabular-nums ${stats.totalNutsAvailable > 0 ? 'text-cyan-400' : 'text-gray-600'}`}>
                {stats.totalNutsAvailable}
              </span>
              <span className="text-base sm:text-lg">🔩</span>
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
            const currentProgress = definition.progressGetter(useGameStore.getState())

            return (
              <AchievementCard
                key={id}
                definition={definition}
                playerState={playerState}
                currentProgress={currentProgress}
                onClaim={claimAchievement}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default AchievementsPanel

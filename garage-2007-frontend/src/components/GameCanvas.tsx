import { useState } from 'react'
import PhaserGame from '../game/PhaserGame'
import DailyRewardButton from './DailyRewardButton'
import BoostButton from './BoostButton'
import BoostModal from './BoostModal'
import { EventBanner } from './EventBanner'
import { ErrorBoundary } from './ErrorBoundary'
import { useActiveEvent, GAME_EVENTS } from '../store/gameStore'

interface GameCanvasProps {
  garageLevel: number
  isActive: boolean
  onGarageClick: () => void
  dailyRewardStreak: number
  canClaimDaily: boolean
  onOpenDailyRewards: () => void
  hasAnyActiveBoost: boolean
}

/**
 * Игровая область: Phaser canvas + кнопка ежедневных наград + подсказка клика.
 */
export function GameCanvas({
  garageLevel,
  isActive,
  onGarageClick,
  dailyRewardStreak,
  canClaimDaily,
  onOpenDailyRewards,
  hasAnyActiveBoost,
}: GameCanvasProps) {
  const [showBoostModal, setShowBoostModal] = useState(false)
  const activeEvent = useActiveEvent()
  const activeEventCategory = activeEvent ? (GAME_EVENTS[activeEvent.id]?.category ?? null) : null

  return (
    <main className="flex-1 min-h-0 relative bg-gradient-to-b from-gray-800 to-gray-900">

      <div className="w-full h-full flex items-center justify-center">
        <ErrorBoundary fallback="Игровой движок недоступен. Попробуй перезагрузить страницу.">
          <PhaserGame
            onGarageClick={onGarageClick}
            garageLevel={garageLevel}
            isActive={isActive && !showBoostModal}
            hasAnyActiveBoost={hasAnyActiveBoost}
            activeEventCategory={activeEventCategory}
          />
        </ErrorBoundary>
      </div>

      <DailyRewardButton
        streak={dailyRewardStreak}
        canClaim={canClaimDaily}
        onClick={onOpenDailyRewards}
      />

      <BoostButton onClick={() => setShowBoostModal(true)} />

      <BoostModal
        isOpen={showBoostModal}
        onClose={() => setShowBoostModal(false)}
      />

      <EventBanner />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2
                      bg-garage-yellow/20 backdrop-blur-sm rounded-full px-3 py-2
                      border border-garage-yellow/50 animate-pulse">
        <p className="text-game-sm sm:text-xs text-garage-yellow font-mono text-center">
          👆 Кликни по гаражу
        </p>
      </div>

    </main>
  )
}

import { useState } from 'react'
import PhaserGame from '../game/PhaserGame'
import DailyRewardButton from './DailyRewardButton'
import BoostButton from './BoostButton'
import BoostModal from './BoostModal'
import { EventBanner } from './EventBanner'
import { ErrorBoundary } from './ErrorBoundary'
import { useTelegramHaptic } from '../hooks/useTelegram'
import { Pointer } from 'lucide-react'

interface GameCanvasProps {
  garageLevel: number
  isActive: boolean
  onGarageClick: () => boolean
  dailyRewardStreak: number
  canClaimDaily: boolean
  onOpenDailyRewards: () => void
  activeDecorations: string[]
  playSoundRef: React.MutableRefObject<((key: string) => void) | null>
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
  activeDecorations,
  playSoundRef,
}: GameCanvasProps) {
  const [showBoostModal, setShowBoostModal] = useState(false)
  const haptic = useTelegramHaptic()

  const handleGarageClick = () => {
    const isCritical = onGarageClick()
    if (isCritical) {
      haptic.impactMedium()
      playSoundRef.current?.('click_critical')
    } else {
      haptic.impactLight()
    }
  }

  return (
    <main className="flex-1 min-h-0 relative bg-gray-900">

      <div className="w-full h-full flex items-center justify-center">
        <ErrorBoundary fallback="Игровой движок недоступен. Попробуй перезагрузить страницу.">
          <PhaserGame
            onGarageClick={handleGarageClick}
            garageLevel={garageLevel}
            isActive={isActive && !showBoostModal}
            activeDecorations={activeDecorations}
            playSoundRef={playSoundRef}
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
                      bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 py-2
                      border border-orange-700/50">
        <p className="text-[9px] text-garage-yellow font-mono text-center flex items-center justify-center gap-1">
          <Pointer className="w-3 h-3" /> Кликни по гаражу
        </p>
      </div>

    </main>
  )
}

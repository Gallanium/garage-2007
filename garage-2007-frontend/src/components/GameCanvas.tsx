import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PhaserGame from '../game/PhaserGame'
import DailyRewardButton from './DailyRewardButton'
import BoostButton from './BoostButton'
import BoostModal from './BoostModal'
import { ErrorBoundary } from './ErrorBoundary'
import { useTelegramHaptic } from '../hooks/useTelegram'
import { Pointer } from 'lucide-react'
import { useMomentaryClickIncome } from '../store/gameStore'
import { CRITICAL_CLICK_MULTIPLIER } from '../store/constants/economy'

interface FloatingTextData {
  id: number
  x: number
  y: number
  targetX: number
  amount: number
  isCritical: boolean
}

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
  const [floatingTexts, setFloatingTexts] = useState<FloatingTextData[]>([])
  const haptic = useTelegramHaptic()
  const momentaryClickIncome = useMomentaryClickIncome()

  const handleGarageClick = (event?: { x: number, y: number }) => {
    const isCritical = onGarageClick()
    if (isCritical) {
      haptic.impactMedium()
      playSoundRef.current?.('click_critical')
    } else {
      haptic.impactLight()
    }

    if (event && typeof event.x === 'number' && typeof event.y === 'number') {
      const amount = momentaryClickIncome * (isCritical ? CRITICAL_CLICK_MULTIPLIER : 1)
      const newText: FloatingTextData = {
        id: Date.now() + Math.random(),
        x: event.x,
        y: event.y,
        targetX: event.x + (Math.random() * 60 - 30),
        amount,
        isCritical
      }
      setFloatingTexts(prev => [...prev, newText])
      setTimeout(() => {
        setFloatingTexts(prev => prev.filter(t => t.id !== newText.id))
      }, 1000)
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

      {/* Floating Text Overlay */}
      <AnimatePresence>
        {floatingTexts.map((ft) => (
          <motion.div
            key={ft.id}
            initial={{ opacity: 1, y: ft.y - 40, x: ft.x, scale: ft.isCritical ? 1.5 : 1 }}
            animate={{ opacity: 0, y: ft.y - 120, x: ft.targetX }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute pointer-events-none z-50 font-black font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
              ft.isCritical 
                ? 'text-red-500 text-2xl drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
                : 'text-garage-yellow text-xl'
            }`}
            style={{ left: 0, top: 0, marginLeft: '-1.5rem', marginTop: '-1rem' }}
          >
            +{Math.floor(ft.amount)}
          </motion.div>
        ))}
      </AnimatePresence>

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

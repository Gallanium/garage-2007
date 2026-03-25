import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PhaserGame from '../game/PhaserGame'
import DailyRewardButton from './DailyRewardButton'
import BoostButton from './BoostButton'
import BoostModal from './BoostModal'
import { ErrorBoundary } from './ErrorBoundary'
import { useTelegramHaptic } from '../hooks/useTelegram'
import { Pointer } from 'lucide-react'
import { useClickValue, useActiveBoostType, useActiveEvent, useGameStore, useIsModalOpen } from '../store/gameStore'
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
  const [showNutsPrompt, setShowNutsPrompt] = useState(false)
  const [floatingTexts, setFloatingTexts] = useState<FloatingTextData[]>([])
  const [phaserKey, setPhaserKey] = useState(0)
  const mainRef = useRef<HTMLElement | null>(null)
  const critEffectRef = useRef<((x: number, y: number) => void) | null>(null)
  const floatingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const haptic = useTelegramHaptic()
  const clickValue = useClickValue()
  const activeBoostType = useActiveBoostType()
  const activeEvent = useActiveEvent()
  const getActiveMultiplier = useGameStore((s) => s.getActiveMultiplier)
  const getEventMultiplier = useGameStore((s) => s.getEventMultiplier)
  const storeModalOpen = useIsModalOpen()
  const isAnyModalOpen = storeModalOpen || showBoostModal || showNutsPrompt

  useEffect(() => {
    const timeouts = floatingTimeoutsRef.current
    return () => {
      timeouts.forEach(id => clearTimeout(id))
      timeouts.clear()
    }
  }, [])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    let initHeight = main.getBoundingClientRect().height
    let timer: ReturnType<typeof setTimeout> | null = null

    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h && Math.abs(h - initHeight) > 50) {
        initHeight = h
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => setPhaserKey(k => k + 1), 500)
      }
    })
    observer.observe(main)
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const clickMultiplier =
    (activeBoostType ? getActiveMultiplier('click') : 1) *
    (activeEvent ? getEventMultiplier('click') : 1)
  
  const baseAmount = clickValue * clickMultiplier

  const handleGarageClick = (event?: { x: number, y: number }) => {
    // Блокируем клики если открыто любое модальное окно (store + local state)
    if (isAnyModalOpen) {
      return false // отменяем клик (возвращая false, мы даем знать движку, чтобы он не делал эффекты)
    }

    const isCritical = onGarageClick()
    if (isCritical) {
      haptic.impactMedium()
      playSoundRef.current?.('click_critical')
      if (event && typeof event.x === 'number' && typeof event.y === 'number') {
        critEffectRef.current?.(event.x, event.y)
      }
    } else {
      haptic.impactLight()
      playSoundRef.current?.('click_normal')
    }

    if (event && typeof event.x === 'number' && typeof event.y === 'number') {
      const amount = baseAmount * (isCritical ? CRITICAL_CLICK_MULTIPLIER : 1)
      const newText: FloatingTextData = {
        id: Date.now() + Math.random(),
        x: event.x,
        y: event.y,
        targetX: event.x + (Math.random() * 60 - 30),
        amount,
        isCritical
      }
      setFloatingTexts(prev => [...prev, newText])
      const timeoutId = setTimeout(() => {
        setFloatingTexts(prev => prev.filter(t => t.id !== newText.id))
        floatingTimeoutsRef.current.delete(timeoutId)
      }, 1000)
      floatingTimeoutsRef.current.add(timeoutId)
    }
  }

  return (
    <main ref={mainRef} className="flex-1 min-h-0 relative bg-gray-900">

      <div className="w-full h-full flex items-center justify-center">
        <ErrorBoundary fallback="Игровой движок недоступен. Попробуй перезагрузить страницу.">
          <PhaserGame
            key={phaserKey}
            onGarageClick={handleGarageClick}
            garageLevel={garageLevel}
            isActive={isActive && !showBoostModal}
            isModalOpen={isAnyModalOpen}
            activeDecorations={activeDecorations}
            playSoundRef={playSoundRef}
            critEffectRef={critEffectRef}
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
        onClose={() => { setShowBoostModal(false); setShowNutsPrompt(false) }}
        onNutsPromptChange={setShowNutsPrompt}
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

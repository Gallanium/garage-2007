import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useActiveEvent, GAME_EVENTS } from '../store/gameStore'
import { TrendingUp, TrendingDown, Info } from 'lucide-react'

/**
 * Компонент "Атмосферных событий" (Concept 4).
 * Ловит `activeEvent` и рисует:
 * 1. Огромный всплывающий баннер по центру (на 2.5 секунды) при старте события.
 * 2. Глобальную пульсирующую цветную окантовку / дымку вокруг всего окна приложения, пока событие живо.
 */
export function AmbientEventSystem() {
  const activeEvent = useActiveEvent()
  const activeEventId = activeEvent?.id
  const [showBanner, setShowBanner] = useState(false)
  const lastEventIdRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activatedAtRef = useRef(activeEvent?.activatedAt)
  useEffect(() => {
    activatedAtRef.current = activeEvent?.activatedAt
  }, [activeEvent?.activatedAt])

  useEffect(() => {
    // Если появилось новое активное событие...
    if (activeEventId && activeEventId !== lastEventIdRef.current) {
      lastEventIdRef.current = activeEventId

      // Не показываем баннер при ре-логине / рефреше страницы:
      // если событие стартовало более 5 секунд назад — пропускаем
      const eventAge = activatedAtRef.current ? Date.now() - activatedAtRef.current : Infinity
      if (eventAge > 5000) return

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowBanner(true)

      // Показываем массивный поп-ап ровно на 3.5 секунды
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setShowBanner(false)
      }, 3500)
    }
  }, [activeEventId])

  // Отдельный cleanup только на unmount — не убивает таймер при обновлениях стора
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Если нет активного события — сбрасываем состояние и скрываемся
  if (!activeEvent) {
    if (lastEventIdRef.current !== null) {
      lastEventIdRef.current = null
    }
    return null
  }

  const def = GAME_EVENTS[activeEvent.id]
  if (!def) return null

  const isPos = def.category === 'positive'
  const isNeg = def.category === 'negative'
  
  // Цвета для Ambient Glow
  const glowColorStr = isPos ? 'rgba(34, 197, 94, 0.25)' // Green
                     : isNeg ? 'rgba(239, 68, 68, 0.25)' // Red
                     : 'rgba(56, 189, 248, 0.25)'        // Cyan/Blue

  const textColorClass = isPos ? 'text-green-400' 
                       : isNeg ? 'text-red-400' 
                       : 'text-cyan-400'
                       
  const IconCmp = isPos ? TrendingUp : isNeg ? TrendingDown : Info

  return (
    <>
      {/* 1. Глобальная атмосферная рамка (Inset Glow поверх всех элементов) */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-[100]"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: 1,
          boxShadow: `inset 0 0 120px ${glowColorStr}, inset 0 0 40px ${glowColorStr}`
        }}
        exit={{ opacity: 0 }}
        transition={{ 
          opacity: { duration: 0.5 },
          boxShadow: { duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
        }}
      />

      {/* 2. Огромный оповещающий баннер по центру (через Portal чтобы избежать CSS 3D смещений) */}
      {createPortal(
        <AnimatePresence>
          {showBanner && (
            <motion.div
              className="fixed inset-0 z-[110] flex items-center justify-center"
              initial={{ opacity: 0, backgroundColor: 'rgba(0,0,0,0)' }}
              animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              exit={{ opacity: 0, backgroundColor: 'rgba(0,0,0,0)', backdropFilter: 'blur(0px)' }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                initial={{ scale: 0.8, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0.4, duration: 0.5 }}
                className="flex flex-col items-center justify-center text-center px-6 max-w-[90%]"
              >
                <IconCmp className={`w-20 h-20 mb-6 ${textColorClass} drop-shadow-[0_0_20px_currentColor]`} />
                
                <h1 className={`text-xl leading-tight font-mono font-bold uppercase tracking-widest mb-3 ${textColorClass} drop-shadow-[0_0_10px_currentColor]`}>
                  {def.name}
                </h1>
                
                <p className="text-gray-300 font-mono text-[10px] uppercase tracking-wide px-4 py-2 bg-black/50 border border-gray-700/50 rounded-lg backdrop-blur-md">
                  {def.description}
                </p>
                
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

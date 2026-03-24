import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const TYPE_STYLES = {
  error: 'bg-red-900/90 border-red-500/50 text-red-100',
  success: 'bg-green-900/90 border-green-500/50 text-green-100',
  info: 'bg-gray-800/90 border-garage-yellow/50 text-gray-100',
} as const

const ToastContainer: React.FC = () => {
  const toasts = useGameStore(s => s.toasts)
  const dismissToast = useGameStore(s => s.dismissToast)

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] flex flex-col gap-2 w-[90%] max-w-[340px] pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto px-3 py-2 rounded-lg border font-mono text-game-xs leading-snug cursor-pointer ${TYPE_STYLES[toast.type]}`}
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer

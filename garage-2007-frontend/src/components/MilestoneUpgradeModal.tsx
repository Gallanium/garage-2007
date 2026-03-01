// ============================================
// МОДАЛКА «ПОВЫШЕНИЕ КЛАССА ГАРАЖА»
// ============================================

import { useCallback, useEffect } from 'react'
import { formatLargeNumber, GARAGE_LEVEL_NAMES } from '../store/gameStore'

// ============================================
// ТИПЫ
// ============================================

interface MilestoneUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  onPurchase: () => void
  currentLevel: number
  nextLevel: number
  upgradeCost: number
  unlocks: {
    workers: string[]
    upgrades: string[]
    decorations: string[]
    visual: string
  }
  canAfford: boolean
}

// ============================================
// КОМПОНЕНТ
// ============================================

const MilestoneUpgradeModal: React.FC<MilestoneUpgradeModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
  currentLevel,
  nextLevel,
  upgradeCost,
  unlocks,
  canAfford,
}) => {
  const handleOverlayClick = useCallback(() => { onClose() }, [onClose])
  const handleCardClick = useCallback((e: React.MouseEvent) => { e.stopPropagation() }, [])
  const handlePurchase = useCallback(() => { onPurchase() }, [onPurchase])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const levelName = GARAGE_LEVEL_NAMES[nextLevel as keyof typeof GARAGE_LEVEL_NAMES] || 'Неизвестно'

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center
                 animate-[fadeIn_300ms_ease-out]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Повышение класса гаража"
    >
      <div
        className="relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-5
                   max-w-sm w-[90%] mx-auto
                   border border-garage-rust/50 shadow-2xl
                   text-center
                   animate-[slideUp_400ms_ease-out]"
        onClick={handleCardClick}
      >
        {/* X-кнопка */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center
                     rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50
                     transition-colors duration-200 text-base sm:text-lg"
          aria-label="Закрыть"
        >
          ✕
        </button>

        <h2 className="text-sm sm:text-base font-bold text-yellow-400 mb-2 font-mono">
          🏆 ПОВЫШЕНИЕ КЛАССА
        </h2>

        <p className="text-[10px] sm:text-xs text-gray-300 mb-1 font-mono">
          Ур.{currentLevel} → Ур.{nextLevel}
        </p>
        <p className="text-[10px] sm:text-xs text-garage-yellow font-mono mb-3">
          «{levelName}»
        </p>

        <div className="border-t border-gray-700 mb-3" />

        {/* Визуал-превью */}
        <div className="flex justify-center mb-3">
          <div
            className="w-24 h-24 rounded-lg bg-gradient-to-br from-garage-rust to-garage-yellow
                       border-2 border-garage-yellow/50 flex items-center justify-center"
          >
            <span className="text-3xl">🏗️</span>
          </div>
        </div>

        {/* Что откроется */}
        <div className="text-left mb-3">
          <p className="text-[10px] sm:text-xs font-bold text-yellow-400 mb-1.5 font-mono">
            ✨ ОТКРОЕТСЯ:
          </p>
          <ul className="space-y-0.5 text-[9px] sm:text-[11px] text-gray-300 font-mono">
            {unlocks.workers.length > 0 &&
              unlocks.workers.map((worker, i) => (
                <li key={`worker-${i}`}>👷 {worker}</li>
              ))}
            {unlocks.upgrades.length > 0 &&
              unlocks.upgrades.map((upgrade, i) => (
                <li key={`upgrade-${i}`}>⚙️ {upgrade}</li>
              ))}
            {unlocks.decorations.length > 0 &&
              unlocks.decorations.map((deco, i) => (
                <li key={`deco-${i}`}>🎨 {deco}</li>
              ))}
            {unlocks.visual && (
              <li>🏗️ {unlocks.visual}</li>
            )}
          </ul>
        </div>

        <p className="text-[9px] sm:text-[11px] italic text-yellow-300 mb-3 font-mono">
          🔥 Новые возможности!
        </p>

        <button
          type="button"
          onClick={handlePurchase}
          disabled={!canAfford}
          className={`w-full py-2 px-4 rounded-lg font-mono text-[10px] sm:text-xs font-bold
                      transition-colors duration-200
                      active:scale-95 transform
                      ${canAfford
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
        >
          ПОВЫСИТЬ ЗА {formatLargeNumber(upgradeCost)} ₽
        </button>

      </div>
    </div>
  )
}

export default MilestoneUpgradeModal

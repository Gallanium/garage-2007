// ============================================
// МОДАЛКА «ПОВЫШЕНИЕ КЛАССА ГАРАЖА»
// ============================================

import { useCallback, useEffect } from 'react'
import { formatLargeNumber, GARAGE_LEVEL_NAMES } from '../store/gameStore'
import { Building, HardHat, Zap, Palette } from 'lucide-react'

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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_300ms_ease-out]"
      style={{ paddingTop: 'var(--tg-safe-area-top)', paddingBottom: 'var(--tg-safe-area-bottom)' }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Повышение класса гаража"
    >
      <div
        className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-4
                   mx-3 w-full max-w-sm font-mono
                   shadow-2xl shadow-orange-900/30 text-center animate-[slideUp_400ms_ease-out]"
        onClick={handleCardClick}
      >
        {/* X-кнопка */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none p-1"
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className="text-center mb-4 animate-[fadeIn_300ms_ease-out]">
          <h2 className="text-garage-yellow text-sm font-bold tracking-widest">
            Повышение класса
          </h2>
          <p className="text-gray-500 text-[9px] mt-1 tracking-wide">
            Ур.{currentLevel} → Ур.{nextLevel}
          </p>
        </div>

        <p className="text-garage-yellow text-xs font-bold font-mono mb-3">
          «{levelName}»
        </p>

        <div className="border-t border-orange-700/30 mb-3" />

        {/* Визуал-превью */}
        <div className="flex justify-center mb-3">
          <div
            className="w-20 h-20 rounded-lg bg-gradient-to-br from-orange-950/80 to-amber-950/60
                       border border-orange-700/60 flex items-center justify-center"
          >
            <span className="text-white"><Building className="w-8 h-8" /></span>
          </div>
        </div>

        {/* Что откроется */}
        <div className="text-left mb-3">
          <p className="text-garage-yellow text-[9px] font-bold mb-1.5 font-mono">
            Откроется:
          </p>
          <ul className="space-y-0.5 text-[9px] text-gray-400 font-mono">
            {unlocks.workers.length > 0 &&
              unlocks.workers.map((worker, i) => (
                <li key={`worker-${i}`}><HardHat className="inline-block w-3 h-3 text-gray-500 mr-1 align-text-bottom" /> {worker}</li>
              ))}
            {unlocks.upgrades.length > 0 &&
              unlocks.upgrades.map((upgrade, i) => (
                <li key={`upgrade-${i}`}><Zap className="inline-block w-3 h-3 text-gray-500 mr-1 align-text-bottom" /> {upgrade}</li>
              ))}
            {unlocks.decorations.length > 0 &&
              unlocks.decorations.map((deco, i) => (
                <li key={`deco-${i}`}><Palette className="inline-block w-3 h-3 text-gray-500 mr-1 align-text-bottom" /> {deco}</li>
              ))}
            {unlocks.visual && (
              <li><Building className="inline-block w-3 h-3 text-gray-500 mr-1 align-text-bottom" /> {unlocks.visual}</li>
            )}
          </ul>
        </div>

        <button
          type="button"
          onClick={handlePurchase}
          disabled={!canAfford}
          className={`w-full py-2 rounded text-[10px] font-bold
                      transition-colors
                      ${canAfford
                        ? 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
        >
          Повысить за {formatLargeNumber(upgradeCost)} ₽
        </button>

      </div>
    </div>
  )
}

export default MilestoneUpgradeModal

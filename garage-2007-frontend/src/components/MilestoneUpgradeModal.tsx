// ============================================
// МОДАЛКА «ПОВЫШЕНИЕ КЛАССА ГАРАЖА»
// Milestone-апгрейды на уровнях 5, 10, 15, 20
//
// Показывает информацию о переходе на новый уровень:
// - Название нового уровня гаража
// - Список разблокируемых возможностей (работники, апгрейды, декорации, визуал)
// - Стоимость и текущий баланс
// - Кнопку покупки (активна если хватает средств)
//
// Компонент чисто презентационный — вся логика (покупка, закрытие)
// управляется родителем через пропсы.
// ============================================

import { useCallback, useEffect } from 'react'
import { formatLargeNumber, GARAGE_LEVEL_NAMES } from '../store/gameStore'

// ============================================
// ТИПЫ
// ============================================

interface MilestoneUpgradeModalProps {
  /** Видимость модалки */
  isOpen: boolean
  /** Закрытие модалки (оверлей, кнопка «Закрыть», Escape) */
  onClose: () => void
  /** Покупка апгрейда */
  onPurchase: () => void
  /** Текущий уровень гаража */
  currentLevel: number
  /** Уровень, на который повышается гараж */
  nextLevel: number
  /** Стоимость апгрейда (₽) */
  upgradeCost: number
  /** Текущий баланс игрока (₽) */
  currentBalance: number
  /** Что разблокируется при повышении */
  unlocks: {
    workers: string[]
    upgrades: string[]
    decorations: string[]
    visual: string
  }
  /** Хватает ли денег на покупку */
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
  currentBalance,
  unlocks,
  canAfford,
}) => {
  // --- Обработчики (useCallback до early return, правила хуков) ---

  /** Клик на оверлей → закрыть */
  const handleOverlayClick = useCallback(() => { onClose() }, [onClose])

  /** Клик на карточку → не пропускать к оверлею */
  const handleCardClick = useCallback((e: React.MouseEvent) => { e.stopPropagation() }, [])

  /** Клик на кнопку покупки */
  const handlePurchase = useCallback(() => { onPurchase() }, [onPurchase])

  // --- Escape закрывает модалку (accessibility) ---

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // --- Early return: не рендерим если модалка закрыта ---

  if (!isOpen) return null

  // --- Вычисляемые значения ---

  const balanceAfterPurchase = currentBalance - upgradeCost
  const levelName = GARAGE_LEVEL_NAMES[nextLevel as keyof typeof GARAGE_LEVEL_NAMES] || 'Неизвестно'

  // ============================================
  // JSX
  // ============================================

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center
                 animate-[fadeIn_300ms_ease-out]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Повышение класса гаража"
    >
      {/* --- Карточка модалки --- */}
      <div
        className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-6
                   max-w-md w-[90%] mx-auto mt-32
                   border border-garage-rust/50 shadow-2xl
                   text-center
                   animate-[slideUp_400ms_ease-out]"
        onClick={handleCardClick}
      >
        {/* 1. Заголовок */}
        <h2 className="text-2xl font-bold text-yellow-400 mb-2 font-mono">
          🏆 ПОВЫШЕНИЕ КЛАССА ГАРАЖА
        </h2>

        {/* 2. Информация о переходе */}
        <p className="text-lg text-gray-300 mb-1 font-mono">
          Уровень {currentLevel} → Уровень {nextLevel}
        </p>
        <p className="text-sm text-garage-yellow font-mono mb-4">
          «{levelName}»
        </p>

        {/* 3. Разделитель */}
        <div className="border-t border-gray-700 mb-4" />

        {/* 4. Визуал-превью (placeholder для MVP) */}
        <div className="flex justify-center mb-4">
          <div
            className="w-32 h-32 rounded-lg bg-gradient-to-br from-garage-rust to-garage-yellow
                       border-2 border-garage-yellow/50 flex items-center justify-center"
          >
            <span className="text-4xl">🏗️</span>
          </div>
        </div>

        {/* 5. Блок «Что откроется» */}
        <div className="text-left mb-4">
          <p className="text-sm font-bold text-yellow-400 mb-2 font-mono">
            ✨ ЧТО ОТКРОЕТСЯ:
          </p>
          <ul className="space-y-1 text-sm text-gray-300 font-mono">
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

        {/* 6. Блок «Стоимость» */}
        <div className="border-t border-gray-700 mb-4 pt-4">
          <p className="text-sm font-bold text-yellow-400 mb-2 font-mono">
            💰 СТОИМОСТЬ:
          </p>
          <div className="space-y-1 text-sm font-mono text-left">
            <p className="text-gray-300">
              Цена:{' '}
              <span className="text-white font-bold">
                {formatLargeNumber(upgradeCost)} ₽
              </span>
            </p>
            <p className="text-gray-300">
              Баланс:{' '}
              <span className={`font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                {formatLargeNumber(currentBalance)} ₽
              </span>
            </p>
            <p className="text-gray-300">
              После покупки:{' '}
              <span className={`font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                {canAfford ? `${formatLargeNumber(balanceAfterPurchase)} ₽` : '—'}
              </span>
            </p>
          </div>
        </div>

        {/* 7. Мотивационный текст (FOMO) */}
        <p className="text-sm italic text-yellow-300 mb-4 font-mono">
          🔥 Новый уровень — новые возможности!
        </p>

        {/* 8. Кнопка покупки */}
        <button
          type="button"
          onClick={handlePurchase}
          disabled={!canAfford}
          className={`w-full py-3 px-6 rounded-lg font-mono text-lg font-bold
                      transition-colors duration-200
                      active:scale-95 transform
                      mb-3
                      ${canAfford
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
        >
          ПОВЫСИТЬ КЛАСС ЗА {formatLargeNumber(upgradeCost)} ₽
        </button>

        {/* 9. Кнопка «Закрыть» */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 px-6 rounded-lg font-mono text-sm
                     text-gray-400 hover:text-gray-300
                     transition-colors duration-200
                     active:scale-95 transform"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}

export default MilestoneUpgradeModal

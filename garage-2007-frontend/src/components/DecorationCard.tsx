// src/components/DecorationCard.tsx
import {
  DECORATION_CATALOG,
  SLOT_LABELS,
  useBalance,
  useNuts,
  useGarageLevel,
  usePurchaseDecoration,
  useToggleDecoration,
  useOwnedDecorations,
  useActiveDecorations,
  formatLargeNumber,
} from '../store/gameStore'

interface DecorationCardProps {
  id: string
}

export const DecorationCard: React.FC<DecorationCardProps> = ({ id }) => {
  const def = DECORATION_CATALOG[id]
  const balance = useBalance()
  const nuts = useNuts()
  const garageLevel = useGarageLevel()
  const owned = useOwnedDecorations()
  const active = useActiveDecorations()
  const purchaseDecoration = usePurchaseDecoration()
  const toggleDecoration = useToggleDecoration()

  if (!def) return null

  const isOwned = owned.includes(id)
  const isActive = active.includes(id)
  const isUnlocked = garageLevel >= def.unlockLevel
  const canAfford = def.currency === 'rubles' ? balance >= def.cost : nuts >= def.cost

  const costLabel = def.currency === 'rubles'
    ? `${formatLargeNumber(def.cost)} ₽`
    : `${def.cost} 🔩`

  // Декорация в том же слоте, которая будет вытеснена
  const slotConflict = !isOwned
    ? active
        .filter(activeId => activeId !== id)
        .find(activeId => DECORATION_CATALOG[activeId]?.slot === def.slot)
    : null
  const conflictDef = slotConflict ? DECORATION_CATALOG[slotConflict] : null

  const slotLabel = SLOT_LABELS[def.slot]

  // State: locked
  if (!isUnlocked) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-2 border-2 border-dashed border-gray-700 opacity-60">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl opacity-40">{def.icon}</span>
          <div>
            <p className="text-gray-500 font-mono font-bold text-game-sm sm:text-xs">{def.name}</p>
            <p className="text-gray-600 font-mono text-[9px]">{def.description}</p>
            <p className="text-gray-700 font-mono text-[8px]">📍 {slotLabel}</p>
          </div>
        </div>
        <p className="text-gray-500 text-center font-mono text-game-sm sm:text-xs">
          🔒 Уровень {def.unlockLevel}
        </p>
      </div>
    )
  }

  // State: owned + active
  if (isOwned && isActive) {
    return (
      <div className="bg-green-900/30 rounded-lg p-2 border-2 border-green-500/60">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{def.icon}</span>
          <div className="flex-1">
            <p className="text-green-300 font-mono font-bold text-game-sm sm:text-xs">{def.name}</p>
            <p className="text-gray-400 font-mono text-[9px]">{def.description}</p>
            <p className="text-gray-600 font-mono text-[8px]">📍 {slotLabel}</p>
          </div>
          <span className="text-green-400 text-[10px] font-mono">✓ Активно</span>
        </div>
        <button
          onClick={() => toggleDecoration(id)}
          className="w-full py-1 rounded font-mono font-bold text-game-sm sm:text-xs
                     bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Скрыть
        </button>
      </div>
    )
  }

  // State: owned + hidden
  if (isOwned && !isActive) {
    // slotConflict is null for owned items — compute separately for toggle
    const toggleConflict = active
      .filter(activeId => activeId !== id)
      .find(activeId => DECORATION_CATALOG[activeId]?.slot === def.slot)
    const toggleConflictDef = toggleConflict ? DECORATION_CATALOG[toggleConflict] : null

    return (
      <div className="bg-gray-800/40 rounded-lg p-2 border-2 border-gray-600/50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl opacity-60">{def.icon}</span>
          <div className="flex-1">
            <p className="text-gray-400 font-mono font-bold text-game-sm sm:text-xs">{def.name}</p>
            <p className="text-gray-500 font-mono text-[9px]">{def.description}</p>
            <p className="text-gray-600 font-mono text-[8px]">📍 {slotLabel}</p>
          </div>
        </div>
        <button
          onClick={() => toggleDecoration(id)}
          className="w-full py-1 rounded font-mono font-bold text-game-sm sm:text-xs
                     bg-blue-700 hover:bg-blue-600 text-white transition-colors"
        >
          Показать
        </button>
        {toggleConflictDef && (
          <p className="text-yellow-500/80 font-mono text-[8px] text-center mt-1">
            ⚠️ Заменит: {toggleConflictDef.icon} {toggleConflictDef.name}
          </p>
        )}
      </div>
    )
  }

  // State: available but cannot afford
  if (!canAfford) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-2 border-2 border-gray-600">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{def.icon}</span>
          <div className="flex-1">
            <p className="text-gray-300 font-mono font-bold text-game-sm sm:text-xs">{def.name}</p>
            <p className="text-gray-500 font-mono text-[9px]">{def.description}</p>
            <p className="text-gray-600 font-mono text-[8px]">📍 {slotLabel}</p>
          </div>
        </div>
        <button
          disabled
          className="w-full py-1 rounded font-mono font-bold text-game-sm sm:text-xs
                     bg-gray-700 text-gray-500 cursor-not-allowed"
        >
          <span className="text-red-400">{costLabel}</span>
        </button>
        {conflictDef && (
          <p className="text-yellow-500/80 font-mono text-[8px] text-center mt-1">
            ⚠️ Заменит: {conflictDef.icon} {conflictDef.name}
          </p>
        )}
      </div>
    )
  }

  // State: available and can afford
  return (
    <div className="bg-gray-800/60 rounded-lg p-2 border-2 border-gray-600 hover:border-yellow-500/50 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{def.icon}</span>
        <div className="flex-1">
          <p className="text-white font-mono font-bold text-game-sm sm:text-xs">{def.name}</p>
          <p className="text-gray-400 font-mono text-[9px]">{def.description}</p>
          <p className="text-gray-600 font-mono text-[8px]">📍 {slotLabel}</p>
        </div>
      </div>
      <button
        onClick={() => purchaseDecoration(id)}
        className="w-full py-1 rounded font-mono font-bold text-game-sm sm:text-xs
                   bg-yellow-600 hover:bg-yellow-500 text-black transition-colors"
      >
        Купить {costLabel}
      </button>
      {conflictDef && (
        <p className="text-yellow-500/80 font-mono text-[8px] text-center mt-1">
          ⚠️ Заменит: {conflictDef.icon} {conflictDef.name}
        </p>
      )}
    </div>
  )
}

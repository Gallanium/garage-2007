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
import { useAudio } from '../contexts/AudioContext'

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
  const { playSound } = useAudio()

  if (!def) return null

  const isOwned = owned.includes(id)
  const isActive = active.includes(id)
  const isUnlocked = garageLevel >= def.unlockLevel
  const canAfford = def.currency === 'rubles' ? balance >= def.cost : nuts >= def.cost

  const costLabel = def.currency === 'rubles'
    ? `${formatLargeNumber(def.cost)} ₽`
    : `${def.cost} 🔩`

  const slotLabel = SLOT_LABELS[def.slot]
  const subline = `${def.description} · 📍 ${slotLabel}`

  // Конфликт слота — для покупки
  const slotConflict = !isOwned
    ? active
        .filter(activeId => activeId !== id)
        .find(activeId => DECORATION_CATALOG[activeId]?.slot === def.slot)
    : null
  const conflictDef = slotConflict ? DECORATION_CATALOG[slotConflict] : null

  // State: locked
  if (!isUnlocked) {
    return (
      <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 rounded-lg border border-gray-700/40 p-3 opacity-50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg opacity-40 flex-shrink-0">
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-500 font-mono truncate">{def.name}</p>
            <p className="text-[9px] text-gray-600 font-mono">{subline}</p>
          </div>
        </div>
        <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30">
          🔒 Уровень {def.unlockLevel}
        </div>
      </div>
    )
  }

  // State: owned + active
  if (isOwned && isActive) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-green-700/40 p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center text-lg flex-shrink-0">
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white font-mono">{def.name}</p>
              <span className="text-green-300 text-[9px] font-mono">✓ Активно</span>
            </div>
            <p className="text-[9px] text-gray-400 font-mono mt-0.5">{subline}</p>
          </div>
        </div>
        <button
          onClick={() => toggleDecoration(id)}
          className="w-full py-2 rounded text-[10px] font-bold text-gray-300 bg-black/30 transition-colors"
        >
          Скрыть
        </button>
      </div>
    )
  }

  // State: owned + hidden
  if (isOwned && !isActive) {
    const toggleConflict = active
      .filter(activeId => activeId !== id)
      .find(activeId => DECORATION_CATALOG[activeId]?.slot === def.slot)
    const toggleConflictDef = toggleConflict ? DECORATION_CATALOG[toggleConflict] : null

    return (
      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-lg border border-gray-700/40 p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg opacity-60 flex-shrink-0">
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-300 font-mono">{def.name}</p>
            <p className="text-[9px] text-gray-500 font-mono mt-0.5">{subline}</p>
          </div>
        </div>
        <button
          onClick={() => toggleDecoration(id)}
          className="w-full py-2 rounded text-[10px] font-bold text-white
                     bg-gradient-to-r from-blue-700 to-cyan-600 hover:from-blue-600 hover:to-cyan-500
                     transition-colors"
        >
          Показать
        </button>
        {toggleConflictDef && (
          <p className="text-orange-400/80 font-mono text-[9px] text-center mt-1">
            ⚠️ Заменит: {toggleConflictDef.icon} {toggleConflictDef.name}
          </p>
        )}
      </div>
    )
  }

  // State: available but cannot afford
  if (!canAfford) {
    return (
      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-lg border border-gray-700/40 p-3 opacity-50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg flex-shrink-0">
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-300 font-mono">{def.name}</p>
            <p className="text-[9px] text-gray-500 font-mono mt-0.5">{subline}</p>
          </div>
        </div>
        <div className="w-full py-2 rounded text-center text-[10px] font-bold bg-black/30">
          <span className="text-cyan-400 opacity-60">{costLabel}</span>
        </div>
        {conflictDef && (
          <p className="text-orange-400/80 font-mono text-[9px] text-center mt-1">
            ⚠️ Заменит: {conflictDef.icon} {conflictDef.name}
          </p>
        )}
      </div>
    )
  }

  // State: available and can afford
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-orange-700 flex items-center justify-center text-lg flex-shrink-0">
          {def.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white font-mono">{def.name}</p>
          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{subline}</p>
        </div>
      </div>
      <button
        onClick={() => { purchaseDecoration(id); playSound('purchase') }}
        className="w-full py-2 rounded text-[10px] font-bold text-white
                   bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400
                   transition-colors"
      >
        Купить {costLabel}
      </button>
      {conflictDef && (
        <p className="text-orange-400/80 font-mono text-[9px] text-center mt-1">
          ⚠️ Заменит: {conflictDef.icon} {conflictDef.name}
        </p>
      )}
    </div>
  )
}

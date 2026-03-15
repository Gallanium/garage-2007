// src/components/DecorationSection.tsx
import { useState } from 'react'
import { DECORATION_CATALOG, useOwnedDecorations } from '../store/gameStore'
import type { DecorationCategory } from '../store/gameStore'
import { DecorationCard } from './DecorationCard'

type FilterCategory = DecorationCategory | 'all'

const CATEGORY_LABELS: Record<FilterCategory, string> = {
  all:       'Все',
  tools:     '🔧',
  wall_decor:'🎨',
  lighting:  '💡',
  cars:      '🚗',
  trophies:  '🏆',
}

const ALL_CATEGORIES: FilterCategory[] = ['all', 'tools', 'wall_decor', 'lighting', 'cars', 'trophies']

export const DecorationSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all')
  const owned = useOwnedDecorations()

  const allIds = Object.keys(DECORATION_CATALOG)

  const filteredIds = activeCategory === 'all'
    ? allIds
    : allIds.filter(id => DECORATION_CATALOG[id].category === activeCategory)

  const ownedCount = (cat: FilterCategory) => {
    if (cat === 'all') return owned.length
    return owned.filter(id => DECORATION_CATALOG[id]?.category === cat).length
  }

  const totalCount = (cat: FilterCategory) => {
    if (cat === 'all') return allIds.length
    return allIds.filter(id => DECORATION_CATALOG[id].category === cat).length
  }

  return (
    <section>
      <h2 className="text-sm sm:text-base font-bold mb-2 text-yellow-400 font-mono">
        ДЕКОРАЦИИ
      </h2>

      {/* Category filter */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 rounded font-mono text-[10px] sm:text-xs transition-colors
              ${activeCategory === cat
                ? 'bg-yellow-600 text-black font-bold'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            {CATEGORY_LABELS[cat]} {ownedCount(cat)}/{totalCount(cat)}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-2">
        {filteredIds.map(id => (
          <DecorationCard key={id} id={id} />
        ))}
      </div>
    </section>
  )
}

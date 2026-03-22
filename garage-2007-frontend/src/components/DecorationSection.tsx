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
      <h2 className="text-garage-yellow text-sm font-bold tracking-widest font-mono mb-2">
        Декорации
      </h2>

      {/* Category filter */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 rounded font-mono text-[10px] transition-colors
              ${activeCategory === cat
                ? 'bg-gradient-to-r from-orange-700 to-amber-600 text-white font-bold'
                : 'bg-gray-900 text-gray-500 hover:bg-gray-800'
              }`}
          >
            {CATEGORY_LABELS[cat]} {ownedCount(cat)}/{totalCount(cat)}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-2">
        {filteredIds.map(id => (
          <DecorationCard key={id} id={id} />
        ))}
      </div>
    </section>
  )
}

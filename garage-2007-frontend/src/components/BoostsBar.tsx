// src/components/BoostsBar.tsx
import { useState, useEffect, useCallback } from 'react'
import { useGameStore, useNuts, useBoosts, BOOST_DEFINITIONS, BOOST_CONFLICT_GROUPS } from '../store/gameStore'
import type { BoostType } from '../store/gameStore'
import NutsPromptModal from './NutsPromptModal'

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BOOST_ORDER: BoostType[] = ['income_2x', 'income_3x', 'turbo']

export default function BoostsBar() {
  const nuts = useNuts()
  const activeBoosts = useBoosts()
  const activateBoost = useGameStore((s) => s.activateBoost)
  const [now, setNow] = useState(Date.now())
  const [promptDeficit, setPromptDeficit] = useState<number | null>(null)

  // Обновляем таймер каждую секунду
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const getStatus = useCallback((type: BoostType): 'can_buy' | 'active' | 'blocked_conflict' | 'blocked_nuts' => {
    const activeBoost = activeBoosts.find(b => b.type === type && b.expiresAt > now)
    if (activeBoost) return 'active'

    const conflictGroup = BOOST_CONFLICT_GROUPS.find(g => g.includes(type))
    if (conflictGroup) {
      const conflictActive = activeBoosts.some(b => conflictGroup.includes(b.type) && b.type !== type && b.expiresAt > now)
      if (conflictActive) return 'blocked_conflict'
    }

    if (nuts < BOOST_DEFINITIONS[type].costNuts) return 'blocked_nuts'
    return 'can_buy'
  }, [activeBoosts, nuts, now])

  const handleBoostClick = useCallback((type: BoostType) => {
    const status = getStatus(type)
    if (status === 'blocked_nuts') {
      const deficit = BOOST_DEFINITIONS[type].costNuts - nuts
      setPromptDeficit(deficit)
      return
    }
    if (status === 'can_buy') {
      activateBoost(type)
    }
  }, [getStatus, activateBoost, nuts])

  return (
    <>
      <div className="px-2 py-1 bg-gray-900/80 border-t border-gray-700">
        <div className="flex gap-1 justify-center">
          {BOOST_ORDER.map(type => {
            const def = BOOST_DEFINITIONS[type]
            const status = getStatus(type)
            const activeBoost = activeBoosts.find(b => b.type === type && b.expiresAt > now)
            const remaining = activeBoost ? activeBoost.expiresAt - now : 0
            const deficit = def.costNuts - nuts

            return (
              <button
                key={type}
                onClick={() => handleBoostClick(type)}
                disabled={status === 'active' || status === 'blocked_conflict'}
                className={[
                  'flex-1 rounded px-1 py-1.5 text-center transition-colors min-h-[44px]',
                  'font-mono text-[7px] leading-tight flex flex-col items-center justify-center gap-0.5',
                  status === 'active'            && 'bg-green-800/80 border border-green-500 cursor-default',
                  status === 'can_buy'           && 'bg-garage-yellow/20 border border-garage-yellow/60 hover:bg-garage-yellow/30 cursor-pointer',
                  status === 'blocked_conflict'  && 'bg-gray-800/60 border border-gray-600 cursor-default opacity-50',
                  status === 'blocked_nuts'      && 'bg-gray-800/60 border border-gray-600 cursor-pointer',
                ].filter(Boolean).join(' ')}
              >
                {status === 'active' ? (
                  <>
                    <span className="text-green-400">⚡ {def.label.toUpperCase()}</span>
                    <span className="text-green-300">⏱ {formatTime(remaining)}</span>
                  </>
                ) : (
                  <>
                    <span className={status === 'blocked_nuts' ? 'text-gray-400' : 'text-garage-yellow'}>
                      {def.label}
                    </span>
                    <span className={status === 'blocked_nuts' ? 'text-red-400' : 'text-gray-300'}>
                      {status === 'blocked_nuts' ? `-${deficit} 🔩` : `${def.costNuts} 🔩`}
                    </span>
                    {status === 'blocked_conflict' && (
                      <span className="text-gray-500">Уже активен</span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {promptDeficit !== null && (
        <NutsPromptModal
          isOpen
          deficit={promptDeficit}
          onClose={() => setPromptDeficit(null)}
        />
      )}
    </>
  )
}

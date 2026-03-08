// src/components/BoostModal.tsx
// Модалка «БУСТЫ» с тремя карточками. Открывается по BoostButton.
// Состояния карточки: active (таймер), can_buy, locked, blocked (другой активен — с заменой), blocked_nuts.

import { useState, useEffect, useCallback } from 'react'
import {
  useGameStore, useNuts, useBoosts, useMilestonesPurchased,
  BOOST_DEFINITIONS,
} from '../store/gameStore'
import type { BoostType } from '../store/gameStore'
import NutsPromptModal from './NutsPromptModal'

interface BoostModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BOOST_ORDER: BoostType[] = ['turbo', 'income_2x', 'income_3x']

// Визуальные темы для карточек по референсу
const BOOST_THEMES: Record<BoostType, {
  cardBg: string
  iconBg: string
  icon: string
  btnGradient: string
  timerColor: string
}> = {
  income_2x: {
    cardBg: 'bg-gradient-to-br from-orange-950/80 to-amber-950/60 border-orange-700/60',
    iconBg: 'bg-orange-600',
    icon: '⚡',
    btnGradient: 'from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400',
    timerColor: 'text-amber-300',
  },
  income_3x: {
    cardBg: 'bg-gradient-to-br from-red-950/80 to-rose-950/60 border-red-700/60',
    iconBg: 'bg-red-700',
    icon: '⚡',
    btnGradient: 'from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500',
    timerColor: 'text-red-300',
  },
  turbo: {
    cardBg: 'bg-gradient-to-br from-purple-950/80 to-violet-950/60 border-purple-700/60',
    iconBg: 'bg-purple-700',
    icon: '✦',
    btnGradient: 'from-purple-700 to-violet-600 hover:from-purple-600 hover:to-violet-500',
    timerColor: 'text-purple-300',
  },
}

export default function BoostModal({ isOpen, onClose }: BoostModalProps) {
  const nuts = useNuts()
  const activeBoosts = useBoosts()
  const milestonesPurchased = useMilestonesPurchased()
  const activateBoost = useGameStore(s => s.activateBoost)
  const replaceBoost = useGameStore(s => s.replaceBoost)

  const [now, setNow] = useState(() => Date.now())
  const [confirmType, setConfirmType] = useState<BoostType | null>(null)  // pending replace
  const [nutsDeficit, setNutsDeficit] = useState<number | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const getStatus = useCallback((type: BoostType) => {
    const def = BOOST_DEFINITIONS[type]
    const isThisActive = activeBoosts.some(b => b.type === type && b.expiresAt > now)
    if (isThisActive) return 'active' as const

    const isLocked = def.unlockLevel > 0 && !milestonesPurchased.includes(def.unlockLevel)
    if (isLocked) return 'locked' as const

    const hasOtherActive = activeBoosts.some(b => b.type !== type && b.expiresAt > now)
    if (hasOtherActive) return 'blocked' as const  // can replace with confirmation

    if (nuts < def.costNuts) return 'blocked_nuts' as const
    return 'can_buy' as const
  }, [activeBoosts, milestonesPurchased, nuts, now])

  const handleBuyClick = useCallback((type: BoostType) => {
    const status = getStatus(type)
    if (status === 'active' || status === 'locked') return

    if (status === 'blocked_nuts') {
      setNutsDeficit(BOOST_DEFINITIONS[type].costNuts - nuts)
      return
    }

    if (status === 'blocked') {
      setConfirmType(type)   // показать подтверждение замены
      return
    }

    if (status === 'can_buy') {
      activateBoost(type)
    }
  }, [getStatus, activateBoost, nuts])

  const handleConfirmReplace = useCallback(() => {
    if (!confirmType) return
    replaceBoost(confirmType)
    setConfirmType(null)
  }, [confirmType, replaceBoost])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-4 mx-3 w-full max-w-sm font-mono shadow-2xl shadow-orange-900/30">

          {/* Крестик */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none p-1"
            aria-label="Закрыть"
          >
            ×
          </button>

          {/* Заголовок */}
          <div className="text-center mb-4">
            <h2 className="text-garage-yellow text-sm font-bold tracking-widest">
              🚀 БУСТЫ
            </h2>
            <p className="text-gray-500 text-[9px] mt-1 tracking-wide">
              Временные усиления за гайки
            </p>
          </div>

          {/* Диалог подтверждения замены */}
          {confirmType && (
            <div className="mb-3 p-3 bg-orange-950/60 border border-orange-600/50 rounded-lg text-center">
              <p className="text-orange-300 text-[9px] mb-2">
                Заменить активный буст?<br/>
                <span className="text-gray-400">Оставшееся время будет потеряно</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmType(null)}
                  className="flex-1 py-1.5 bg-gray-800 text-gray-300 text-[9px] font-bold rounded"
                >
                  ОТМЕНА
                </button>
                <button
                  onClick={handleConfirmReplace}
                  className="flex-1 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-[9px] font-bold rounded"
                >
                  ЗАМЕНИТЬ
                </button>
              </div>
            </div>
          )}

          {/* Карточки бустов */}
          <div className="flex flex-col gap-2">
            {BOOST_ORDER.map(type => {
              const def = BOOST_DEFINITIONS[type]
              const theme = BOOST_THEMES[type]
              const status = getStatus(type)
              const activeBoost = activeBoosts.find(b => b.type === type && b.expiresAt > now)
              const remaining = activeBoost ? activeBoost.expiresAt - now : 0
              const durationLabel = type === 'income_2x' ? '60 мин' : type === 'income_3x' ? '30 мин' : '15 мин'

              return (
                <div
                  key={type}
                  className={`rounded-lg border p-3 ${theme.cardBg} ${status === 'locked' ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {/* Иконка */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0 ${theme.iconBg}`}>
                      {theme.icon}
                    </div>

                    {/* Название + описание */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${status === 'active' ? theme.timerColor : 'text-white'}`}>
                          {def.label}
                        </span>
                        <span className="text-cyan-400 text-xs font-bold">
                          {def.costNuts} 🔩
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-gray-400 text-[9px]">{def.description}</span>
                        <span className="text-gray-500 text-[9px]">⏱ {durationLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Кнопка / таймер */}
                  {status === 'active' ? (
                    <div className={`w-full py-2 rounded text-center text-[10px] font-bold ${theme.timerColor} bg-black/30`}>
                      ⏱ АКТИВЕН — {formatTime(remaining)}
                    </div>
                  ) : status === 'locked' ? (
                    <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30">
                      🔒 УРОВЕНЬ {def.unlockLevel}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyClick(type)}
                      className={`w-full py-2 rounded text-[10px] font-bold text-white bg-gradient-to-r transition-colors ${theme.btnGradient} ${
                        status === 'blocked_nuts' ? 'opacity-60' : ''
                      }`}
                    >
                      {status === 'blocked_nuts'
                        ? `КУПИТЬ — не хватает ${def.costNuts - nuts} 🔩`
                        : status === 'blocked'
                        ? 'ЗАМЕНИТЬ'
                        : 'КУПИТЬ'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {nutsDeficit !== null && (
        <NutsPromptModal
          isOpen
          deficit={nutsDeficit}
          onClose={() => setNutsDeficit(null)}
        />
      )}
    </>
  )
}

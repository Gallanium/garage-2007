// src/components/ReferralBonusesModal.tsx
// Модалка «Бонусы за друзей» — показывает milestone-награды реферальной программы.

import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Lock, Hexagon } from 'lucide-react'
import { REFERRAL_MILESTONES, getNextMilestone } from '@shared/constants/referrals'
import { useAudio } from '../contexts/AudioContext'

interface ReferralBonusesModalProps {
  isOpen: boolean
  onClose: () => void
  activeReferrals: number
  claimedMilestones: number[]
}

const ReferralBonusesModal: React.FC<ReferralBonusesModalProps> = ({
  isOpen,
  onClose,
  activeReferrals,
  claimedMilestones,
}) => {
  const { playSound } = useAudio()

  useEffect(() => {
    if (isOpen) playSound('modal_open', 'ReferralBonusesModal')
  }, [isOpen, playSound])

  const handleClose = useCallback(() => {
    playSound('modal_close', 'ReferralBonusesModal')
    onClose()
  }, [onClose, playSound])

  if (!isOpen) return null

  const nextMilestone = getNextMilestone(activeReferrals)

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center animate-[fadeIn_300ms_ease-out]"
      onClick={handleClose}
    >
      <div
        className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-4 mx-3 w-full max-w-sm shadow-2xl shadow-orange-900/30 animate-[slideUp_400ms_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          &times;
        </button>

        {/* Header */}
        <h2 className="text-garage-yellow text-sm font-bold tracking-widest font-mono text-center mb-1">
          Бонусы за друзей
        </h2>
        <p className="text-gray-400 text-[7px] font-mono text-center mb-4">
          Награда начисляется автоматически
        </p>

        {/* Milestone rows */}
        <div className="flex flex-col gap-2">
          {REFERRAL_MILESTONES.map(milestone => {
            const isClaimed = claimedMilestones.includes(milestone.count)
            const isActive = !isClaimed && nextMilestone?.count === milestone.count
            const isLocked = !isClaimed && !isActive

            return (
              <div
                key={milestone.count}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  isClaimed
                    ? 'bg-green-950/30 border border-green-800/30'
                    : isActive
                    ? 'bg-amber-950/30 border border-amber-700/40'
                    : 'bg-gray-900/50 border border-gray-800/30 opacity-40'
                }`}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {isClaimed && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                  )}
                  {isLocked && <Lock className="w-3 h-3 text-gray-600" />}
                </div>

                {/* Count */}
                <span className={`text-[9px] font-bold font-mono ${
                  isClaimed ? 'text-green-400' : isActive ? 'text-garage-yellow' : 'text-gray-500'
                }`}>
                  {milestone.count} друзей
                </span>

                {/* Reward */}
                <span className={`ml-auto flex items-center gap-1 text-[9px] font-bold font-mono ${
                  isClaimed ? 'text-green-400' : isActive ? 'text-garage-yellow' : 'text-gray-500'
                }`}>
                  +{milestone.reward}
                  <Hexagon className="w-2.5 h-2.5 inline-block" />
                </span>
              </div>
            )
          })}
        </div>

        {/* Progress bar for active milestone */}
        {nextMilestone && (
          <div className="mt-3">
            <div className="flex justify-between text-[7px] font-mono text-gray-400 mb-1">
              <span>{activeReferrals} / {nextMilestone.count}</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                style={{ width: `${Math.min((activeReferrals / nextMilestone.count) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Helper text */}
        <p className="text-gray-400 text-[6px] font-mono text-center mt-4">
          Друг засчитывается на 2-м уровне гаража
        </p>
      </div>
    </div>,
    document.body,
  )
}

export default ReferralBonusesModal

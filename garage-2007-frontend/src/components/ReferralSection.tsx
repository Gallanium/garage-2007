// src/components/ReferralSection.tsx
// Компактная карточка реферальной программы для StatsPanel.

import { useState, useEffect, useCallback } from 'react'
import { Users, Share2, Hexagon, ChevronRight } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { useAudio } from '../contexts/AudioContext'
import { REFERRAL_MILESTONES } from '@shared/constants/referrals'
import ReferralBonusesModal from './ReferralBonusesModal'

const SHARE_TEXT = `Гараж не резиновый, но для тебя место найдётся.\nЗалетай и получай +10 \u{1F529} на старте!`
const BOT_NAME = 'Garage2007Bot' // placeholder — заменить на реального бота

export const ReferralSection: React.FC = () => {
  const { playSound } = useAudio()
  const referralStatus = useGameStore(s => s.referralStatus)
  const referralLoading = useGameStore(s => s.referralLoading)
  const fetchReferralStatus = useGameStore(s => s.fetchReferralStatus)
  const generateReferralCode = useGameStore(s => s.generateReferralCode)

  const [bonusesOpen, setBonusesOpen] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    fetchReferralStatus()
  }, [fetchReferralStatus])

  const handleShare = useCallback(async () => {
    if (sharing) return
    setSharing(true)
    try {
      let code = referralStatus?.referralCode
      if (!code) {
        code = await generateReferralCode() ?? undefined
      }
      if (!code) {
        setSharing(false)
        return
      }

      playSound('tab_switch', 'ReferralSection')

      const url = `https://t.me/${BOT_NAME}?startapp=ref_${code}`
      const text = `${SHARE_TEXT}\n${url}`

      if (navigator.share) {
        await navigator.share({ text }).catch(() => {
          // user cancelled share — not an error
        })
      } else {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(SHARE_TEXT)}`, '_blank')
      }
    } finally {
      setSharing(false)
    }
  }, [sharing, referralStatus?.referralCode, generateReferralCode, playSound])

  const handleOpenBonuses = useCallback(() => {
    setBonusesOpen(true)
  }, [])

  const handleCloseBonuses = useCallback(() => {
    setBonusesOpen(false)
  }, [])

  const activeReferrals = referralStatus?.activeReferrals ?? 0
  const totalEarned = referralStatus?.totalEarned ?? 0
  const claimedMilestones = referralStatus?.claimedMilestones ?? []
  const code = referralStatus?.referralCode ?? null

  const claimedCount = claimedMilestones.length
  const totalMilestones = REFERRAL_MILESTONES.length

  if (referralLoading && !referralStatus) {
    return (
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
        <p className="text-[8px] text-gray-500 font-mono text-center">Загрузка...</p>
      </section>
    )
  }

  return (
    <>
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 overflow-hidden">

        {/* Top row — icon, text, button */}
        <div className="flex items-center gap-3 p-3">
          {/* Left icon */}
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-700 to-orange-900 flex items-center justify-center flex-shrink-0 text-white">
            <Users className="w-5 h-5" />
          </div>

          {/* Center text */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-garage-yellow font-mono">
              Пригласи друзей
            </p>
            <p className="text-[8px] text-gray-300 font-mono flex items-center gap-0.5 flex-wrap">
              +15{' '}<Hexagon className="w-2 h-2 inline-block text-orange-400" />{' '}тебе
              {' '}&middot;{' '}
              +10{' '}<Hexagon className="w-2 h-2 inline-block text-orange-400" />{' '}другу
            </p>
          </div>

          {/* Right button */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="bg-gradient-to-r from-orange-600 to-amber-500 text-white text-[7px] font-bold font-mono
                       rounded py-2 px-3 flex items-center gap-1 flex-shrink-0
                       active:scale-95 transition-all disabled:opacity-50"
          >
            <Share2 className="w-3 h-3" />
            Пригласить
          </button>
        </div>

        {/* Bottom row — 4 metric cells */}
        <div className="bg-black/20 rounded-lg overflow-hidden flex mx-3 mb-3">
          {/* Код */}
          <div className="flex-1 py-2 px-2 text-center border-r border-white/5">
            <p className="text-gray-400 text-[5px] uppercase font-mono tracking-wider">Код</p>
            <p className="text-garage-yellow text-[9px] font-bold font-mono tracking-wider mt-0.5">
              {code ?? '—'}
            </p>
          </div>

          {/* Друзей */}
          <div className="flex-1 py-2 px-2 text-center border-r border-white/5">
            <p className="text-gray-400 text-[5px] uppercase font-mono tracking-wider">Друзей</p>
            <p className="text-white text-[9px] font-bold font-mono mt-0.5">
              {activeReferrals}
            </p>
          </div>

          {/* Получено */}
          <div className="flex-1 py-2 px-2 text-center border-r border-white/5">
            <p className="text-gray-400 text-[5px] uppercase font-mono tracking-wider">Получено</p>
            <p className="text-white text-[9px] font-bold font-mono mt-0.5 flex items-center justify-center gap-0.5">
              {totalEarned}
              <Hexagon className="w-2 h-2 inline-block text-orange-400" />
            </p>
          </div>

          {/* Бонусы */}
          <button
            onClick={handleOpenBonuses}
            className="flex-1 py-2 px-2 text-center active:scale-95 transition-all hover:bg-white/5"
          >
            <p className="text-gray-400 text-[5px] uppercase font-mono tracking-wider">Бонусы</p>
            <p className="text-garage-yellow text-[9px] font-bold font-mono mt-0.5 flex items-center justify-center gap-0.5">
              {claimedCount}/{totalMilestones}
              <ChevronRight className="w-2 h-2 opacity-40" />
            </p>
          </button>
        </div>
      </section>

      {/* Bonuses modal */}
      <ReferralBonusesModal
        isOpen={bonusesOpen}
        onClose={handleCloseBonuses}
        activeReferrals={activeReferrals}
        claimedMilestones={claimedMilestones}
      />
    </>
  )
}

export default ReferralSection

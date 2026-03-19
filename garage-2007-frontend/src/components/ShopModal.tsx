import { useState, useCallback } from 'react'
import type { NutsPackId } from '@shared/types/purchase.js'
import { NUTS_PACKS, NUTS_PACK_ORDER } from '@shared/constants/purchase.js'
import * as api from '../services/apiService'
import { useGameStore } from '../store/gameStore'
import { openTelegramInvoice } from '../hooks/useTelegram'
import { useTelegramHaptic } from '../hooks/useTelegram'
import NutsPackCard from './NutsPackCard'

interface ShopModalProps {
  isOpen: boolean
  onClose: () => void
}

interface PurchaseResult {
  success: boolean
  message: string
}

export default function ShopModal({ isOpen, onClose }: ShopModalProps) {
  const [purchasingPackId, setPurchasingPackId] = useState<NutsPackId | null>(null)
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null)
  const applyServerState = useGameStore(s => s.applyServerState)
  const haptic = useTelegramHaptic()

  const handlePurchase = useCallback(async (packId: NutsPackId) => {
    setPurchasingPackId(packId)
    setPurchaseResult(null)

    const invoiceUrl = await api.createInvoice(packId)
    if (!invoiceUrl) {
      setPurchasingPackId(null)
      setPurchaseResult({ success: false, message: 'Ошибка создания счёта' })
      haptic.notificationError()
      return
    }

    const status = await openTelegramInvoice(invoiceUrl)

    if (status === 'paid') {
      setPurchaseResult({ success: true, message: 'Гайки зачислены!' })
      haptic.notificationSuccess()
      // Reload state from server to get updated nuts balance
      const serverState = await api.loadState()
      if (serverState?.gameState) {
        applyServerState(serverState.gameState)
      }
      setTimeout(() => setPurchaseResult(null), 3000)
    } else if (status === 'failed') {
      setPurchaseResult({ success: false, message: 'Ошибка оплаты' })
      haptic.notificationError()
    }
    // 'cancelled' / 'pending' / null — just reset

    setPurchasingPackId(null)
  }, [applyServerState, haptic])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_300ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative bg-gray-950 border-2 border-orange-700/70 rounded-xl p-4 mx-3 w-full max-w-sm font-mono shadow-2xl shadow-orange-900/30 animate-[slideUp_400ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none p-1"
          aria-label="Закрыть"
        >
          ×
        </button>

        {/* Header */}
        <div className="text-center mb-4 animate-[fadeIn_300ms_ease-out]">
          <h2 className="text-garage-yellow text-sm font-bold tracking-widest">
            МАГАЗИН ГАЕК
          </h2>
          <p className="text-gray-500 text-[9px] mt-1 tracking-wide">
            Купи гайки за Telegram Stars
          </p>
        </div>

        {/* Purchase result banner */}
        {purchaseResult && (
          <div className={`mb-3 p-2 rounded-lg text-center text-[10px] font-bold animate-[slideUp_200ms_ease-out] ${
            purchaseResult.success
              ? 'bg-green-900/50 border border-green-600/50 text-green-300'
              : 'bg-red-900/50 border border-red-600/50 text-red-300'
          }`}>
            {purchaseResult.success ? '✅' : '❌'} {purchaseResult.message}
          </div>
        )}

        {/* Pack cards */}
        <div className="flex flex-col gap-2">
          {NUTS_PACK_ORDER.map((packId, index) => (
            <NutsPackCard
              key={packId}
              packId={packId}
              pack={NUTS_PACKS[packId]}
              isPurchasing={purchasingPackId === packId}
              onPurchase={handlePurchase}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

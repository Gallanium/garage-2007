import { useState, useEffect } from 'react'
import { useGameStore, useIsLoaded, useLastOfflineEarnings, useLastOfflineTimeAway } from '../store/gameStore'

/** Минимальное время оффлайна для показа модалки (секунды) */
const MIN_OFFLINE_FOR_MODAL = 60

/** Задержка перед показом модалки для плавности (мс) */
const MODAL_SHOW_DELAY_MS = 500

interface UseOfflineEarningsReturn {
  showWelcomeBack: boolean
  offlineEarnings: number
  offlineTime: number
  handleWelcomeBackClose: () => void
}

/**
 * Хук управляет логикой модалки Welcome Back:
 * - Показывает модалку если оффлайн > 60 сек и доход > 0
 * - Начисляет оффлайн-доход при закрытии
 */
export function useOfflineEarnings(): UseOfflineEarningsReturn {
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)

  const isLoaded = useIsLoaded()
  const offlineEarnings = useLastOfflineEarnings()
  const offlineTime = useLastOfflineTimeAway()
  const addOfflineEarnings = useGameStore((s) => s.addOfflineEarnings)
  const clearOfflineEarnings = useGameStore((s) => s.clearOfflineEarnings)

  useEffect(() => {
    if (!isLoaded) return
    if (offlineEarnings <= 0) return
    if (offlineTime < MIN_OFFLINE_FOR_MODAL) return

    const timer = setTimeout(() => {
      setShowWelcomeBack(true)
    }, MODAL_SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [isLoaded, offlineEarnings, offlineTime])

  const handleWelcomeBackClose = () => {
    if (offlineEarnings > 0) {
      addOfflineEarnings(offlineEarnings)
    }
    setShowWelcomeBack(false)
    clearOfflineEarnings()
  }

  return {
    showWelcomeBack,
    offlineEarnings,
    offlineTime,
    handleWelcomeBackClose,
  }
}

import { useEffect, useRef } from 'react'
import {
  useGameStore,
  useIsLoaded,
  useGarageLevel,
  useBalance,
  useCheckForMilestone,
} from '../store/gameStore'

/** Интервал автосохранения в миллисекундах (30 секунд) */
const AUTO_SAVE_INTERVAL_MS = 30_000

/**
 * Минимальный интервал между сохранениями при изменении данных (мс).
 * Предотвращает спам localStorage при каждом тике пассивного дохода.
 */
const SAVE_DEBOUNCE_MS = 5_000

/**
 * Хук управляет жизненным циклом игры:
 * - Загрузка прогресса при монтировании
 * - Запуск пассивного дохода
 * - Автосохранение каждые 30 секунд
 * - Debounced сохранение при изменении баланса/уровня
 * - Сохранение при закрытии вкладки (beforeunload)
 * - Проверка milestone-апгрейдов при смене уровня
 */
export function useGameLifecycle(): void {
  const isLoaded = useIsLoaded()
  const balance = useBalance()
  const garageLevel = useGarageLevel()
  const checkForMilestone = useCheckForMilestone()
  const loadProgress = useGameStore((s) => s.loadProgress)
  const saveProgress = useGameStore((s) => s.saveProgress)
  const startPassiveIncome = useGameStore((s) => s.startPassiveIncome)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. Загрузка прогресса при монтировании
  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  // 2. Запуск пассивного дохода
  useEffect(() => {
    const cleanup = startPassiveIncome()
    return cleanup
  }, [startPassiveIncome])

  // 3. Автосохранение каждые 30 секунд
  useEffect(() => {
    if (!isLoaded) return

    const saveInterval = setInterval(() => {
      saveProgress()
    }, AUTO_SAVE_INTERVAL_MS)

    return () => clearInterval(saveInterval)
  }, [isLoaded, saveProgress])

  // 4. Debounced сохранение при изменении баланса/уровня
  useEffect(() => {
    if (!isLoaded) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      saveProgress()
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [balance, garageLevel, isLoaded, saveProgress])

  // 5. Проверка milestone при смене уровня
  useEffect(() => {
    if (!isLoaded) return
    checkForMilestone()
  }, [garageLevel, isLoaded, checkForMilestone])

  // 6. Сохранение при закрытии вкладки
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveProgress()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [saveProgress])
}

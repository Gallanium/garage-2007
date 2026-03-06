import { useState, useEffect, useRef } from 'react'
import {
  useGameStore,
  useBalance,
  useClickValue,
  useGarageLevel,
  usePassiveIncome,
  useMomentaryClickIncome,
  useNuts,
  useIsLoaded,
  useLastOfflineEarnings,
  useLastOfflineTimeAway,
  useNextLevelCost,
  useGarageProgress,
  useShowMilestoneModal,
  usePendingMilestoneLevel,
  usePurchaseMilestone,
  useCloseMilestoneModal,
  useCheckForMilestone,
  usePendingMilestoneInfo,
  GARAGE_LEVEL_NAMES,
  MILESTONE_UPGRADES,
  DAILY_STREAK_GRACE_PERIOD_MS,
  formatLargeNumber,
  type MilestoneLevel,
} from './store/gameStore'
import PhaserGame from './game/PhaserGame'
import TabNavigation from './components/TabNavigation'
import UpgradesPanel from './components/UpgradesPanel'
import AchievementsPanel from './components/AchievementsPanel'
import StatsPanel from './components/StatsPanel'
import WelcomeBackModal from './components/WelcomeBackModal'
import MilestoneUpgradeModal from './components/MilestoneUpgradeModal'
import DailyRewardsModal from './components/DailyRewardsModal'
import DailyRewardButton from './components/DailyRewardButton'

// ============================================
// КОНСТАНТЫ
// ============================================

/** Конфигурация табов навигации */
const tabs = [
  { id: 'game', label: 'Игра', icon: '🏠' },
  { id: 'upgrades', label: 'Улучшения', icon: '⬆️' },
  { id: 'achievements', label: 'Ачивки', icon: '🏆' },
  { id: 'stats', label: 'Статистика', icon: '📊' },
]

/** Интервал автосохранения в миллисекундах (30 секунд) */
const AUTO_SAVE_INTERVAL_MS = 30_000

/**
 * Минимальный интервал между сохранениями при изменении данных (мс).
 * Предотвращает спам localStorage при каждом тике пассивного дохода.
 */
const SAVE_DEBOUNCE_MS = 5_000

/** Минимальное время оффлайна для показа модалки (секунды) */
const MIN_OFFLINE_FOR_MODAL = 60

/** Задержка перед показом модалки для плавности (мс) */
const MODAL_SHOW_DELAY_MS = 500

/** Названия уровней гаража импортируются из gameStore (GARAGE_LEVEL_NAMES) */

// ============================================
// КОМПОНЕНТ
// ============================================

function App() {
  // --- Debug: доступ к store из консоли браузера (только dev) ---
  if (import.meta.env.DEV) {
    ;(window as Window & { __store: typeof useGameStore }).__store = useGameStore
  }

  // --- Локальное состояние ---
  const [activeTab, setActiveTab] = useState<string>('game')
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)

  // --- Данные из store (оптимизированные селекторы) ---
  const balance = useBalance()
  const clickValue = useClickValue()
  const garageLevel = useGarageLevel()
  const passiveIncomePerSecond = usePassiveIncome()
  const momentaryClickIncome = useMomentaryClickIncome()
  const nuts = useNuts()
  const isLoaded = useIsLoaded()
  const offlineEarnings = useLastOfflineEarnings()
  const offlineTime = useLastOfflineTimeAway()
  const nextLevelCost = useNextLevelCost()
  const garageProgress = useGarageProgress()
  const showMilestoneModal = useShowMilestoneModal()
  const pendingMilestoneLevel = usePendingMilestoneLevel()
  const purchaseMilestone = usePurchaseMilestone()
  const closeMilestoneModal = useCloseMilestoneModal()
  const checkForMilestone = useCheckForMilestone()
  const milestoneInfo = usePendingMilestoneInfo()

  // --- Действия из store ---
  const handleClick = useGameStore((s) => s.handleClick)
  const resetGame = useGameStore((s) => s.resetGame)
  const startPassiveIncome = useGameStore((s) => s.startPassiveIncome)
  const loadProgress = useGameStore((s) => s.loadProgress)
  const saveProgress = useGameStore((s) => s.saveProgress)
  const clearOfflineEarnings = useGameStore((s) => s.clearOfflineEarnings)
  const addOfflineEarnings = useGameStore((s) => s.addOfflineEarnings)
  const showDailyRewardsModal = useGameStore((s) => s.showDailyRewardsModal)
  const dailyRewards = useGameStore((s) => s.dailyRewards)
  const claimDailyReward = useGameStore((s) => s.claimDailyReward)
  const closeDailyRewardsModal = useGameStore((s) => s.closeDailyRewardsModal)
  const openDailyRewardsModal = useGameStore((s) => s.openDailyRewardsModal)

  // --- Вычисление доступности ежедневной награды ---
  const canClaimToday = dailyRewards.lastClaimTimestamp === 0
    || (Date.now() - dailyRewards.lastClaimTimestamp) >= DAILY_STREAK_GRACE_PERIOD_MS

  // --- Ref для debounce сохранения при изменении данных ---
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ============================================
  // ЭФФЕКТЫ (все хуки ДО условных рендеров — правила React)
  // ============================================

  /**
   * 1. Загрузка прогресса при монтировании.
   *    loadProgress вычисляет оффлайн-доход и сохраняет его в store
   *    (lastOfflineEarnings / lastOfflineTimeAway).
   */
  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  /**
   * 1b. Показ модалки Welcome Back после загрузки.
   *     Читаем данные оффлайн-дохода из store (заполняются в loadProgress).
   *     Показываем модалку если время отсутствия > 60 сек И доход > 0.
   */
  useEffect(() => {
    if (!isLoaded) return
    if (offlineEarnings <= 0) return
    if (offlineTime < MIN_OFFLINE_FOR_MODAL) return

    const timer = setTimeout(() => {
      setShowWelcomeBack(true)
    }, MODAL_SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [isLoaded, offlineEarnings, offlineTime])

  /**
   * 2. Запуск пассивного дохода при монтировании.
   *    Возвращает cleanup для clearInterval.
   *
   *    Примечание: безопасно вызывать до loadProgress —
   *    setInterval создаёт первый тик через 1 сек, а loadProgress
   *    синхронен, поэтому стейт уже загружен к моменту первого тика.
   */
  useEffect(() => {
    const cleanup = startPassiveIncome()
    return cleanup
  }, [startPassiveIncome])

  /**
   * 3. Автосохранение каждые 30 секунд.
   *    Работает только после завершения загрузки.
   */
  useEffect(() => {
    if (!isLoaded) return

    const saveInterval = setInterval(() => {
      saveProgress()
    }, AUTO_SAVE_INTERVAL_MS)

    return () => clearInterval(saveInterval)
  }, [isLoaded, saveProgress])

  /**
   * 4. Сохранение при изменении критичных данных (debounced).
   *
   *    Триггеры: balance, garageLevel.
   *    Debounce 5 сек — предотвращает спам при каждом тике
   *    пассивного дохода (1 раз/сек), при этом гарантирует
   *    запись после серии быстрых кликов.
   */
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

  /**
   * 4b. Проверка milestone-апгрейдов при смене уровня гаража.
   *     Когда garageLevel достигает 5/10/15/20 — показываем модалку
   *     (если milestone ещё не куплен). Без этого эффекта модалка
   *     появлялась бы только при загрузке сохранения (loadProgress).
   */
  useEffect(() => {
    if (!isLoaded) return
    checkForMilestone()
  }, [garageLevel, isLoaded, checkForMilestone])

  /**
   * 5. Сохранение при закрытии вкладки / браузера.
   *    Использует событие beforeunload.
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveProgress()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [saveProgress])

  // ============================================
  // ОБРАБОТЧИКИ
  // ============================================

  /** Закрытие модалки Welcome Back — начисляем оффлайн-доход при нажатии «Забрать» */
  const handleWelcomeBackClose = () => {
    if (offlineEarnings > 0) {
      addOfflineEarnings(offlineEarnings)
    }
    setShowWelcomeBack(false)
    clearOfflineEarnings()
  }

  // ============================================
  // ЭКРАН ЗАГРУЗКИ
  // ============================================

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-800 to-gray-900 gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-garage-yellow font-mono drop-shadow-lg">
          ГАРАЖ 2007
        </h1>
        <p className="text-xs sm:text-sm text-gray-300 font-mono animate-pulse">
          Загрузка...
        </p>
      </div>
    )
  }

  // ============================================
  // ОСНОВНОЙ РЕНДЕР
  // ============================================

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-800 via-garage-metal to-gray-900 text-white overflow-y-auto">

      {/* ========== ВЕРХНЯЯ ПАНЕЛЬ (Header) ========== */}
      {/* FIX Баг 2: relative + absolute для заголовка — он всегда в центре,
          не зависит от ширины баланса/гаек */}
      <header className="relative p-3 bg-gray-900/80 backdrop-blur-sm border-b-2 border-garage-rust shadow-lg z-10">

        {/* Центр: Название игры — абсолютно позиционирован, всегда в центре */}
        <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
          <div className="text-center">
            <h1 className="text-sm font-bold text-garage-yellow drop-shadow-lg font-mono">
              ГАРАЖ 2007
            </h1>
            <p className="text-[8px] text-gray-400">v0.1.0-MVP</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          {/* Левая часть: Баланс */}
          <div className="flex flex-col">
            <span className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-mono">Баланс</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-garage-yellow font-mono tabular-nums tracking-tight">
                {formatLargeNumber(balance)}
              </span>
              <span className="text-sm sm:text-base text-garage-yellow/70 font-mono">₽</span>
            </div>
          </div>

          {/* Правая часть: Гайки (premium валюта) */}
          <div className="flex flex-col items-end">
            <span className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-mono">Гайки</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-bold text-orange-400 font-mono tabular-nums">
                {formatLargeNumber(nuts)}
              </span>
              <span className="text-base">🔩</span>
            </div>
          </div>
        </div>

      </header>

      {/* ========== НАВИГАЦИЯ ТАБОВ ========== */}
      <div className="px-2 sm:px-4 pt-2 bg-gray-900/60">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />
      </div>

      {/* ========== КОНТЕНТ: табы стекаются через absolute + visibility ========== */}
      {/* visibility:hidden вместо display:none — Phaser канвас остаётся в layout tree,
          нет reflow/repaint при переключении → мгновенное появление гаража. */}
      <div className="relative flex-1 min-h-0">

      <div
        className={`absolute inset-0 flex flex-col ${activeTab === 'game' ? 'visible' : 'invisible pointer-events-none'}`}
      >
          {/* Phaser Game (60% высоты) */}
          {/* flex-1 + min-h-0: canvas занимает доступное пространство, не выталкивая footer */}
          <main className="flex-1 min-h-0 relative bg-gradient-to-b from-gray-800 to-gray-900">

            <div className="w-full h-full flex items-center justify-center">
              <PhaserGame
                onGarageClick={handleClick}
                garageLevel={garageLevel}
                isActive={activeTab === 'game' && !showWelcomeBack && !showMilestoneModal && !showDailyRewardsModal}
              />
            </div>

            {/* Кнопка ежедневных наград */}
            <DailyRewardButton
              streak={dailyRewards.currentStreak}
              canClaim={canClaimToday}
              onClick={openDailyRewardsModal}
            />

            {/* Оверлей: подсказка клика */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2
                            bg-garage-yellow/20 backdrop-blur-sm rounded-full px-3 py-2
                            border border-garage-yellow/50 animate-pulse">
              <p className="text-[10px] sm:text-xs text-garage-yellow font-mono text-center">
                👆 Кликни по гаражу
              </p>
            </div>

          </main>

          {/* Нижняя панель: Статистика */}
          {/* flex-shrink-0: footer не сжимается, всегда виден полностью */}
          <footer className="flex-shrink-0 bg-gray-900/90 backdrop-blur-sm border-t-2 border-garage-rust shadow-2xl">

            <div className="grid grid-cols-3 gap-1.5 p-3">

              {/* Доход за клик */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-2 border border-garage-yellow/30 shadow-md">
                <p className="text-[8px] sm:text-[10px] text-gray-400 mb-1 font-mono uppercase">За клик</p>
                <div className="flex items-baseline gap-0.5">
                  <p className="text-base sm:text-lg font-bold text-garage-yellow font-mono">
                    {formatLargeNumber(clickValue)}
                  </p>
                  <span className="text-[9px] sm:text-[11px] text-garage-yellow/70 font-mono">₽</span>
                </div>
              </div>

              {/* Моментальный доход от кликов */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-2 border border-blue-400/30 shadow-md">
                <p className="text-[8px] sm:text-[10px] text-gray-400 mb-1 font-mono uppercase">Момент.</p>
                <div className="flex items-baseline gap-0.5">
                  <p className="text-base sm:text-lg font-bold text-blue-300 font-mono">
                    {formatLargeNumber(momentaryClickIncome)}
                  </p>
                  <span className="text-[9px] sm:text-[11px] text-blue-300/70 font-mono">₽/с</span>
                </div>
              </div>

              {/* Пассивный доход */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-2 border border-green-400/30 shadow-md">
                <p className="text-[8px] sm:text-[10px] text-gray-400 mb-1 font-mono uppercase">Пассив.</p>
                <div className="flex items-baseline gap-0.5">
                  <p className="text-base sm:text-lg font-bold text-green-300 font-mono">
                    {passiveIncomePerSecond.toFixed(1)}
                  </p>
                  <span className="text-[9px] sm:text-[11px] text-green-300/70 font-mono">₽/с</span>
                </div>
              </div>

            </div>

            {/* Прогресс уровня гаража + кнопки */}
            <div className="px-3 pb-3 space-y-2">

              {/* Прогресс-бар */}
              <div>
                <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-garage-rust to-garage-yellow h-full transition-all duration-500"
                    style={{ width: `${Math.round(garageProgress * 100)}%` }}
                  />
                </div>
                <p className="text-[8px] sm:text-[10px] text-gray-500 mt-1 font-mono">
                  {milestoneInfo
                    ? `🔓 Апгрейд: «${GARAGE_LEVEL_NAMES[milestoneInfo.level as keyof typeof GARAGE_LEVEL_NAMES]}» — ур.${milestoneInfo.level}`
                    : nextLevelCost
                      ? `До ур.${garageLevel + 1}: ${formatLargeNumber(Math.max(0, nextLevelCost - balance))}₽ (${Math.round(garageProgress * 100)}%)`
                      : 'Максимальный уровень!'}
                </p>
              </div>

              {/* Кнопка сброса */}
              <div className="flex justify-end items-center gap-2">

                <button
                  onClick={resetGame}
                  className="bg-red-900/50 hover:bg-red-800/70
                             text-red-300 text-[8px] sm:text-[10px] font-medium py-1.5 px-2 rounded
                             transition-colors duration-200
                             border border-red-700/50 font-mono
                             active:scale-95 transform shrink-0"
                  title="Сбросить игру к начальным значениям"
                >
                  🔄 Сброс
                </button>

              </div>

            </div>

          </footer>
      </div>

      <div
        className={`absolute inset-0 overflow-auto bg-gradient-to-b from-gray-800 to-gray-900 ${activeTab === 'upgrades' ? 'visible' : 'invisible pointer-events-none'}`}
      >
        <UpgradesPanel />
      </div>

      <div
        className={`absolute inset-0 overflow-auto bg-gradient-to-b from-gray-800 to-gray-900 ${activeTab === 'achievements' ? 'visible' : 'invisible pointer-events-none'}`}
      >
        <AchievementsPanel />
      </div>

      <div
        className={`absolute inset-0 overflow-auto bg-gradient-to-b from-gray-800 to-gray-900 ${activeTab === 'stats' ? 'visible' : 'invisible pointer-events-none'}`}
      >
        <StatsPanel />
      </div>

      </div>{/* /relative flex-1 min-h-0 — контейнер вкладок */}

      {/* ========== МОДАЛКА: Welcome Back ========== */}
      <WelcomeBackModal
        offlineEarnings={offlineEarnings}
        offlineTime={offlineTime}
        isOpen={showWelcomeBack}
        onClose={handleWelcomeBackClose}
      />

      {/* ========== МОДАЛКА: Milestone Upgrade ========== */}
      {pendingMilestoneLevel !== null && MILESTONE_UPGRADES[pendingMilestoneLevel as MilestoneLevel] && (
        <MilestoneUpgradeModal
          isOpen={showMilestoneModal}
          onClose={closeMilestoneModal}
          onPurchase={() => purchaseMilestone(pendingMilestoneLevel)}
          currentLevel={pendingMilestoneLevel - 1}
          nextLevel={pendingMilestoneLevel}
          upgradeCost={MILESTONE_UPGRADES[pendingMilestoneLevel as MilestoneLevel].cost}
          unlocks={MILESTONE_UPGRADES[pendingMilestoneLevel as MilestoneLevel].unlocks}
          canAfford={balance >= MILESTONE_UPGRADES[pendingMilestoneLevel as MilestoneLevel].cost}
        />
      )}

      {/* ========== МОДАЛКА: Daily Rewards ========== */}
      <DailyRewardsModal
        isOpen={showDailyRewardsModal}
        dailyRewards={dailyRewards}
        canClaim={canClaimToday}
        onClaim={claimDailyReward}
        onClose={closeDailyRewardsModal}
      />

      {/* ========== DEBUG INFO (только в dev режиме) ========== */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-2 right-2 bg-black/80 text-green-400 text-[8px] p-1.5 rounded font-mono z-50">
          <p>DEV</p>
          <p>B: {balance}</p>
          <p>L: {garageLevel}</p>
          <p>C: {momentaryClickIncome.toFixed(1)}</p>
          <p>P: {passiveIncomePerSecond.toFixed(1)}/s</p>
          <p>T: {activeTab}</p>
        </div>
      )}

    </div>
  )
}

export default App
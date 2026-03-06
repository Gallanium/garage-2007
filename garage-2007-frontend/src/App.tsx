import { useState } from 'react'
import {
  useGameStore,
  useGarageLevel,
  useIsLoaded,
  useShowMilestoneModal,
  usePendingMilestoneLevel,
  usePurchaseMilestone,
  useCloseMilestoneModal,
  useBalance,
  useMomentaryClickIncome,
  usePassiveIncome,
  DAILY_STREAK_GRACE_PERIOD_MS,
  MILESTONE_UPGRADES,
  type MilestoneLevel,
} from './store/gameStore'
import TabNavigation from './components/TabNavigation'
import UpgradesPanel from './components/UpgradesPanel'
import AchievementsPanel from './components/AchievementsPanel'
import StatsPanel from './components/StatsPanel'
import WelcomeBackModal from './components/WelcomeBackModal'
import MilestoneUpgradeModal from './components/MilestoneUpgradeModal'
import DailyRewardsModal from './components/DailyRewardsModal'
import { GameHeader } from './components/GameHeader'
import { GameFooter } from './components/GameFooter'
import { GameCanvas } from './components/GameCanvas'
import { useGameLifecycle } from './hooks/useGameLifecycle'
import { useOfflineEarnings } from './hooks/useOfflineEarnings'

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

// ============================================
// КОМПОНЕНТ
// ============================================

function App() {
  // --- Debug: доступ к store из консоли браузера (только dev) ---
  if (import.meta.env.DEV) {
    ;(window as Window & { __store: typeof useGameStore }).__store = useGameStore
  }

  // --- Lifecycle хуки ---
  useGameLifecycle()
  const { showWelcomeBack, offlineEarnings, offlineTime, handleWelcomeBackClose } = useOfflineEarnings()

  // --- Локальное состояние ---
  const [activeTab, setActiveTab] = useState<string>('game')

  // --- Данные из store ---
  const isLoaded = useIsLoaded()
  const garageLevel = useGarageLevel()
  const showMilestoneModal = useShowMilestoneModal()
  const pendingMilestoneLevel = usePendingMilestoneLevel()
  const purchaseMilestone = usePurchaseMilestone()
  const closeMilestoneModal = useCloseMilestoneModal()
  const balance = useBalance()
  const momentaryClickIncome = useMomentaryClickIncome()
  const passiveIncomePerSecond = usePassiveIncome()

  const handleClick = useGameStore((s) => s.handleClick)
  const showDailyRewardsModal = useGameStore((s) => s.showDailyRewardsModal)
  const dailyRewards = useGameStore((s) => s.dailyRewards)
  const claimDailyReward = useGameStore((s) => s.claimDailyReward)
  const closeDailyRewardsModal = useGameStore((s) => s.closeDailyRewardsModal)
  const openDailyRewardsModal = useGameStore((s) => s.openDailyRewardsModal)

  const canClaimToday = dailyRewards.lastClaimTimestamp === 0
    || (Date.now() - dailyRewards.lastClaimTimestamp) >= DAILY_STREAK_GRACE_PERIOD_MS

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

  const isGameTabActive = activeTab === 'game' && !showWelcomeBack && !showMilestoneModal && !showDailyRewardsModal

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-800 via-garage-metal to-gray-900 text-white overflow-y-auto">

      <GameHeader />

      {/* Навигация табов */}
      <div className="px-2 sm:px-4 pt-2 bg-gray-900/60">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />
      </div>

      {/* Контент: табы стекаются через absolute + visibility */}
      {/* visibility:hidden вместо display:none — Phaser канвас остаётся в layout tree */}
      <div className="relative flex-1 min-h-0">

        <div
          className={`absolute inset-0 flex flex-col ${activeTab === 'game' ? 'visible' : 'invisible pointer-events-none'}`}
        >
          <GameCanvas
            garageLevel={garageLevel}
            isActive={isGameTabActive}
            onGarageClick={handleClick}
            dailyRewardStreak={dailyRewards.currentStreak}
            canClaimDaily={canClaimToday}
            onOpenDailyRewards={openDailyRewardsModal}
          />
          <GameFooter />
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

      </div>

      {/* Модалки */}
      <WelcomeBackModal
        offlineEarnings={offlineEarnings}
        offlineTime={offlineTime}
        isOpen={showWelcomeBack}
        onClose={handleWelcomeBackClose}
      />

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

      <DailyRewardsModal
        isOpen={showDailyRewardsModal}
        dailyRewards={dailyRewards}
        canClaim={canClaimToday}
        onClaim={claimDailyReward}
        onClose={closeDailyRewardsModal}
      />

      {/* Debug overlay (только dev) */}
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

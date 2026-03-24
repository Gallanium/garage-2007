import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  useGameStore,
  useGarageLevel,
  useIsLoaded,
  useServerError,
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
import ToastContainer from './components/ToastContainer'
const UpgradesPanel = lazy(() => import('./components/UpgradesPanel'))
const AchievementsPanel = lazy(() => import('./components/AchievementsPanel'))
const StatsPanel = lazy(() => import('./components/StatsPanel'))
import WelcomeBackModal from './components/WelcomeBackModal'
import MilestoneUpgradeModal from './components/MilestoneUpgradeModal'
import DailyRewardsModal from './components/DailyRewardsModal'
import { GameHeader } from './components/GameHeader'
import { GameFooter } from './components/GameFooter'
import { GameCanvas } from './components/GameCanvas'
import { AmbientEventSystem } from './components/AmbientEventSystem'
import { LandscapeBlocker } from './components/LandscapeBlocker'
import { useGameLifecycle } from './hooks/useGameLifecycle'
import { useOfflineEarnings } from './hooks/useOfflineEarnings'
import { useTelegramBackButton } from './hooks/useTelegram'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { useSoundEffects } from './hooks/useSoundEffects'
import { AudioProvider } from './contexts/AudioContext'
import { Home, ArrowUpCircle, Trophy, BarChart2 } from 'lucide-react'

// ============================================
// КОНСТАНТЫ
// ============================================

/** Конфигурация табов навигации без бейджей (вычисляются динамически) */
const baseTabs = [
  { id: 'game', label: 'Игра', icon: <Home className="w-4 h-4" /> },
  { id: 'upgrades', label: 'Улучшения', icon: <ArrowUpCircle className="w-4 h-4" /> },
  { id: 'achievements', label: 'Ачивки', icon: <Trophy className="w-4 h-4" /> },
  { id: 'stats', label: 'Статистика', icon: <BarChart2 className="w-4 h-4" /> },
]

// ============================================
// КОМПОНЕНТ ЗАГРУЗКИ
// ============================================

function LoadingScreen() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const updateProgress = () => {
      setProgress(p => {
        const next = p + (95 - p) * 0.1 + 1
        return next > 95 ? 95 : next
      })
      timer = setTimeout(updateProgress, 100)
    }
    updateProgress()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 gap-6 px-4">
      <h1 className="text-2xl font-bold text-garage-yellow font-mono tracking-widest drop-shadow-[0_0_8px_rgba(252,211,77,0.4)]">
        ГАРАЖ 2007
      </h1>
      
      <div className="flex flex-col items-center w-full max-w-[200px] gap-2">
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700/50 shadow-inner relative">
          <div
            className="absolute top-0 left-0 bg-gradient-to-r from-garage-rust to-garage-yellow h-full transition-all duration-200 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
          Загрузка...
        </p>
      </div>
    </div>
  )
}

// ============================================
// КОМПОНЕНТ
// ============================================

function App() {
  // --- Debug: доступ к store из консоли браузера (только dev) ---
  if (import.meta.env.DEV) {
    ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
  }

  // --- Lifecycle хуки ---
  const { retryAuth } = useGameLifecycle()
  const { showWelcomeBack, offlineEarnings, offlineTime, handleWelcomeBackClose } = useOfflineEarnings()

  // --- Sound bridge ---
  const playSoundRef = useRef<((key: string) => void) | null>(null)

  // --- Локальное состояние ---
  const [activeTab, setActiveTab] = useState<string>('game')
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['game']))

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    setMountedTabs(prev => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
    playSoundRef.current?.('tab_switch')
  }, [])

  // --- Telegram Back Button: показываем когда не на табе «Игра» ---
  const goToGameTab = useCallback(() => {
    handleTabChange('game')
    // Снять :focus/:hover с кнопки таба — нативный BackButton не делает blur
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [handleTabChange])
  useTelegramBackButton(activeTab !== 'game', goToGameTab)

  // --- Swipe navigation ---
  const swipeRef = useSwipeTabs(baseTabs.map(t => t.id), activeTab, handleTabChange)

  // --- Данные из store ---
  const isLoaded = useIsLoaded()
  const serverError = useServerError()
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
  const activeDecorations = useGameStore(useShallow((s) => s.decorations.active))

  const canClaimToday = dailyRewards.lastClaimTimestamp === 0
    || (Date.now() - dailyRewards.lastClaimTimestamp) >= DAILY_STREAK_GRACE_PERIOD_MS

  // --- Sound effects ---
  useSoundEffects(playSoundRef.current)

  const handleOpenDailyRewards = useCallback(() => {
    playSoundRef.current?.('modal_open')
    openDailyRewardsModal()
  }, [openDailyRewardsModal])

  const handleCloseDailyRewards = useCallback(() => {
    playSoundRef.current?.('modal_close')
    closeDailyRewardsModal()
  }, [closeDailyRewardsModal])

  const handleCloseWelcomeBack = useCallback(() => {
    playSoundRef.current?.('modal_close')
    handleWelcomeBackClose()
  }, [handleWelcomeBackClose])

  const handleCloseMilestone = useCallback(() => {
    playSoundRef.current?.('modal_close')
    closeMilestoneModal()
  }, [closeMilestoneModal])

  // Уведомления ачивок
  const achievements = useGameStore(s => s.achievements)
  const unclaimedAchievements = Object.values(achievements).filter(a => a.unlocked && !a.claimed).length

  const tabsWithBadges = baseTabs.map(tab => {
    if (tab.id === 'achievements') {
      return { ...tab, badge: unclaimedAchievements }
    }
    return tab
  })

  // Уведомления теперь внутри GameHeader

  // ============================================
  // ЭКРАН ОШИБКИ СЕРВЕРА
  // ============================================

  if (serverError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 gap-4 px-4">
        <h1 className="text-xl font-bold text-garage-yellow font-mono">
          ГАРАЖ 2007
        </h1>
        <p className="text-xs text-gray-400 font-mono text-center">
          Не удалось подключиться к серверу.
        </p>
        <p className="text-[10px] text-gray-500 font-mono text-center">
          Если не помогает — закройте и откройте игру заново
        </p>
        <button
          onClick={retryAuth}
          className="mt-2 px-6 py-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-mono font-bold text-xs rounded transition-colors"
        >
          Повторить
        </button>
      </div>
    )
  }

  // ============================================
  // ЭКРАН ЗАГРУЗКИ
  // ============================================

  if (!isLoaded) {
    return <LoadingScreen />
  }

  // ============================================
  // ОСНОВНОЙ РЕНДЕР
  // ============================================

  const isGameTabActive = activeTab === 'game' && !showWelcomeBack && !showMilestoneModal && !showDailyRewardsModal

  return (
    <AudioProvider playSoundRef={playSoundRef}>
    <div
      className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden relative"
      style={{ paddingTop: 'var(--tg-safe-area-top)' }}
    >
      <LandscapeBlocker />
      <AmbientEventSystem />
      {/* Фоновый Neon Mesh */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-40">
        <div className="absolute w-[400px] h-[400px] bg-orange-700/20 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute w-[300px] h-[300px] bg-cyan-900/20 rounded-full blur-[100px] -translate-y-40 translate-x-20"></div>
      </div>

      <GameHeader />

      {/* Навигация табов */}
      <div className="px-2 pt-2 bg-gray-900">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabs={tabsWithBadges}
        />
      </div>

      {/* Контент: табы стекаются через absolute + visibility */}
      {/* visibility:hidden вместо display:none — Phaser канвас остаётся в layout tree */}
      <div ref={swipeRef} className="relative flex-1 min-h-0">

        <div
          className={`absolute inset-0 flex flex-col transition-all duration-300 ease-out z-[40] ${activeTab === 'game' ? 'visible opacity-100 translate-x-0' : 'invisible opacity-0 -translate-x-12 pointer-events-none'}`}
        >
          <GameCanvas
            garageLevel={garageLevel}
            isActive={isGameTabActive}
            onGarageClick={handleClick}
            dailyRewardStreak={dailyRewards.currentStreak}
            canClaimDaily={canClaimToday}
            onOpenDailyRewards={handleOpenDailyRewards}
            activeDecorations={activeDecorations}
            playSoundRef={playSoundRef}
          />
          <GameFooter />
        </div>

        <div
          className={`absolute inset-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out z-[30] ${activeTab === 'upgrades' ? 'opacity-100 translate-x-0' : activeTab === 'game' ? 'opacity-0 translate-x-12 pointer-events-none' : 'opacity-0 -translate-x-12 pointer-events-none'}`}
        >
          {mountedTabs.has('upgrades') && (
            <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-gray-500 font-mono text-xs">Загрузка...</span></div>}>
              <UpgradesPanel />
            </Suspense>
          )}
        </div>

        <div
          className={`absolute inset-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out z-[20] ${activeTab === 'achievements' ? 'opacity-100 translate-x-0' : activeTab === 'game' || activeTab === 'upgrades' ? 'opacity-0 translate-x-12 pointer-events-none' : 'opacity-0 -translate-x-12 pointer-events-none'}`}
        >
          {mountedTabs.has('achievements') && (
            <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-gray-500 font-mono text-xs">Загрузка...</span></div>}>
              <AchievementsPanel />
            </Suspense>
          )}
        </div>

        <div
          className={`absolute inset-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out z-[10] ${activeTab === 'stats' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12 pointer-events-none'}`}
        >
          {mountedTabs.has('stats') && (
            <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-gray-500 font-mono text-xs">Загрузка...</span></div>}>
              <StatsPanel />
            </Suspense>
          )}
        </div>

      </div>

      {/* Модалки */}
      <WelcomeBackModal
        offlineEarnings={offlineEarnings}
        offlineTime={offlineTime}
        isOpen={showWelcomeBack}
        onClose={handleCloseWelcomeBack}
      />

      {pendingMilestoneLevel !== null && MILESTONE_UPGRADES[pendingMilestoneLevel as MilestoneLevel] && (
        <MilestoneUpgradeModal
          isOpen={showMilestoneModal}
          onClose={handleCloseMilestone}
          onPurchase={() => purchaseMilestone(pendingMilestoneLevel)}
          currentLevel={pendingMilestoneLevel - 1}
          nextLevel={pendingMilestoneLevel}
          upgradeCost={MILESTONE_UPGRADES[pendingMilestoneLevel as MilestoneLevel].cost}
          unlocks={MILESTONE_UPGRADES[pendingMilestoneLevel as MilestoneLevel].unlocks}
        />
      )}

      <DailyRewardsModal
        isOpen={showDailyRewardsModal}
        dailyRewards={dailyRewards}
        canClaim={canClaimToday}
        onClaim={claimDailyReward}
        onClose={handleCloseDailyRewards}
      />

      <ToastContainer />

      {/* Debug overlay (только dev) */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-2 right-2 bg-black/80 text-green-400 text-game-xs p-1.5 rounded font-mono z-50">
          <p>DEV</p>
          <p>B: {balance}</p>
          <p>L: {garageLevel}</p>
          <p>C: {momentaryClickIncome.toFixed(1)}</p>
          <p>P: {passiveIncomePerSecond.toFixed(1)}/s</p>
          <p>T: {activeTab}</p>
        </div>
      )}

    </div>
    </AudioProvider>
  )
}

export default App

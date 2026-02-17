import { useState, useEffect, useRef } from 'react'
import {
  useGameStore,
  useBalance,
  useClickValue,
  useTotalClicks,
  useGarageLevel,
  usePassiveIncome,
  useNuts,
  useIsLoaded,
  useLastOfflineEarnings,
  useLastOfflineTimeAway,
  useNextLevelCost,
  useGarageProgress,
  useCanUpgradeGarage,
} from './store/gameStore'
import PhaserGame from './game/PhaserGame'
import TabNavigation from './components/TabNavigation'
import UpgradesPanel from './components/UpgradesPanel'
import WelcomeBackModal from './components/WelcomeBackModal'

// ============================================
// КОНСТАНТЫ
// ============================================

/** Конфигурация табов навигации */
const tabs = [
  { id: 'game', label: 'Игра', icon: '🏠' },
  { id: 'upgrades', label: 'Улучшения', icon: '⬆️' },
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

/** Названия уровней гаража согласно GDD (раздел 5) */
const GARAGE_LEVEL_NAMES: Record<number, string> = {
  1: 'Ржавая ракушка',
  2: 'Начало пути',
  3: 'Базовый ремонт',
  4: 'Мастерская',
  5: 'Гараж механика',
  6: 'Продвинутый гараж',
  7: 'Тюнинг-ателье',
  8: 'Автосервис',
  9: 'СТО',
  10: 'Большой сервис',
  11: 'Автоцентр',
  12: 'Премиум-сервис',
  13: 'Автокомплекс',
  14: 'Техноцентр',
  15: 'Автохолдинг',
  16: 'Мегасервис',
  17: 'Автоимперия',
  18: 'Легенда района',
  19: 'Король гаражей',
  20: 'Элитный автосервис',
}

// ============================================
// УТИЛИТЫ
// ============================================

/** Форматирование чисел с разделителями тысяч (ru-RU) */
function formatNumber(num: number): string {
  return num.toLocaleString('ru-RU')
}

// ============================================
// КОМПОНЕНТ
// ============================================

function App() {
  // --- Локальное состояние ---
  const [activeTab, setActiveTab] = useState<string>('game')
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)

  // --- Данные из store (оптимизированные селекторы) ---
  const balance = useBalance()
  const clickValue = useClickValue()
  const totalClicks = useTotalClicks()
  const garageLevel = useGarageLevel()
  const passiveIncomePerSecond = usePassiveIncome()
  const nuts = useNuts()
  const isLoaded = useIsLoaded()
  const offlineEarnings = useLastOfflineEarnings()
  const offlineTime = useLastOfflineTimeAway()
  const nextLevelCost = useNextLevelCost()
  const garageProgress = useGarageProgress()
  const canUpgradeGarage = useCanUpgradeGarage()

  // --- Действия из store ---
  const handleClick = useGameStore((s) => s.handleClick)
  const resetGame = useGameStore((s) => s.resetGame)
  const startPassiveIncome = useGameStore((s) => s.startPassiveIncome)
  const loadProgress = useGameStore((s) => s.loadProgress)
  const saveProgress = useGameStore((s) => s.saveProgress)
  const clearOfflineEarnings = useGameStore((s) => s.clearOfflineEarnings)
  const upgradeGarage = useGameStore((s) => s.upgradeGarage)

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
    if (offlineTime <= MIN_OFFLINE_FOR_MODAL) return

    console.log(`[App] Показываем модалку: ${offlineEarnings.toFixed(2)} ₽ за ${offlineTime} сек`)

    const timer = setTimeout(() => {
      setShowWelcomeBack(true)
    }, MODAL_SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [isLoaded, offlineEarnings, offlineTime])

  /**
   * 2. Запуск пассивного дохода при монтировании.
   *    Возвращает cleanup для clearInterval.
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

  /** Закрытие модалки Welcome Back */
  const handleWelcomeBackClose = () => {
    setShowWelcomeBack(false)
    clearOfflineEarnings()
  }

  // ============================================
  // ЭКРАН ЗАГРУЗКИ
  // ============================================

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-800 to-gray-900 gap-4">
        <h1 className="text-4xl font-bold text-garage-yellow font-mono drop-shadow-lg">
          ГАРАЖ 2007
        </h1>
        <p className="text-xl text-gray-300 font-mono animate-pulse">
          Загрузка игры...
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
      <header className="flex justify-between items-center p-4 bg-gray-900/80 backdrop-blur-sm border-b-2 border-garage-rust shadow-lg z-10">

        {/* Левая часть: Баланс */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-mono">Баланс</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-garage-yellow font-mono tracking-tight">
              {formatNumber(balance)}
            </span>
            <span className="text-lg text-garage-yellow/70 font-mono">₽</span>
          </div>
        </div>

        {/* Центр: Название игры */}
        <div className="hidden sm:block text-center">
          <h1 className="text-xl font-bold text-garage-yellow drop-shadow-lg font-mono">
            ГАРАЖ 2007
          </h1>
          <p className="text-xs text-gray-400">v0.1.0-MVP</p>
        </div>

        {/* Правая часть: Гайки (premium валюта) */}
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-mono">Гайки</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-orange-400 font-mono">
              {formatNumber(nuts)}
            </span>
            <span className="text-xl">🔩</span>
          </div>
        </div>

      </header>

      {/* ========== НАВИГАЦИЯ ТАБОВ ========== */}
      <div className="px-4 pt-2 bg-gray-900/60">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />
      </div>

      {/* ========== КОНТЕНТ: условный рендер по активному табу ========== */}

      {activeTab === 'game' && (
        <>
          {/* Phaser Game (60% высоты) */}
          {/* flex-1 + min-h-0: canvas занимает доступное пространство, не выталкивая footer */}
          <main className="flex-1 min-h-0 relative bg-gradient-to-b from-gray-800 to-gray-900">

            <div className="w-full h-full flex items-center justify-center">
              <PhaserGame
                onGarageClick={handleClick}
                garageLevel={garageLevel}
              />
            </div>

            {/* Оверлей: уровень гаража */}
            <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-garage-rust shadow-lg">
              <p className="text-xs text-gray-400 font-mono">Уровень</p>
              <p className="text-lg font-bold text-white font-mono">
                {garageLevel} • {GARAGE_LEVEL_NAMES[garageLevel] || 'Неизвестно'}
              </p>
            </div>

            {/* Оверлей: подсказка клика */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2
                            bg-garage-yellow/20 backdrop-blur-sm rounded-full px-4 py-2
                            border border-garage-yellow/50 animate-pulse">
              <p className="text-sm text-garage-yellow font-mono text-center">
                👆 Кликни по гаражу
              </p>
            </div>

          </main>

          {/* Нижняя панель: Статистика */}
          {/* flex-shrink-0: footer не сжимается, всегда виден полностью */}
          <footer className="flex-shrink-0 bg-gray-900/90 backdrop-blur-sm border-t-2 border-garage-rust shadow-2xl">

            <div className="grid grid-cols-3 gap-2 p-4">

              {/* Доход за клик */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-3 border border-garage-yellow/30 shadow-md">
                <p className="text-xs text-gray-400 mb-1 font-mono uppercase">За клик</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-garage-yellow font-mono">
                    {formatNumber(clickValue)}
                  </p>
                  <span className="text-sm text-garage-yellow/70 font-mono">₽</span>
                </div>
              </div>

              {/* Всего кликов */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-3 border border-blue-400/30 shadow-md">
                <p className="text-xs text-gray-400 mb-1 font-mono uppercase">Кликов</p>
                <p className="text-xl font-bold text-blue-300 font-mono">
                  {formatNumber(totalClicks)}
                </p>
              </div>

              {/* Пассивный доход */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-3 border border-green-400/30 shadow-md">
                <p className="text-xs text-gray-400 mb-1 font-mono uppercase">Доход/сек</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-green-300 font-mono">
                    {passiveIncomePerSecond.toFixed(1)}
                  </p>
                  <span className="text-xs text-green-300/70 font-mono">₽</span>
                </div>
              </div>

            </div>

            {/* Прогресс уровня гаража + кнопки */}
            <div className="px-4 pb-4 space-y-2">

              {/* Прогресс-бар */}
              <div>
                <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-garage-rust to-garage-yellow h-full transition-all duration-500"
                    style={{ width: `${Math.round(garageProgress * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  {nextLevelCost
                    ? `До уровня ${garageLevel + 1}: ${formatNumber(Math.max(0, nextLevelCost - balance))} ₽ (${Math.round(garageProgress * 100)}%)`
                    : 'Максимальный уровень!'}
                </p>
              </div>

              {/* Кнопки: улучшить гараж + сброс */}
              <div className="flex justify-between items-center gap-2">

                {nextLevelCost && (
                  <button
                    onClick={upgradeGarage}
                    disabled={!canUpgradeGarage}
                    className={`flex-grow py-2 px-4 rounded font-mono text-sm font-bold
                               border transition-all duration-200 active:scale-95 transform
                               ${canUpgradeGarage
                                 ? 'bg-gradient-to-r from-garage-rust to-garage-yellow text-gray-900 border-garage-yellow shadow-lg shadow-garage-yellow/20 hover:brightness-110'
                                 : 'bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed'}`}
                  >
                    Улучшить гараж — {formatNumber(nextLevelCost)} ₽
                  </button>
                )}

                <button
                  onClick={resetGame}
                  className="bg-red-900/50 hover:bg-red-800/70
                             text-red-300 text-xs font-medium py-2 px-3 rounded
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
        </>
      )}

      {activeTab === 'upgrades' && (
        <main className="flex-grow overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900">
          <UpgradesPanel />
        </main>
      )}

      {/* ========== МОДАЛКА: Welcome Back ========== */}
      <WelcomeBackModal
        offlineEarnings={offlineEarnings}
        offlineTime={offlineTime}
        isOpen={showWelcomeBack}
        onClose={handleWelcomeBackClose}
      />

      {/* ========== DEBUG INFO (только в dev режиме) ========== */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-2 right-2 bg-black/80 text-green-400 text-xs p-2 rounded font-mono z-50">
          <p>DEV MODE</p>
          <p>Balance: {balance}</p>
          <p>Level: {garageLevel}</p>
          <p>Clicks: {totalClicks}</p>
          <p>Passive: {passiveIncomePerSecond.toFixed(1)}/s</p>
          <p>Tab: {activeTab}</p>
        </div>
      )}

    </div>
  )
}

export default App
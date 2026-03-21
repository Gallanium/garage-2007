import { useState, useEffect } from 'react'
import {
  useGameStore,
  useBalance,
  useUpgrades,
  useWorkers,
  useMilestonesPurchased,
  usePendingMilestoneInfo,
  usePurchaseMilestone,
  isWorkerUnlocked,
  formatLargeNumber,
  WORKER_LIMITS,
  CLICK_UPGRADE_MAX_LEVEL,
  GARAGE_LEVEL_NAMES,
  REWARDED_VIDEO_NUTS,
  REWARDED_VIDEO_COOLDOWN_MS,
  type WorkerType,
} from '../store/gameStore'
import UpgradeCard from './UpgradeCard'
import { DecorationSection } from './DecorationSection'

// ============================================
// ОПРЕДЕЛЕНИЯ РАБОТНИКОВ ДЛЯ РЕНДЕРА
// ============================================

const WORKER_DEFS: Array<{
  type: WorkerType
  icon: string
  title: string
  incomeLabel: string
  requiredMilestone: number | null
}> = [
  { type: 'apprentice', icon: '👷', title: 'Подмастерье',  incomeLabel: '2 ₽/с',      requiredMilestone: null },
  { type: 'mechanic',   icon: '⚙️', title: 'Механик',      incomeLabel: '20 ₽/с',     requiredMilestone: 5 },
  { type: 'master',     icon: '🔧', title: 'Мастер',       incomeLabel: '200 ₽/с',    requiredMilestone: 10 },
  { type: 'brigadier',  icon: '👔', title: 'Бригадир',     incomeLabel: '2000 ₽/с',   requiredMilestone: 15 },
  { type: 'director',   icon: '🏢', title: 'Директор',     incomeLabel: '20000 ₽/с',  requiredMilestone: 20 },
]

// ============================================
// КОМПОНЕНТ
// ============================================

const UpgradesPanel: React.FC = () => {
  const balance = useBalance()
  const upgrades = useUpgrades()
  const workers = useWorkers()
  const purchasedUpgrades = useMilestonesPurchased()
  const milestoneInfo = usePendingMilestoneInfo()
  const purchaseMilestone = usePurchaseMilestone()

  const purchaseClickUpgrade = useGameStore((s) => s.purchaseClickUpgrade)
  const purchaseWorkSpeedUpgrade = useGameStore((s) => s.purchaseWorkSpeedUpgrade)
  const hireWorker = useGameStore((s) => s.hireWorker)

  // --- Rewarded Video ---
  const rewardedVideo = useGameStore((s) => s.rewardedVideo)
  const canWatch = useGameStore((s) => s.canWatchRewardedVideo())
  const watchVideo = useGameStore((s) => s.watchRewardedVideo)

  const [isWatching, setIsWatching] = useState(false)
  const [minutesRemaining, setMinutesRemaining] = useState(0)

  // Таймер cooldown — обновляется каждые 10 секунд
  useEffect(() => {
    const update = () => {
      const now = Date.now()
      const elapsed = now - rewardedVideo.lastWatchedTimestamp
      const remaining = Math.max(0, REWARDED_VIDEO_COOLDOWN_MS - elapsed)
      setMinutesRemaining(Math.ceil(remaining / 60000))
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [rewardedVideo.lastWatchedTimestamp])

  const handleWatchVideo = async () => {
    setIsWatching(true)
    await watchVideo()
    setIsWatching(false)
  }

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto h-full">

      {/* ======== Секция: Бесплатные гайки ======== */}
      <section>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center text-lg flex-shrink-0">
              📺
            </div>
            <div>
              <p className="text-xs font-bold text-white font-mono">Посмотреть рекламу</p>
              <p className="text-gray-400 font-mono text-[9px]">
                Получи {REWARDED_VIDEO_NUTS} гаек за просмотр
              </p>
            </div>
          </div>

          {canWatch ? (
            <button
              onClick={handleWatchVideo}
              disabled={isWatching || rewardedVideo.isWatching}
              className={`w-full py-2 rounded text-[10px] font-bold font-mono transition-colors
                ${isWatching || rewardedVideo.isWatching
                  ? 'bg-gray-700 text-gray-500 cursor-wait'
                  : 'bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white'
                }`}
            >
              {isWatching || rewardedVideo.isWatching
                ? '📺 Просмотр...'
                : `СМОТРЕТЬ → +${REWARDED_VIDEO_NUTS} 🔩`}
            </button>
          ) : (
            <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30 font-mono">
              ⏳ Доступно через {minutesRemaining} мин
            </div>
          )}

          <p className="text-gray-500 font-mono text-[9px] text-center mt-2">
            Просмотрено: {rewardedVideo.totalWatches} раз
          </p>
        </div>
      </section>

      {/* ======== Секция: Milestone апгрейд (если доступен) ======== */}
      {milestoneInfo && (
        <section>
          <h2 className="text-garage-yellow text-sm font-bold tracking-widest font-mono mb-2">
            АПГРЕЙД
          </h2>
          <div
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-700 flex items-center justify-center text-lg flex-shrink-0">
                🏗️
              </div>
              <div>
                <p className="text-xs font-bold text-white font-mono">
                  До ур. {milestoneInfo.level}
                </p>
                <p className="text-gray-400 font-mono text-[9px]">
                  «{GARAGE_LEVEL_NAMES[milestoneInfo.level as keyof typeof GARAGE_LEVEL_NAMES]}»
                </p>
              </div>
            </div>
            {/* Что откроется */}
            <ul className="space-y-0.5 text-[9px] text-gray-400 font-mono mb-2">
              {milestoneInfo.upgrade.unlocks.workers.map((w, i) => (
                <li key={`w-${i}`}>👷 {w}</li>
              ))}
              {milestoneInfo.upgrade.unlocks.upgrades.map((u, i) => (
                <li key={`u-${i}`}>⚡ {u}</li>
              ))}
            </ul>
            {/* Кнопка покупки */}
            <button
              className={`w-full py-2 rounded text-[10px] font-bold font-mono transition-colors
                ${balance >= milestoneInfo.upgrade.cost
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              disabled={balance < milestoneInfo.upgrade.cost}
              onClick={() => purchaseMilestone(milestoneInfo.level)}
            >
              ПОВЫСИТЬ {formatLargeNumber(milestoneInfo.upgrade.cost)} ₽
            </button>
          </div>
        </section>
      )}

      {/* ======== Секция: Улучшения ======== */}
      <section>
        <h2 className="text-garage-yellow text-sm font-bold tracking-widest font-mono mb-2">
          МАГАЗИН
        </h2>

        <div className="grid grid-cols-1 gap-2">
          <UpgradeCard
            icon="🔧"
            title="Инструменты"
            description="+1 ₽ за клик"
            currentLevel={upgrades.clickPower.level}
            cost={upgrades.clickPower.cost}
            canAfford={balance >= upgrades.clickPower.cost}
            onPurchase={purchaseClickUpgrade}
            maxLevel={CLICK_UPGRADE_MAX_LEVEL}
            colorTheme="orange"
          />

          {purchasedUpgrades.includes(5) ? (
            <UpgradeCard
              icon="⚡"
              title="Энергетики"
              description="+10% доход работников"
              currentLevel={upgrades.workSpeed.level}
              cost={upgrades.workSpeed.cost}
              canAfford={balance >= upgrades.workSpeed.cost}
              onPurchase={purchaseWorkSpeedUpgrade}
              colorTheme="purple"
            />
          ) : (
            <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 rounded-lg border border-gray-700/40 p-3 opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg opacity-40 flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 font-mono">Энергетики</p>
                  <p className="text-[9px] text-gray-600 font-mono">+10% доход работников</p>
                </div>
              </div>
              <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30 font-mono">
                🔒 Уровень 5
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ======== Секция: Работники ======== */}
      <section>
        <h2 className="text-garage-yellow text-sm font-bold tracking-widest font-mono mb-2">
          БИРЖА ТРУДА
        </h2>

        <div className="grid grid-cols-1 gap-2">
          {WORKER_DEFS.map((def) => {
            const unlocked = isWorkerUnlocked(def.type, purchasedUpgrades)

            // --- Заблокированный работник: заглушка ---
            if (!unlocked) {
              return (
                <div
                  key={def.type}
                  className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 rounded-lg border border-gray-700/40 p-3 opacity-50"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg opacity-40 flex-shrink-0">
                      {def.icon}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 font-mono">
                        {def.title}
                      </p>
                      <p className="text-[9px] text-gray-600 font-mono">
                        {def.incomeLabel}
                      </p>
                    </div>
                  </div>
                  <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30 font-mono">
                    🔒 Уровень {def.requiredMilestone}
                  </div>
                </div>
              )
            }

            // --- Разблокированный работник ---
            const worker = workers[def.type]
            const limit = WORKER_LIMITS[def.type]
            const isMaxed = worker.count >= limit

            return (
              <UpgradeCard
                key={def.type}
                icon={def.icon}
                title={def.title}
                description={`${def.incomeLabel} (${worker.count}/${limit})`}
                currentLevel={worker.count}
                cost={worker.cost}
                canAfford={!isMaxed && balance >= worker.cost}
                onPurchase={() => hireWorker(def.type)}
                colorTheme="blue"
              />
            )
          })}
        </div>
      </section>

      {/* ======== Секция: Декорации ======== */}
      <DecorationSection />

    </div>
  )
}

export default UpgradesPanel

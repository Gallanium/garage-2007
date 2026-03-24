import { useState, useEffect } from 'react'
import {
  useGameStore,
  useBalance,
  useUpgrades,
  useWorkers,
  useMilestonesPurchased,
  usePendingMilestoneInfo,
  usePurchaseMilestone,
  useActiveEvent,
  isWorkerUnlocked,
  formatLargeNumber,
  WORKER_LIMITS,
  CLICK_UPGRADE_MAX_LEVEL,
  GARAGE_LEVEL_NAMES,
  REWARDED_VIDEO_NUTS,
  REWARDED_VIDEO_COOLDOWN_MS,
  type WorkerType,
} from '../store/gameStore'
import { Hexagon, HardHat, Settings, Wrench, Briefcase, Building2, MonitorPlay, Hourglass, Building, Zap, Lock } from 'lucide-react'
import UpgradeCard from './UpgradeCard'
import WorkerCard from './WorkerCard'
import { DecorationSection } from './DecorationSection'

// ============================================
// ОПРЕДЕЛЕНИЯ РАБОТНИКОВ ДЛЯ РЕНДЕРА
// ============================================

const WORKER_DEFS: Array<{
  type: WorkerType
  icon: React.ReactNode
  title: string
  incomeLabel: string
  requiredMilestone: number | null
}> = [
  { type: 'apprentice', icon: <HardHat className="w-5 h-5 text-white" />, title: 'Подмастерье',  incomeLabel: '2 ₽/с',      requiredMilestone: null },
  { type: 'mechanic',   icon: <Settings className="w-5 h-5 text-white" />, title: 'Механик',      incomeLabel: '20 ₽/с',     requiredMilestone: 5 },
  { type: 'master',     icon: <Wrench className="w-5 h-5 text-white" />, title: 'Мастер',       incomeLabel: '200 ₽/с',    requiredMilestone: 10 },
  { type: 'brigadier',  icon: <Briefcase className="w-5 h-5 text-white" />, title: 'Бригадир',     incomeLabel: '2000 ₽/с',   requiredMilestone: 15 },
  { type: 'director',   icon: <Building2 className="w-5 h-5 text-white" />, title: 'Директор',     incomeLabel: '20000 ₽/с',  requiredMilestone: 20 },
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

  // --- Активное событие (Скидки) ---
  const activeEvent = useActiveEvent()
  const discountPercent = activeEvent?.id === 'supplier_sale' ? 50 : 0

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
    <div className="flex flex-col gap-4 p-3" style={{ paddingBottom: 'calc(12px + var(--tg-safe-area-bottom, 0px))' }}>

      {/* ======== Секция: Бесплатные гайки ======== */}
      <section>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center text-white flex-shrink-0">
              <MonitorPlay className="w-6 h-6" />
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
              className={`w-full py-2 rounded text-[10px] font-bold font-mono transition-all active:scale-95
                ${isWatching || rewardedVideo.isWatching
                  ? 'bg-gray-700 text-gray-500 cursor-wait active:scale-100'
                  : 'bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white'
                }`}
            >
              {isWatching || rewardedVideo.isWatching
                ? <div className="flex items-center justify-center gap-1.5"><MonitorPlay className="w-3.5 h-3.5" /> Просмотр...</div>
                : <span className="flex items-center justify-center gap-1">Смотреть &rarr; <span className="flex items-center gap-0.5"><span className="leading-none translate-y-px">+{REWARDED_VIDEO_NUTS}</span><Hexagon className="w-3.5 h-3.5 text-white block" /></span></span>}
            </button>
          ) : (
            <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30 font-mono flex justify-center items-center gap-1.5">
              <Hourglass className="w-3 h-3" /> Доступно через {minutesRemaining} мин
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
            Апгрейд
          </h2>
          <div
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700/50 p-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-700 flex items-center justify-center text-white flex-shrink-0">
                <Building className="w-5 h-5" />
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
                <li key={`w-${i}`} className="flex items-center gap-1"><HardHat className="w-3 h-3" /> {w}</li>
              ))}
              {milestoneInfo.upgrade.unlocks.upgrades.map((u, i) => (
                <li key={`u-${i}`} className="flex items-center gap-1"><Zap className="w-3 h-3" /> {u}</li>
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
              Повысить {formatLargeNumber(milestoneInfo.upgrade.cost)} ₽
            </button>
          </div>
        </section>
      )}

      {/* ======== Секция: Улучшения ======== */}
      <section>
        <h2 className="text-garage-yellow text-sm font-bold tracking-widest font-mono mb-2">
          Магазин
        </h2>

        <div className="grid grid-cols-1 gap-2">
          <UpgradeCard
            icon={<Wrench className="w-5 h-5" />}
            title="Инструменты"
            description="+1 ₽ за клик"
            currentLevel={upgrades.clickPower.level}
            cost={upgrades.clickPower.cost}
            canAfford={balance >= upgrades.clickPower.cost}
            onPurchase={purchaseClickUpgrade}
            maxLevel={CLICK_UPGRADE_MAX_LEVEL}
            colorTheme="orange"
            discountPercent={discountPercent}
          />

          {purchasedUpgrades.includes(5) ? (
            <UpgradeCard
              icon={<Zap className="w-5 h-5" />}
              title="Энергетики"
              description="+10% доход работников"
              currentLevel={upgrades.workSpeed.level}
              cost={upgrades.workSpeed.cost}
              canAfford={balance >= upgrades.workSpeed.cost}
              onPurchase={purchaseWorkSpeedUpgrade}
              colorTheme="purple"
              discountPercent={discountPercent}
            />
          ) : (
            <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 rounded-lg border border-gray-700/40 p-3 opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-gray-500 flex-shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 font-mono">Энергетики</p>
                  <p className="text-[9px] text-gray-600 font-mono">+10% доход работников</p>
                </div>
              </div>
              <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30 font-mono flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" /> Уровень 5
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ======== Секция: Работники ======== */}
      <section>
        <h2 className="text-garage-yellow text-sm font-bold tracking-widest font-mono mb-2">
          Биржа труда
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
                    <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center opacity-40 flex-shrink-0">
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
                  <div className="w-full py-2 rounded text-center text-[10px] font-bold text-gray-500 bg-black/30 font-mono flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" /> Уровень {def.requiredMilestone}
                  </div>
                </div>
              )
            }

            // --- Разблокированный работник ---
            const worker = workers[def.type]
            const limit = WORKER_LIMITS[def.type]
            const isMaxed = worker.count >= limit

            return (
              <WorkerCard
                key={def.type}
                icon={def.icon}
                title={def.title}
                incomeLabel={def.incomeLabel}
                currentLevel={worker.count}
                maxLevel={limit}
                cost={worker.cost}
                canAfford={!isMaxed && balance >= worker.cost}
                onPurchase={() => hireWorker(def.type)}
                discountPercent={discountPercent}
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

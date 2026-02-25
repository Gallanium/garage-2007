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
  GARAGE_LEVEL_NAMES,
  type WorkerType,
} from '../store/gameStore'
import UpgradeCard from './UpgradeCard'

// ============================================
// ОПРЕДЕЛЕНИЯ РАБОТНИКОВ ДЛЯ РЕНДЕРА
// ============================================

/**
 * Массив описаний всех типов работников.
 * Порядок определяет порядок отображения в UI.
 *
 * requiredMilestone — уровень milestone-апгрейда, необходимый
 * для разблокировки работника. null = доступен всегда.
 * Должен совпадать с WORKER_UNLOCK_LEVELS в gameStore.ts.
 */
const WORKER_DEFS: Array<{
  type: WorkerType
  icon: string
  title: string
  incomeLabel: string
  requiredMilestone: number | null
}> = [
  { type: 'apprentice', icon: '👷', title: 'Нанять подмастерье', incomeLabel: '2 ₽/сек',      requiredMilestone: null },
  { type: 'mechanic',   icon: '⚙️', title: 'Нанять механика',    incomeLabel: '20 ₽/сек',     requiredMilestone: 5 },
  { type: 'master',     icon: '🔧', title: 'Нанять мастера',     incomeLabel: '200 ₽/сек',    requiredMilestone: 10 },
  { type: 'brigadier',  icon: '👔', title: 'Нанять бригадира',   incomeLabel: '2 000 ₽/сек',  requiredMilestone: 15 },
  { type: 'director',   icon: '🏢', title: 'Нанять директора',   incomeLabel: '20 000 ₽/сек', requiredMilestone: 20 },
]

// ============================================
// КОМПОНЕНТ
// ============================================

/**
 * Панель апгрейдов и найма работников.
 *
 * Две секции:
 * 1. УЛУЧШЕНИЯ — апгрейд дохода за клик и скорости работы
 * 2. РАБОТНИКИ — найм работников (гейтинг через milestone-апгрейды гаража)
 *
 * Разблокированные работники показываются как обычные карточки (UpgradeCard).
 * Заблокированные — как заглушки с иконкой замка и указанием требуемого уровня.
 *
 * Порядок разблокировки (GBD v1.1):
 * - Подмастерье: всегда доступен (лимит 3)
 * - Механик: после milestone уровня 5 (лимит 5)
 * - Мастер: после milestone уровня 10 (лимит 3)
 * - Бригадир: после milestone уровня 15 (лимит 2)
 * - Директор: после milestone уровня 20 (лимит 1)
 */
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

  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto h-full">

      {/* ======== Секция: Milestone апгрейд (если доступен) ======== */}
      {milestoneInfo && (
        <section>
          <h2 className="text-xl font-bold mb-3 text-yellow-400 font-mono">
            🏆 ДОСТУПЕН АПГРЕЙД
          </h2>
          <div
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4
                       border-2 border-yellow-400/70
                       animate-pulse-border shadow-lg shadow-yellow-400/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🏗️</span>
              <div>
                <p className="text-yellow-400 font-mono font-bold text-lg">
                  Повышение до ур. {milestoneInfo.level}
                </p>
                <p className="text-gray-400 font-mono text-sm">
                  «{GARAGE_LEVEL_NAMES[milestoneInfo.level as keyof typeof GARAGE_LEVEL_NAMES]}»
                </p>
              </div>
            </div>
            {/* Что откроется */}
            <ul className="space-y-1 text-sm text-gray-300 font-mono mb-3">
              {milestoneInfo.upgrade.unlocks.workers.map((w, i) => (
                <li key={`w-${i}`}>👷 {w}</li>
              ))}
              {milestoneInfo.upgrade.unlocks.upgrades.map((u, i) => (
                <li key={`u-${i}`}>⚙️ {u}</li>
              ))}
            </ul>
            {/* Кнопка покупки */}
            <button
              className={`w-full py-2 rounded-lg font-mono font-bold text-sm transition-colors
                ${balance >= milestoneInfo.upgrade.cost
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              disabled={balance < milestoneInfo.upgrade.cost}
              onClick={() => purchaseMilestone(milestoneInfo.level)}
            >
              ПОВЫСИТЬ ЗА {formatLargeNumber(milestoneInfo.upgrade.cost)} ₽
            </button>
          </div>
        </section>
      )}

      {/* ======== Секция: Улучшения ======== */}
      <section>
        <h2 className="text-xl font-bold mb-3 text-yellow-400 font-mono">
          УЛУЧШЕНИЯ
        </h2>

        <div className="grid grid-cols-1 gap-3">
          <UpgradeCard
            icon="🔧"
            title="Улучшить инструменты"
            description="Увеличивает доход за клик на 1 ₽"
            currentLevel={upgrades.clickPower.level}
            cost={upgrades.clickPower.cost}
            canAfford={balance >= upgrades.clickPower.cost}
            onPurchase={purchaseClickUpgrade}
          />

          {purchasedUpgrades.includes(5) ? (
            <UpgradeCard
              icon="⚡"
              title="Скорость работы"
              description="Увеличивает доход работников на 10%"
              currentLevel={upgrades.workSpeed.level}
              cost={upgrades.workSpeed.cost}
              canAfford={balance >= upgrades.workSpeed.cost}
              onPurchase={purchaseWorkSpeedUpgrade}
            />
          ) : (
            <div className="bg-gray-800/50 rounded-lg p-4 border-2 border-dashed border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-30">⚡</span>
                <div>
                  <p className="text-gray-500 font-mono font-bold text-sm">Скорость работы</p>
                  <p className="text-gray-600 font-mono text-xs">Увеличивает доход работников на 10%</p>
                </div>
              </div>
              <p className="text-gray-500 text-center mt-3 font-mono text-sm">
                🔒 Разблокируется на уровне 5
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ======== Секция: Работники ======== */}
      <section>
        <h2 className="text-xl font-bold mb-3 text-yellow-400 font-mono">
          РАБОТНИКИ
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {WORKER_DEFS.map((def) => {
            const unlocked = isWorkerUnlocked(def.type, purchasedUpgrades)

            // --- Заблокированный работник: заглушка ---
            if (!unlocked) {
              return (
                <div
                  key={def.type}
                  className="bg-gray-800/50 rounded-lg p-4
                             border-2 border-dashed border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl opacity-30">{def.icon}</span>
                    <div>
                      <p className="text-gray-500 font-mono font-bold text-sm">
                        {def.title}
                      </p>
                      <p className="text-gray-600 font-mono text-xs">
                        {def.incomeLabel}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-500 text-center mt-3 font-mono text-sm">
                    🔒 Разблокируется на уровне {def.requiredMilestone}
                  </p>
                </div>
              )
            }

            // --- Разблокированный работник: полная карточка ---
            const worker = workers[def.type]
            const limit = WORKER_LIMITS[def.type]
            const isMaxed = worker.count >= limit

            return (
              <UpgradeCard
                key={def.type}
                icon={def.icon}
                title={def.title}
                description={`Доход: ${def.incomeLabel} (${worker.count}/${limit})`}
                currentLevel={worker.count}
                cost={worker.cost}
                canAfford={!isMaxed && balance >= worker.cost}
                onPurchase={() => hireWorker(def.type)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default UpgradesPanel

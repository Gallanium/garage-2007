import {
  useGameStore,
  useBalance,
  useUpgrades,
  useWorkers,
  useMilestonesPurchased,
  isWorkerUnlocked,
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
  { type: 'apprentice', icon: '👷', title: 'Нанять подмастерье', incomeLabel: '0.5 ₽/сек', requiredMilestone: null },
  { type: 'mechanic',   icon: '⚙️', title: 'Нанять механика',    incomeLabel: '5 ₽/сек',   requiredMilestone: 5 },
  { type: 'master',     icon: '🔧', title: 'Нанять мастера',     incomeLabel: '50 ₽/сек',  requiredMilestone: 10 },
  { type: 'manager',    icon: '📋', title: 'Нанять менеджера',   incomeLabel: '5 000 ₽/сек', requiredMilestone: 15 },
  { type: 'foreman',    icon: '👔', title: 'Нанять бригадира',   incomeLabel: '500 ₽/сек',  requiredMilestone: 15 },
  { type: 'director',   icon: '🏢', title: 'Нанять директора',   incomeLabel: '50 000 ₽/сек', requiredMilestone: 20 },
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
 * Порядок разблокировки:
 * - Подмастерье: всегда доступен
 * - Механик: после milestone уровня 5
 * - Мастер: после milestone уровня 10
 * - Менеджер: после milestone уровня 15
 * - Бригадир: после milestone уровня 15
 * - Директор: после milestone уровня 20
 */
const UpgradesPanel: React.FC = () => {
  const balance = useBalance()
  const upgrades = useUpgrades()
  const workers = useWorkers()
  const purchasedUpgrades = useMilestonesPurchased()

  const purchaseClickUpgrade = useGameStore((s) => s.purchaseClickUpgrade)
  const purchaseWorkSpeedUpgrade = useGameStore((s) => s.purchaseWorkSpeedUpgrade)
  const hireWorker = useGameStore((s) => s.hireWorker)

  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto h-full">

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

          <UpgradeCard
            icon="⚡"
            title="Скорость работы"
            description="Увеличивает доход работников на 10%"
            currentLevel={upgrades.workSpeed.level}
            cost={upgrades.workSpeed.cost}
            canAfford={balance >= upgrades.workSpeed.cost}
            onPurchase={purchaseWorkSpeedUpgrade}
          />
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
            const isMaxed = worker.count >= worker.maxCount

            return (
              <UpgradeCard
                key={def.type}
                icon={def.icon}
                title={def.title}
                description={`Доход: ${def.incomeLabel} (${worker.count}/${worker.maxCount})`}
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

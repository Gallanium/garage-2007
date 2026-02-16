import {
  useGameStore,
  useBalance,
  useUpgrades,
  useWorkers,
} from '../store/gameStore'
import UpgradeCard from './UpgradeCard'

/**
 * Панель апгрейдов и найма работников.
 *
 * Две секции:
 * 1. УЛУЧШЕНИЯ — апгрейд дохода за клик
 * 2. РАБОТНИКИ — найм подмастерья и механика
 *
 * Все данные берутся из Zustand store, действия вызываются напрямую.
 * Компонент скроллится по вертикали, если контент не помещается.
 */
const UpgradesPanel: React.FC = () => {
  const balance = useBalance()
  const upgrades = useUpgrades()
  const workers = useWorkers()

  const purchaseClickUpgrade = useGameStore((s) => s.purchaseClickUpgrade)
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
        </div>
      </section>

      {/* ======== Секция: Работники ======== */}
      <section>
        <h2 className="text-xl font-bold mb-3 text-yellow-400 font-mono">
          РАБОТНИКИ
        </h2>

        <div className="grid grid-cols-1 gap-3">
          <UpgradeCard
            icon="👷"
            title="Нанять подмастерье"
            description="Доход: 0.5 ₽/сек"
            currentLevel={workers.apprentice.count}
            cost={workers.apprentice.cost}
            canAfford={balance >= workers.apprentice.cost}
            onPurchase={() => hireWorker('apprentice')}
          />

          <UpgradeCard
            icon="⚙️"
            title="Нанять механика"
            description="Доход: 5 ₽/сек"
            currentLevel={workers.mechanic.count}
            cost={workers.mechanic.cost}
            canAfford={balance >= workers.mechanic.cost}
            onPurchase={() => hireWorker('mechanic')}
          />
        </div>
      </section>
    </div>
  )
}

export default UpgradesPanel
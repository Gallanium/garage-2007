import { create } from 'zustand'

// ============================================
// КОНСТАНТЫ ЭКОНОМИКИ (из GDD раздел 6.3)
// ============================================

/** Коэффициент роста стоимости апгрейдов: Cost(n) = BaseCost × 1.15^n */
const UPGRADE_COST_MULTIPLIER = 1.15

/** Базовая стоимость апгрейда клика (GDD раздел 4.2A) */
const CLICK_UPGRADE_BASE_COST = 100

/** Базовая стоимость апгрейда скорости работы (GDD раздел 4.2C) */
const WORK_SPEED_BASE_COST = 500

/** Бонус скорости работы за каждый уровень: +10% (GDD раздел 4.2C) */
const WORK_SPEED_BONUS_PER_LEVEL = 0.10

// ============================================
// ТИПЫ
// ============================================

/** Идентификаторы типов работников */
export type WorkerType = 'apprentice' | 'mechanic'

/** Идентификаторы типов апгрейдов */
export type UpgradeType = 'clickPower' | 'workSpeed'

/** Данные одного апгрейда */
export interface UpgradeData {
  /** Текущий уровень апгрейда (0 = не куплен) */
  level: number
  /** Стоимость следующего уровня */
  cost: number
  /** Базовая стоимость для пересчёта формулы */
  baseCost: number
}

/** Данные одного типа работника */
export interface WorkerData {
  /** Количество нанятых работников данного типа */
  count: number
  /** Стоимость найма следующего работника */
  cost: number
  /** Базовая стоимость для пересчёта формулы */
  baseCost: number
  /** Базовый доход в секунду одного работника (до бонусов скорости) */
  baseIncomePerSec: number
  /** Максимальное количество работников данного типа (GDD раздел 4.2B) */
  maxCount: number
}

/** Слайс состояния апгрейдов */
export interface UpgradesState {
  clickPower: UpgradeData
  workSpeed: UpgradeData
}

/** Слайс состояния работников */
export interface WorkersState {
  apprentice: WorkerData
  mechanic: WorkerData
}

/**
 * Интерфейс состояния игры
 * Содержит все данные о прогрессе игрока
 */
interface GameState {
  /** Текущий баланс игрока в рублях */
  balance: number
  /** Доход за один клик */
  clickValue: number
  /** Общее количество кликов за всё время */
  totalClicks: number
  /** Текущий уровень гаража (1-20) */
  garageLevel: number
  /** Суммарный пассивный доход в секунду (с учётом бонуса скорости) */
  passiveIncomePerSecond: number
  /** Состояние апгрейдов */
  upgrades: UpgradesState
  /** Состояние работников */
  workers: WorkersState
}

/**
 * Интерфейс действий (actions)
 * Методы для изменения состояния игры
 */
interface GameActions {
  /** Обработчик клика по гаражу */
  handleClick: () => void

  /**
   * Покупка апгрейда дохода за клик (устаревший, оставлен для обратной совместимости)
   * @deprecated Используй purchaseClickUpgrade()
   */
  purchaseUpgrade: (cost: number, newClickValue: number) => boolean

  /**
   * Покупка улучшения дохода за клик.
   * Списывает деньги, повышает уровень, увеличивает clickValue на 1,
   * пересчитывает стоимость следующего уровня по формуле GDD.
   * @returns true если покупка успешна
   */
  purchaseClickUpgrade: () => boolean

  /**
   * Покупка улучшения скорости работы.
   * Каждый уровень даёт +10% к пассивному доходу всех работников.
   * @returns true если покупка успешна
   */
  purchaseWorkSpeedUpgrade: () => boolean

  /**
   * Найм работника указанного типа.
   * Проверяет баланс и лимит, списывает деньги,
   * пересчитывает стоимость и passiveIncomePerSecond.
   * @param workerType - тип работника
   * @returns true если найм успешен
   */
  hireWorker: (workerType: WorkerType) => boolean

  /**
   * Запускает начисление пассивного дохода каждую секунду.
   * @returns функция-очистка для остановки интервала
   */
  startPassiveIncome: () => () => void

  /** Сброс игры к начальным значениям (для отладки) */
  resetGame: () => void
}

/** Полный тип хранилища */
type GameStore = GameState & GameActions

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Вычисляет стоимость апгрейда по формуле из GDD (раздел 6.3):
 * Cost(n) = BaseCost × 1.15^n
 * @param baseCost - базовая стоимость
 * @param level - текущий уровень (n)
 * @returns округлённая стоимость следующего уровня
 */
function calculateUpgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * Math.pow(UPGRADE_COST_MULTIPLIER, level))
}

/**
 * Вычисляет суммарный пассивный доход в секунду с учётом бонуса скорости работы.
 * Формула: сумма(count × baseIncomePerSec) × (1 + workSpeedLevel × 0.10)
 * @param workers - текущее состояние работников
 * @param workSpeedLevel - уровень апгрейда скорости работы
 * @returns пассивный доход в секунду
 */
function calculatePassiveIncome(workers: WorkersState, workSpeedLevel: number): number {
  const baseIncome =
    workers.apprentice.count * workers.apprentice.baseIncomePerSec +
    workers.mechanic.count * workers.mechanic.baseIncomePerSec

  const speedMultiplier = 1 + workSpeedLevel * WORK_SPEED_BONUS_PER_LEVEL

  return parseFloat((baseIncome * speedMultiplier).toFixed(2))
}

// ============================================
// НАЧАЛЬНОЕ СОСТОЯНИЕ
// ============================================

const initialState: GameState = {
  balance: 0,
  clickValue: 1,
  totalClicks: 0,
  garageLevel: 1,
  passiveIncomePerSecond: 0,

  upgrades: {
    clickPower: {
      level: 0,
      cost: CLICK_UPGRADE_BASE_COST,       // 100 ₽ (GDD: уровень 1 стоит 100)
      baseCost: CLICK_UPGRADE_BASE_COST,
    },
    workSpeed: {
      level: 0,
      cost: WORK_SPEED_BASE_COST,           // 500 ₽
      baseCost: WORK_SPEED_BASE_COST,
    },
  },

  workers: {
    apprentice: {
      count: 0,
      cost: 500,                            // GDD: Подмастерье 500 ₽
      baseCost: 500,
      baseIncomePerSec: 0.5,                // GDD: 0.5 ₽/сек
      maxCount: 10,                         // GDD: макс. 10
    },
    mechanic: {
      count: 0,
      cost: 5_000,                          // GDD: Механик 5 000 ₽
      baseCost: 5_000,
      baseIncomePerSec: 5,                  // GDD: 5 ₽/сек
      maxCount: 10,                         // GDD: макс. 10
    },
  },
}

// ============================================
// STORE
// ============================================

/**
 * Zustand хранилище для игрового состояния.
 *
 * Архитектурные решения:
 * - Все экономические расчёты используют формулы из GDD (раздел 6.3)
 * - passiveIncomePerSecond пересчитывается при каждом изменении работников / скорости
 * - Базовые стоимости хранятся отдельно для корректного пересчёта Cost(n) = BaseCost × 1.15^n
 * - startPassiveIncome возвращает cleanup-функцию для использования в useEffect
 */
export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  // ---- Клик по гаражу ----

  handleClick: () => {
    const { clickValue } = get()
    set((state) => ({
      balance: state.balance + clickValue,
      totalClicks: state.totalClicks + 1,
    }))
  },

  // ---- Legacy-метод покупки (обратная совместимость) ----

  purchaseUpgrade: (cost: number, newClickValue: number) => {
    const { balance } = get()
    if (balance < cost) return false

    set((state) => ({
      balance: state.balance - cost,
      clickValue: newClickValue,
    }))
    return true
  },

  // ---- Покупка апгрейда клика ----

  purchaseClickUpgrade: () => {
    const { balance, upgrades } = get()
    const { clickPower } = upgrades

    if (balance < clickPower.cost) {
      console.warn(`[ClickUpgrade] Недостаточно средств: нужно ${clickPower.cost} ₽, есть ${balance} ₽`)
      return false
    }

    const newLevel = clickPower.level + 1
    const newCost = calculateUpgradeCost(clickPower.baseCost, newLevel)

    set((state) => ({
      balance: state.balance - clickPower.cost,
      clickValue: state.clickValue + 1,
      upgrades: {
        ...state.upgrades,
        clickPower: {
          ...state.upgrades.clickPower,
          level: newLevel,
          cost: newCost,
        },
      },
    }))

    console.log(`[ClickUpgrade] Уровень ${newLevel}, следующая стоимость: ${newCost} ₽`)
    return true
  },

  // ---- Покупка апгрейда скорости работы ----

  purchaseWorkSpeedUpgrade: () => {
    const { balance, upgrades, workers } = get()
    const { workSpeed } = upgrades

    if (balance < workSpeed.cost) {
      console.warn(`[WorkSpeed] Недостаточно средств: нужно ${workSpeed.cost} ₽, есть ${balance} ₽`)
      return false
    }

    const newLevel = workSpeed.level + 1
    const newCost = calculateUpgradeCost(workSpeed.baseCost, newLevel)
    const newPassiveIncome = calculatePassiveIncome(workers, newLevel)

    set((state) => ({
      balance: state.balance - workSpeed.cost,
      passiveIncomePerSecond: newPassiveIncome,
      upgrades: {
        ...state.upgrades,
        workSpeed: {
          ...state.upgrades.workSpeed,
          level: newLevel,
          cost: newCost,
        },
      },
    }))

    console.log(`[WorkSpeed] Уровень ${newLevel}, пассивный доход: ${newPassiveIncome} ₽/сек`)
    return true
  },

  // ---- Найм работника ----

  hireWorker: (workerType: WorkerType) => {
    const { balance, workers, upgrades } = get()
    const worker = workers[workerType]

    // Проверка лимита
    if (worker.count >= worker.maxCount) {
      console.warn(`[HireWorker] Достигнут лимит для ${workerType}: ${worker.maxCount}`)
      return false
    }

    // Проверка баланса
    if (balance < worker.cost) {
      console.warn(`[HireWorker] Недостаточно средств: нужно ${worker.cost} ₽, есть ${balance} ₽`)
      return false
    }

    const newCount = worker.count + 1
    const newCost = calculateUpgradeCost(worker.baseCost, newCount)

    // Обновляем работника
    const updatedWorkers: WorkersState = {
      ...workers,
      [workerType]: {
        ...worker,
        count: newCount,
        cost: newCost,
      },
    }

    // Пересчитываем пассивный доход с учётом нового работника
    const newPassiveIncome = calculatePassiveIncome(updatedWorkers, upgrades.workSpeed.level)

    set((state) => ({
      balance: state.balance - worker.cost,
      passiveIncomePerSecond: newPassiveIncome,
      workers: updatedWorkers,
    }))

    console.log(
      `[HireWorker] ${workerType} #${newCount}, следующий стоит: ${newCost} ₽, пассивный доход: ${newPassiveIncome} ₽/сек`
    )
    return true
  },

  // ---- Пассивный доход ----

  startPassiveIncome: () => {
    const intervalId = setInterval(() => {
      const { passiveIncomePerSecond } = get()
      if (passiveIncomePerSecond <= 0) return

      set((state) => ({
        balance: parseFloat((state.balance + passiveIncomePerSecond).toFixed(2)),
      }))
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  },

  // ---- Сброс ----

  resetGame: () => {
    set(initialState)
    console.log('[Game] Сброшена к начальным значениям')
  },
}))

// ============================================
// СЕЛЕКТОРЫ (оптимизация ре-рендеров)
// ============================================

export const useBalance = () => useGameStore((s) => s.balance)
export const useClickValue = () => useGameStore((s) => s.clickValue)
export const useTotalClicks = () => useGameStore((s) => s.totalClicks)
export const useGarageLevel = () => useGameStore((s) => s.garageLevel)
export const usePassiveIncome = () => useGameStore((s) => s.passiveIncomePerSecond)
export const useUpgrades = () => useGameStore((s) => s.upgrades)
export const useWorkers = () => useGameStore((s) => s.workers)
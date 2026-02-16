import { create } from 'zustand'

/**
 * Интерфейс состояния игры
 * Содержит все данные о прогрессе игрока
 */
interface GameState {
  balance: number          // Текущий баланс игрока в рублях
  clickValue: number       // Доход за один клик
  totalClicks: number      // Общее количество кликов за всё время
  garageLevel: number      // Текущий уровень гаража (1-20)
}

/**
 * Интерфейс действий (actions)
 * Методы для изменения состояния игры
 */
interface GameActions {
  /**
   * Обработчик клика по гаражу
   * Увеличивает баланс на clickValue и счётчик кликов
   */
  handleClick: () => void

  /**
   * Покупка апгрейда дохода за клик
   * @param cost - стоимость апгрейда
   * @param newClickValue - новое значение дохода за клик
   * @returns true если покупка успешна, false если недостаточно денег
   */
  purchaseUpgrade: (cost: number, newClickValue: number) => boolean

  /**
   * Сброс игры (для отладки)
   * Возвращает все значения к начальным
   */
  resetGame: () => void
}

/**
 * Полный тип хранилища: состояние + действия
 */
type GameStore = GameState & GameActions

/**
 * Начальное состояние игры
 */
const initialState: GameState = {
  balance: 0,
  clickValue: 1,
  totalClicks: 0,
  garageLevel: 1,
}

/**
 * Zustand хранилище для игрового состояния
 * Используется во всех компонентах для доступа к данным игры
 */
export const useGameStore = create<GameStore>((set, get) => ({
  // Начальное состояние
  ...initialState,

  // Действия
  handleClick: () => {
    const { clickValue } = get()
    set((state) => ({
      balance: state.balance + clickValue,
      totalClicks: state.totalClicks + 1,
    }))
    console.log('Клик! Заработано:', clickValue, '₽')
  },

  purchaseUpgrade: (cost: number, newClickValue: number) => {
    const { balance } = get()

    // Проверка: достаточно ли денег
    if (balance < cost) {
      console.warn('Недостаточно денег для покупки! Нужно:', cost, '₽, Есть:', balance, '₽')
      return false
    }

    // Списываем деньги и обновляем доход за клик
    set((state) => ({
      balance: state.balance - cost,
      clickValue: newClickValue,
    }))

    console.log('Апгрейд куплен! Новый доход за клик:', newClickValue, '₽')
    return true
  },

  resetGame: () => {
    set(initialState)
    console.log('Игра сброшена к начальным значениям')
  },
}))

/**
 * Вспомогательные селекторы (для оптимизации ре-рендеров)
 */

// Селектор только для баланса
export const useBalance = () => useGameStore((state) => state.balance)

// Селектор только для clickValue
export const useClickValue = () => useGameStore((state) => state.clickValue)

// Селектор только для totalClicks
export const useTotalClicks = () => useGameStore((state) => state.totalClicks)

// Селектор только для garageLevel
export const useGarageLevel = () => useGameStore((state) => state.garageLevel)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore, GARAGE_LEVEL_THRESHOLDS, MILESTONE_UPGRADES, WORKER_LIMITS, type MilestoneLevel, checkAutoLevel } from './store/gameStore'
import { STORAGE_KEY } from './utils/storageService'

// ============================================
// DEV CONSOLE TOOLS
// Доступны в консоли браузера через window.game
// Только в dev-режиме (import.meta.env.DEV)
// ============================================

if (import.meta.env.DEV) {
  const store = useGameStore

  const game = {
    // --- Чтение состояния ---

    /** Показать всё состояние целиком */
    state: () => store.getState(),

    /** Показать краткую сводку */
    info: () => {
      const s = store.getState()
      console.table({
        balance: s.balance,
        clickValue: s.clickValue,
        totalClicks: s.totalClicks,
        garageLevel: s.garageLevel,
        passiveIncomePerSecond: s.passiveIncomePerSecond,
        nuts: s.nuts,
        totalEarned: s.totalEarned,
        'workers.apprentice': s.workers.apprentice.count,
        'workers.mechanic': s.workers.mechanic.count,
        'workers.master': s.workers.master.count,
        'workers.brigadier': s.workers.brigadier.count,
        'workers.director': s.workers.director.count,
        'upgrades.clickPower': s.upgrades.clickPower.level,
        'upgrades.workSpeed': s.upgrades.workSpeed.level,
        'milestones': s.milestonesPurchased.join(', ') || 'нет',
      })
    },

    // --- Полный сброс ---

    /** Полный сброс игры (store + localStorage) */
    reset: () => {
      store.getState().resetGame()
      console.log('✅ Игра полностью сброшена')
    },

    // --- Установка отдельных параметров ---

    /** Установить баланс (с авто-левелингом и milestone-проверкой) */
    setBalance: (v: number) => {
      const s = store.getState()
      const newLevel = checkAutoLevel(v, s.garageLevel, s.milestonesPurchased)
      store.setState({ balance: v, garageLevel: newLevel })
      store.getState().checkForMilestone()
      console.log(`✅ balance = ${v}, garageLevel = ${newLevel}`)
    },

    /** Установить доход за клик */
    setClickValue: (v: number) => {
      store.setState({ clickValue: v })
      console.log(`✅ clickValue = ${v}`)
    },

    /** Установить общее количество кликов */
    setTotalClicks: (v: number) => {
      store.setState({ totalClicks: v })
      console.log(`✅ totalClicks = ${v}`)
    },

    /** Установить уровень гаража (1-20) */
    setGarageLevel: (v: number) => {
      if (v < 1 || v > 20) { console.error('❌ Уровень должен быть 1-20'); return }
      store.setState({ garageLevel: v })
      console.log(`✅ garageLevel = ${v}`)
    },

    /** Установить пассивный доход (₽/сек) */
    setPassiveIncome: (v: number) => {
      store.setState({ passiveIncomePerSecond: v })
      console.log(`✅ passiveIncomePerSecond = ${v}`)
    },

    /** Установить количество гаек (premium валюта) */
    setNuts: (v: number) => {
      store.setState({ nuts: v })
      console.log(`✅ nuts = ${v}`)
    },

    /** Установить totalEarned */
    setTotalEarned: (v: number) => {
      store.setState({ totalEarned: v })
      console.log(`✅ totalEarned = ${v}`)
    },

    /** Установить количество работников */
    setWorkers: (type: 'apprentice' | 'mechanic' | 'master' | 'brigadier' | 'director', count: number) => {
      const s = store.getState()
      const worker = s.workers[type]
      const limit = WORKER_LIMITS[type]
      if (count < 0 || count > limit) {
        console.error(`❌ count должен быть 0-${limit}`)
        return
      }
      store.setState({
        workers: {
          ...s.workers,
          [type]: { ...worker, count },
        },
      })
      console.log(`✅ workers.${type}.count = ${count}`)
    },

    /** Установить уровень апгрейда */
    setUpgradeLevel: (type: 'clickPower' | 'workSpeed', level: number) => {
      const s = store.getState()
      const upgrade = s.upgrades[type]
      store.setState({
        upgrades: {
          ...s.upgrades,
          [type]: { ...upgrade, level },
        },
      })
      console.log(`✅ upgrades.${type}.level = ${level}`)
    },

    // --- Быстрые действия для тестирования ---

    /** Добавить деньги (по умолчанию 10000). Авто-левелинг с milestone-гейтингом. */
    addMoney: (amount: number = 10_000) => {
      store.setState((s) => {
        const newBalance = s.balance + amount
        const newLevel = checkAutoLevel(newBalance, s.garageLevel, s.milestonesPurchased)
        return {
          balance: newBalance,
          totalEarned: s.totalEarned + amount,
          garageLevel: newLevel,
        }
      })
      store.getState().checkForMilestone()
      const s = store.getState()
      console.log(`✅ +${amount} ₽ (баланс: ${s.balance}, уровень: ${s.garageLevel})`)
    },

    /** Установить баланс, достаточный для следующего уровня гаража (с milestone-гейтингом) */
    readyForUpgrade: () => {
      const s = store.getState()
      const nextLevel = s.garageLevel + 1
      const cost = GARAGE_LEVEL_THRESHOLDS[nextLevel]
      if (!cost) { console.log('🏆 Максимальный уровень!'); return }
      const newLevel = checkAutoLevel(cost, s.garageLevel, s.milestonesPurchased)
      store.setState({ balance: cost, garageLevel: newLevel })
      store.getState().checkForMilestone()
      console.log(`✅ balance = ${cost}, garageLevel = ${newLevel}`)
    },

    /** Купить milestone-апгрейд (уровни 5, 10, 15, 20) */
    buyUpgrade: (level: number) => {
      const success = store.getState().purchaseMilestone(level)
      if (success) {
        const upgrade = MILESTONE_UPGRADES[level as MilestoneLevel]
        console.log(`✅ Куплен milestone ур.${level}: ${upgrade?.workerNames.join(', ')}`)
      } else {
        console.error(`❌ Не удалось купить milestone ур.${level}`)
      }
    },

    /** Принудительно сохранить прогресс */
    save: () => {
      store.getState().saveProgress()
      console.log('✅ Прогресс сохранён')
    },

    /** Очистить только localStorage (без сброса store) */
    clearStorage: () => {
      localStorage.removeItem(STORAGE_KEY)
      console.log('✅ localStorage очищен (store не тронут)')
    },

    /** Показать содержимое localStorage */
    showSave: () => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) { console.log('localStorage пуст'); return }
      console.log(JSON.parse(raw))
    },

    /**
     * Имитировать оффлайн-доход: сдвинуть timestamp и перезагрузить состояние.
     *
     * Почему без location.reload():
     * При reload срабатывает beforeunload → saveProgress() → saveGame(),
     * который безусловно ставит timestamp = Date.now(), затирая подменённое значение.
     * Поэтому вместо reload вызываем loadProgress() напрямую.
     */
    simulateOffline: (minutes: number = 30) => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) { console.error('❌ Нет сохранения в localStorage'); return }
      const data = JSON.parse(raw)
      data.timestamp = Date.now() - minutes * 60 * 1000
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      // Загружаем прогресс напрямую — beforeunload не затрёт timestamp
      store.getState().loadProgress()
      console.log(`✅ Симуляция: ${minutes} мин отсутствия. Модалка должна появиться.`)
    },

    // --- Справка ---
    help: () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║             🔧 ГАРАЖ 2007 — DEV CONSOLE 🔧              ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  📊 ИНФОРМАЦИЯ                                          ║
║  game.state()            — полное состояние              ║
║  game.info()             — краткая таблица                ║
║  game.showSave()         — содержимое localStorage        ║
║                                                          ║
║  🔄 СБРОС                                               ║
║  game.reset()            — полный сброс (store + storage) ║
║  game.clearStorage()     — только localStorage            ║
║                                                          ║
║  💰 БАЛАНС И ВАЛЮТА                                     ║
║  game.setBalance(N)      — установить баланс              ║
║  game.addMoney(N)        — добавить N ₽ (default: 10000)  ║
║  game.setNuts(N)         — установить гайки               ║
║  game.setTotalEarned(N)  — установить totalEarned         ║
║                                                          ║
║  🖱️ КЛИКИ                                                ║
║  game.setClickValue(N)   — доход за клик                  ║
║  game.setTotalClicks(N)  — счётчик кликов                 ║
║                                                          ║
║  🏠 ГАРАЖ                                                ║
║  game.setGarageLevel(N)  — уровень 1-20                  ║
║  game.readyForUpgrade()  — баланс = стоимость апгрейда   ║
║                                                          ║
║  👷 РАБОТНИКИ И АПГРЕЙДЫ                                ║
║  game.setPassiveIncome(N)                                ║
║  game.setWorkers(type, count)   — все 5 типов            ║
║    types: apprentice, mechanic, master,                  ║
║           brigadier, director                            ║
║  game.setUpgradeLevel('clickPower'|'workSpeed', level)   ║
║  game.buyUpgrade(5|10|15|20) — milestone-апгрейд гаража  ║
║                                                          ║
║  💾 СОХРАНЕНИЕ                                           ║
║  game.save()             — принудительное сохранение      ║
║  game.simulateOffline(N) — симуляция N мин оффлайна      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
      `)
    },
  };

  (window as any).game = game

  console.log('🔧 DEV: Консольные инструменты доступны через window.game')
  console.log('🔧 Введите game.help() для списка команд')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

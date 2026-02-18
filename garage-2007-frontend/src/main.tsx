import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore, GARAGE_LEVEL_THRESHOLDS } from './store/gameStore'
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
        'upgrades.clickPower': s.upgrades.clickPower.level,
        'upgrades.workSpeed': s.upgrades.workSpeed.level,
      })
    },

    // --- Полный сброс ---

    /** Полный сброс игры (store + localStorage) */
    reset: () => {
      store.getState().resetGame()
      console.log('✅ Игра полностью сброшена')
    },

    // --- Установка отдельных параметров ---

    /** Установить баланс */
    setBalance: (v: number) => {
      store.setState({ balance: v })
      console.log(`✅ balance = ${v}`)
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
    setWorkers: (type: 'apprentice' | 'mechanic', count: number) => {
      const s = store.getState()
      const worker = s.workers[type]
      if (count < 0 || count > worker.maxCount) {
        console.error(`❌ count должен быть 0-${worker.maxCount}`)
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

    /** Добавить деньги (по умолчанию 10000) */
    addMoney: (amount: number = 10_000) => {
      store.setState((s) => ({
        balance: s.balance + amount,
        totalEarned: s.totalEarned + amount,
      }))
      console.log(`✅ +${amount} ₽ (баланс: ${store.getState().balance})`)
    },

    /** Установить баланс, достаточный для следующего уровня гаража */
    readyForUpgrade: () => {
      const s = store.getState()
      const cost = GARAGE_LEVEL_THRESHOLDS[s.garageLevel]
      if (!cost) { console.log('🏆 Максимальный уровень!'); return }
      store.setState({ balance: cost })
      console.log(`✅ balance = ${cost} (готов к уровню ${s.garageLevel + 1})`)
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

    /** Имитировать оффлайн-доход: установить timestamp сохранения в прошлое */
    simulateOffline: (minutes: number = 30) => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) { console.error('❌ Нет сохранения в localStorage'); return }
      const data = JSON.parse(raw)
      data.timestamp = Date.now() - minutes * 60 * 1000
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      console.log(`✅ Timestamp сдвинут на ${minutes} мин назад. Перезагрузите страницу для проверки оффлайн-дохода.`)
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
║  game.setWorkers('apprentice'|'mechanic', count)         ║
║  game.setUpgradeLevel('clickPower'|'workSpeed', level)   ║
║                                                          ║
║  💾 СОХРАНЕНИЕ                                           ║
║  game.save()             — принудительное сохранение      ║
║  game.simulateOffline(N) — сдвинуть timestamp на N мин   ║
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

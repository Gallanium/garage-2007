import { useGameStore, useBalance, useClickValue, useTotalClicks, useGarageLevel } from './store/gameStore'
import PhaserGame from './game/PhaserGame'

function App() {
  // Получаем данные из store через оптимизированные селекторы
  const balance = useBalance()
  const clickValue = useClickValue()
  const totalClicks = useTotalClicks()
  const garageLevel = useGarageLevel()

  // Получаем действия из store
  const handleClick = useGameStore((state) => state.handleClick)
  const resetGame = useGameStore((state) => state.resetGame)

  // Функция для форматирования чисел с разделителями тысяч
  const formatNumber = (num: number): string => {
    return num.toLocaleString('ru-RU')
  }

  // Названия уровней гаража согласно GDD
  const garageLevelNames: { [key: number]: string } = {
    1: 'Ржавая ракушка',
    2: 'Начало пути',
    3: 'Базовый ремонт',
    4: 'Мастерская',
    5: 'Гараж механика',
  }

  // Временная заглушка для гаек (premium валюта)
  const nuts = 0 // TODO: добавить в store позже

  // Пассивный доход в секунду (пока 0, будет из store)
  const passiveIncomePerSecond = 0 // TODO: рассчитывать из работников

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-800 via-garage-metal to-gray-900 text-white overflow-hidden">

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

        {/* Центр: Название игры (на мобильных может быть скрыто) */}
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

      {/* ========== ЦЕНТРАЛЬНАЯ ОБЛАСТЬ: Phaser Game (60% высоты) ========== */}
      <main className="flex-grow relative bg-gradient-to-b from-gray-800 to-gray-900" style={{ height: '60%' }}>

        {/* Контейнер для Phaser */}
        <div className="w-full h-full flex items-center justify-center">
          <PhaserGame
            onGarageClick={handleClick}
            garageLevel={garageLevel}
          />
        </div>

        {/* Индикатор уровня гаража (overlay поверх Phaser) */}
        <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-garage-rust shadow-lg">
          <p className="text-xs text-gray-400 font-mono">Уровень</p>
          <p className="text-lg font-bold text-white font-mono">
            {garageLevel} • {garageLevelNames[garageLevel] || 'Неизвестно'}
          </p>
        </div>

        {/* Индикатор клика (помощь для игрока) */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2
                        bg-garage-yellow/20 backdrop-blur-sm rounded-full px-4 py-2
                        border border-garage-yellow/50 animate-pulse">
          <p className="text-sm text-garage-yellow font-mono text-center">
            👆 Кликни по гаражу
          </p>
        </div>

      </main>

      {/* ========== НИЖНЯЯ ПАНЕЛЬ: Статистика ========== */}
      <footer className="bg-gray-900/90 backdrop-blur-sm border-t-2 border-garage-rust shadow-2xl">

        {/* Статистика в 3 колонки */}
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
            <p className="text-xs text-gray-400 mb-1 font-mono uppercase">₽/сек</p>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold text-green-300 font-mono">
                {formatNumber(passiveIncomePerSecond)}
              </p>
              <span className="text-xs text-green-300/70 font-mono">₽/с</span>
            </div>
          </div>

        </div>

        {/* Дополнительная информация и кнопки */}
        <div className="px-4 pb-4 flex justify-between items-center">

          {/* Прогресс до следующего уровня (placeholder) */}
          <div className="flex-grow mr-4">
            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-garage-rust to-garage-yellow h-full transition-all duration-500"
                style={{ width: '35%' }} // TODO: рассчитывать реальный прогресс
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              До уровня {garageLevel + 1}: 65%
            </p>
          </div>

          {/* Кнопка сброса (для отладки) */}
          <button
            onClick={resetGame}
            className="bg-red-900/50 hover:bg-red-800/70
                       text-red-300 text-xs font-medium py-2 px-3 rounded
                       transition-colors duration-200
                       border border-red-700/50 font-mono
                       active:scale-95 transform"
            title="Сбросить игру к начальным значениям"
          >
            🔄 Сброс
          </button>

        </div>

      </footer>

      {/* ========== DEBUG INFO (только в dev режиме) ========== */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-2 right-2 bg-black/80 text-green-400 text-xs p-2 rounded font-mono">
          <p>DEV MODE</p>
          <p>Balance: {balance}</p>
          <p>Level: {garageLevel}</p>
          <p>Clicks: {totalClicks}</p>
        </div>
      )}

    </div>
  )
}

export default App

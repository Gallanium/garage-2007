import { useGameStore, useBalance, useClickValue, useTotalClicks, useGarageLevel } from './store/gameStore'

function App() {
  // Получаем данные из store через оптимизированные селекторы
  const balance = useBalance()
  const clickValue = useClickValue()
  const totalClicks = useTotalClicks()
  const garageLevel = useGarageLevel()
  
  // Получаем действия из store
  const handleClick = useGameStore((state) => state.handleClick)
  const resetGame = useGameStore((state) => state.resetGame)

  // Функция для форматирования чисел (добавляет пробелы: 1000 → 1 000)
  const formatMoney = (amount: number): string => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  }

  // Названия уровней гаража согласно GDD
  const garageLevelNames: { [key: number]: string } = {
    1: 'Ржавая ракушка',
    2: 'Начало пути',
    3: 'Базовый ремонт',
    4: 'Мастерская',
    5: 'Гараж механика',
    // Можно добавить остальные позже
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-garage-metal to-gray-900 flex flex-col items-center justify-center p-4">
      {/* Контейнер приложения */}
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        
        {/* Заголовок игры */}
        <header className="bg-garage-blue text-center py-6 px-4 border-b-4 border-garage-rust">
          <h1 className="text-3xl font-bold text-garage-yellow mb-2 drop-shadow-lg">
            🔧 ГАРАЖ 2007 🔧
          </h1>
          <p className="text-sm text-gray-300">
            От ржавой ракушки до элитного автосервиса
          </p>
        </header>

        {/* Основной контент */}
        <div className="p-6 space-y-6">
          
          {/* Панель баланса */}
          <div className="bg-gradient-to-br from-garage-blue to-blue-900 rounded-lg p-6 border-2 border-garage-rust shadow-xl">
            <div className="text-center">
              <p className="text-xs text-gray-300 mb-2 uppercase tracking-wide">Ваш баланс</p>
              <p className="text-5xl font-bold text-garage-yellow drop-shadow-lg">
                {formatMoney(balance)} ₽
              </p>
            </div>
          </div>

          {/* Область клика - главная кнопка */}
          <div className="relative">
            <button
              onClick={handleClick}
              className="w-full bg-gradient-to-br from-garage-rust to-orange-700 
                         hover:from-orange-600 hover:to-orange-800 
                         active:from-orange-800 active:to-orange-900
                         text-white font-bold py-6 px-6 rounded-lg 
                         transition-all duration-150 ease-in-out
                         transform hover:scale-105 active:scale-95
                         shadow-xl hover:shadow-2xl
                         border-2 border-orange-900"
            >
              <span className="text-2xl">🔨 Кликнуть по гаражу 🔨</span>
              <div className="mt-2 text-sm text-orange-200">
                +{formatMoney(clickValue)} ₽ за клик
              </div>
            </button>
            
            {/* Анимированный эффект при наведении */}
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-yellow-600 
                            rounded-lg blur opacity-25 group-hover:opacity-100 
                            transition duration-1000 group-hover:duration-200 -z-10">
            </div>
          </div>

          {/* Статистика игрока */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Доход за клик */}
            <div className="bg-gray-700 rounded-lg p-4 border border-garage-yellow">
              <p className="text-xs text-gray-400 mb-1">Доход за клик</p>
              <p className="text-2xl font-bold text-garage-yellow">
                {formatMoney(clickValue)} ₽
              </p>
            </div>

            {/* Всего кликов */}
            <div className="bg-gray-700 rounded-lg p-4 border border-garage-yellow">
              <p className="text-xs text-gray-400 mb-1">Всего кликов</p>
              <p className="text-2xl font-bold text-garage-yellow">
                {formatMoney(totalClicks)}
              </p>
            </div>

          </div>

          {/* Информация об уровне гаража */}
          <div className="bg-gray-700 rounded-lg p-4 border-l-4 border-garage-rust">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Уровень гаража</p>
                <p className="text-lg font-bold text-white">
                  {garageLevel}. {garageLevelNames[garageLevel] || 'Неизвестно'}
                </p>
              </div>
              <div className="text-4xl">
                {garageLevel === 1 ? '🏚️' : garageLevel <= 5 ? '🔧' : '🏭'}
              </div>
            </div>
          </div>

          {/* Кнопка сброса (для отладки) */}
          <button
            onClick={resetGame}
            className="w-full bg-gray-600 hover:bg-gray-500 
                       text-gray-300 text-sm font-medium py-2 px-4 rounded 
                       transition-colors duration-200
                       border border-gray-500"
          >
            🔄 Сбросить игру (для отладки)
          </button>

        </div>

      </div>

      {/* Футер */}
      <footer className="mt-8 text-center text-xs text-gray-500 space-y-1">
        <p>Версия: MVP 0.1.0 | Разработка: 2026</p>
        <p className="text-gray-600">Zustand Store активен ✓</p>
      </footer>
    </div>
  )
}

export default App
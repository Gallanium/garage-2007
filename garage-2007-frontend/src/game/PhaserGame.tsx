import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { gameConfig } from './gameConfig'
import  MainScene from './MainScene'

/**
 * Пропсы компонента PhaserGame
 */
interface PhaserGameProps {
  /** Коллбэк, вызываемый при клике на гараж */
  onGarageClick: () => void
  
  /** Текущий уровень гаража для синхронизации с Phaser */
  garageLevel: number
}

/**
 * React компонент для интеграции Phaser 3 в приложение
 * 
 * Отвечает за:
 * - Создание и уничтожение инстанса Phaser.Game
 * - Синхронизацию состояния между React и Phaser
 * - Передачу событий из Phaser в React
 * 
 * @param props - свойства компонента
 */
const PhaserGame: React.FC<PhaserGameProps> = ({ onGarageClick, garageLevel }) => {
  // Ref для хранения инстанса Phaser.Game
  const gameRef = useRef<Phaser.Game | null>(null)

  // Ref для div-контейнера, куда Phaser монтирует canvas
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Ref для хранения ссылки на MainScene
  const sceneRef = useRef<MainScene | null>(null)

  // Ref для актуального коллбэка (защита от stale closure в Phaser event)
  const onGarageClickRef = useRef(onGarageClick)
  onGarageClickRef.current = onGarageClick

  // Состояние готовности игры (для скрытия индикатора загрузки)
  const [isGameReady, setIsGameReady] = useState(false)

  /**
   * Эффект инициализации Phaser при монтировании компонента
   */
  useEffect(() => {
    console.log('PhaserGame: Монтирование компонента...')

    // Проверяем, что контейнер готов
    if (!containerRef.current) {
      console.error('PhaserGame: Контейнер не найден!')
      return
    }

    // Проверяем, что игра ещё не создана (защита от двойной инициализации)
    if (gameRef.current) {
      console.warn('PhaserGame: Игра уже создана, пропускаем инициализацию')
      return
    }

    console.log('PhaserGame: Создание инстанса Phaser.Game...')

    // Создаём новый инстанс Phaser.Game
    const game = new Phaser.Game({
      ...gameConfig,
      parent: containerRef.current, // Передаём DOM элемент напрямую
    })

    // Сохраняем инстанс в ref
    gameRef.current = game

    // Ждём, пока сцена будет готова
    game.events.once('ready', () => {
      console.log('PhaserGame: Phaser.Game готов!')

      // Получаем ссылку на MainScene
      const mainScene = game.scene.getScene('MainScene') as MainScene

      if (!mainScene) {
        console.error('PhaserGame: MainScene не найдена!')
        return
      }

      // Сохраняем ссылку на сцену
      sceneRef.current = mainScene

      // ИСПРАВЛЕНИЕ БАГА 1: Устанавливаем игру как готовую только ПОСЛЕ готовности сцены
      setIsGameReady(true)
      console.log('PhaserGame: Игра полностью готова, индикатор загрузки скрыт')

      console.log('PhaserGame: MainScene получена, настраиваем события...')

      // Подписываемся на событие клика по гаражу из Phaser
      mainScene.events.on('garageClicked', (data: any) => {
        console.log('PhaserGame: Получено событие garageClicked из Phaser:', data)

        // Вызываем коллбэк через ref (защита от stale closure)
        onGarageClickRef.current()
      })

      // Подписываемся на событие завершения анимации перехода уровня
      mainScene.events.on('levelTransitionComplete', (data: any) => {
        console.log('PhaserGame: Анимация перехода уровня завершена:', data)
      })

      console.log('PhaserGame: Инициализация завершена успешно!')
    })

    // Cleanup функция при размонтировании компонента
    return () => {
      console.log('PhaserGame: Размонтирование компонента, очистка ресурсов...')

      // Сбрасываем состояние готовности
      setIsGameReady(false)

      // Отписываемся от событий сцены
      if (sceneRef.current) {
        sceneRef.current.events.off('garageClicked')
        sceneRef.current.events.off('levelTransitionComplete')
        sceneRef.current = null
      }

      // Уничтожаем инстанс Phaser
      if (gameRef.current) {
        console.log('PhaserGame: Уничтожение Phaser.Game...')
        gameRef.current.destroy(true) // true = удалить canvas из DOM
        gameRef.current = null
      }

      console.log('PhaserGame: Очистка завершена')
    }
  }, []) // Пустой массив зависимостей = эффект выполняется только при монтировании/размонтировании

  /**
   * Эффект синхронизации уровня гаража с Phaser сценой
   * Срабатывает при изменении garageLevel prop
   */
  useEffect(() => {
    console.log('PhaserGame: Обнаружено изменение garageLevel:', garageLevel)

    // Проверяем, что сцена доступна
    if (!sceneRef.current) {
      console.warn('PhaserGame: Сцена ещё не готова, пропускаем обновление уровня')
      return
    }

    // Вызываем метод обновления уровня у сцены
    console.log('PhaserGame: Обновление уровня гаража в Phaser сцене...')
    sceneRef.current.updateGarageLevel(garageLevel)
    
  }, [garageLevel]) // Эффект выполняется при изменении garageLevel

  /**
   * Рендер контейнера для Phaser canvas
   */
  return (
    <div
      ref={containerRef}
      id="phaser-game-container"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        position: 'relative',
      }}
    >
      {/* Canvas будет автоматически создан Phaser внутри этого div */}
      
      {/* ИСПРАВЛЕНИЕ БАГА 1: Показываем loader только пока игра НЕ готова */}
      {!isGameReady && (
        <div style={{
          position: 'absolute',
          color: '#E6B800',
          fontSize: '18px',
          fontWeight: 'bold',
        }}>
          Загрузка игры...
        </div>
      )}
    </div>
  )
}

export default PhaserGame

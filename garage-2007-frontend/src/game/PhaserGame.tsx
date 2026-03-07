import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { gameConfig } from './gameConfig'
import MainScene from './MainScene'
import type { GarageClickEvent, LevelTransitionEvent } from './types'

/**
 * Пропсы компонента PhaserGame
 */
interface PhaserGameProps {
  /** Коллбэк, вызываемый при клике на гараж */
  onGarageClick: () => void

  /** Текущий уровень гаража для синхронизации с Phaser */
  garageLevel: number

  /** Активна ли вкладка «Игра» (блокирует клики если false) */
  isActive: boolean

  /** Активен ли хотя бы один буст (для свечения в Phaser) */
  hasAnyActiveBoost: boolean
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
const PhaserGame: React.FC<PhaserGameProps> = ({ onGarageClick, garageLevel, isActive, hasAnyActiveBoost }) => {
  // Ref для хранения инстанса Phaser.Game
  const gameRef = useRef<Phaser.Game | null>(null)

  // Ref для div-контейнера, куда Phaser монтирует canvas
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Ref для хранения ссылки на MainScene
  const sceneRef = useRef<MainScene | null>(null)

  // Ref для актуального коллбэка (защита от stale closure в Phaser event)
  const onGarageClickRef = useRef(onGarageClick)
  onGarageClickRef.current = onGarageClick

  // Ref для активности вкладки (блокирует клики, когда вкладка «Игра» неактивна)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // FIX Баг 1: Ref для актуального garageLevel, чтобы синхронизировать при готовности сцены
  const garageLevelRef = useRef(garageLevel)
  garageLevelRef.current = garageLevel

  const hasAnyActiveBoostRef = useRef(hasAnyActiveBoost)
  hasAnyActiveBoostRef.current = hasAnyActiveBoost

  // Состояние готовности игры (для скрытия индикатора загрузки)
  const [isGameReady, setIsGameReady] = useState(false)

  // Состояние ошибки инициализации Phaser
  const [gameError, setGameError] = useState<string | null>(null)

  // Ref для таймаута ready-события
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Эффект инициализации Phaser при монтировании компонента
   */
  useEffect(() => {
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

    // Создаём новый инстанс Phaser.Game с защитой от ошибок
    let game: Phaser.Game
    try {
      game = new Phaser.Game({
        ...gameConfig,
        parent: containerRef.current, // Передаём DOM элемент напрямую
      })
    } catch (error) {
      console.error('PhaserGame: Ошибка инициализации', error)
      setGameError('Не удалось запустить игровой движок')
      return
    }

    // Сохраняем инстанс в ref
    gameRef.current = game

    // Таймаут на случай, если ready-событие не сработает (WebGL не поддерживается)
    readyTimeoutRef.current = setTimeout(() => {
      if (!sceneRef.current) {
        console.error('PhaserGame: Таймаут инициализации (10 сек)')
        setGameError('Игра не загрузилась. Проверьте поддержку WebGL.')
      }
    }, 10_000)

    // Ждём, пока сцена будет готова
    game.events.once('ready', () => {
      // Очищаем таймаут — игра загрузилась успешно
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current)
        readyTimeoutRef.current = null
      }

      // Получаем ссылку на MainScene
      const mainScene = game.scene.getScene('MainScene') as MainScene

      if (!mainScene) {
        console.error('PhaserGame: MainScene не найдена!')
        setGameError('Ошибка загрузки игровой сцены')
        return
      }

      // Сохраняем ссылку на сцену
      sceneRef.current = mainScene

      setIsGameReady(true)

      // FIX Баг 1: Синхронизируем garageLevel сразу после готовности сцены,
      // чтобы визуал соответствовал текущему уровню из store
      if (garageLevelRef.current > 1) {
        mainScene.updateGarageLevel(garageLevelRef.current)
      }

      // Подписываемся на событие клика по гаражу из Phaser
      mainScene.events.on('garageClicked', (_data: GarageClickEvent) => {
        // Блокируем клики, если вкладка «Игра» неактивна
        if (!isActiveRef.current) return
        // Вызываем коллбэк через ref (защита от stale closure)
        onGarageClickRef.current()
      })

      // Подписываемся на событие завершения анимации перехода уровня
      mainScene.events.on('levelTransitionComplete', (_data: LevelTransitionEvent) => {
        // Событие используется для возможных будущих обработок
      })
    })

    // Cleanup функция при размонтировании компонента
    return () => {
      // Очищаем таймаут
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current)
        readyTimeoutRef.current = null
      }

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
        gameRef.current.destroy(true) // true = удалить canvas из DOM
        gameRef.current = null
      }
    }
  }, []) // Пустой массив зависимостей = эффект выполняется только при монтировании/размонтировании

  /**
   * Эффект блокировки ввода Phaser при открытых модалках / неактивном табе.
   * Отключает scene.input чтобы предотвратить визуальные эффекты
   * (bounce, частицы) при кликах сквозь модальные окна.
   */
  useEffect(() => {
    if (!sceneRef.current) return
    sceneRef.current.input.enabled = isActive
  }, [isActive])

  useEffect(() => {
    sceneRef.current?.setBoostActive(hasAnyActiveBoost)
  }, [hasAnyActiveBoost])

  /**
   * Эффект синхронизации уровня гаража с Phaser сценой
   * Срабатывает при изменении garageLevel prop
   */
  useEffect(() => {
    // Проверяем, что сцена доступна
    if (!sceneRef.current) {
      console.warn('PhaserGame: Сцена ещё не готова, пропускаем обновление уровня')
      return
    }

    // Вызываем метод обновления уровня у сцены
    sceneRef.current.updateGarageLevel(garageLevel)

  }, [garageLevel]) // Эффект выполняется при изменении garageLevel

  /**
   * Рендер контейнера для Phaser canvas
   */
  return (
    <div
      ref={containerRef}
      id="phaser-game-container"
      className="w-full h-full max-w-[480px] mx-auto bg-transparent relative"
    >
      {/* Canvas будет автоматически создан Phaser внутри этого div */}

      {/* Показываем loader только пока игра НЕ готова и нет ошибок */}
      {!isGameReady && !gameError && (
        <div className="absolute text-garage-yellow text-sm font-bold font-mono">
          Загрузка...
        </div>
      )}

      {/* Показываем ошибку, если Phaser не смог инициализироваться */}
      {gameError && (
        <div className="absolute text-red-400 text-xs font-bold font-mono text-center p-5">
          {gameError}
        </div>
      )}
    </div>
  )
}

export default PhaserGame

import { useCallback, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { createGameConfig, resolveGameHeight } from './gameConfig'
import MainScene from './MainScene'
import { audioBridge } from '../audio/AudioBridgeService'
import { GAME_DIMENSIONS } from './types'

/** Проверяет что Phaser сцена жива (не уничтожена и не остановлена) */
function isSceneAlive(scene: MainScene): boolean {
  return scene.sys?.displayList != null
}

/**
 * Пропсы компонента PhaserGame
 */
interface PhaserGameProps {
  /** Коллбэк, вызываемый при клике на гараж */
  onGarageClick: (event?: { x: number, y: number }) => void

  /** Текущий уровень гаража для синхронизации с Phaser */
  garageLevel: number

  /** Активна ли вкладка «Игра» (блокирует клики если false) */
  isActive: boolean

  /** Активные декорации для отображения в сцене */
  activeDecorations: string[]

  /** Ref for React → Phaser critical click effect bridge */
  critEffectRef?: React.MutableRefObject<((x: number, y: number) => void) | null>

  /** True when any modal overlay is open — prevents Phaser from processing clicks */
  isModalOpen?: boolean
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
const PhaserGame: React.FC<PhaserGameProps> = ({ onGarageClick, garageLevel, isActive, isModalOpen, activeDecorations, critEffectRef }) => {
  // Ref для хранения инстанса Phaser.Game
  const gameRef = useRef<Phaser.Game | null>(null)

  // Ref для div-контейнера, куда Phaser монтирует canvas
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Ref для хранения ссылки на MainScene
  const sceneRef = useRef<MainScene | null>(null)

  // Ref для актуального коллбэка (защита от stale closure в Phaser event)
  const onGarageClickRef = useRef(onGarageClick)

  // Ref для активности вкладки (блокирует клики, когда вкладка «Игра» неактивна)
  const isActiveRef = useRef(isActive)

  // Ref для флага открытого модального окна (блокирует клики в Phaser при открытых модалках)
  const isModalOpenRef = useRef(isModalOpen ?? false)

  // FIX Баг 1: Ref для актуального garageLevel, чтобы синхронизировать при готовности сцены
  const garageLevelRef = useRef(garageLevel)

  const activeDecorationsRef = useRef(activeDecorations)

  // Состояние готовности игры (для скрытия индикатора загрузки)
  const [isGameReady, setIsGameReady] = useState(false)

  // Состояние ошибки инициализации Phaser
  const [gameError, setGameError] = useState<string | null>(null)

  // Ref для таймаута ready-события
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reportGameError = useCallback((message: string): void => {
    queueMicrotask(() => {
      setGameError(message)
    })
  }, [])

  useEffect(() => {
    onGarageClickRef.current = onGarageClick
  }, [onGarageClick])

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    isModalOpenRef.current = isModalOpen ?? false
  }, [isModalOpen])

  useEffect(() => {
    garageLevelRef.current = garageLevel
  }, [garageLevel])

  useEffect(() => {
    activeDecorationsRef.current = activeDecorations
  }, [activeDecorations])

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
      const containerRect = containerRef.current.getBoundingClientRect()
      const config = createGameConfig(containerRect.height)

      game = new Phaser.Game({
        ...config,
        parent: containerRef.current, // Передаём DOM элемент напрямую
      })
    } catch (error) {
      console.error('PhaserGame: Ошибка инициализации', error)
      reportGameError('Не удалось запустить игровой движок')
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

      // Синхронизируем флаг открытых модалок сразу после готовности сцены
      mainScene.isModalOpen = isModalOpenRef.current

      // Wire up React → Phaser sound bridge
      audioBridge.setSink((key, source) => {
        if (sceneRef.current && isSceneAlive(sceneRef.current)) {
          return sceneRef.current.playSound(key, source)
        }
        return 'rejected'
      })

      // Wire up React → Phaser critical click effect bridge
      if (critEffectRef) {
        critEffectRef.current = (x: number, y: number) => {
          if (sceneRef.current && isSceneAlive(sceneRef.current)) {
            sceneRef.current.playCriticalClickEffect(x, y)
          }
        }
      }

      setIsGameReady(true)

      // Синхронизируем garageLevel сразу после готовности сцены без анимации,
      // чтобы визуал соответствовал текущему уровню из store
      if (garageLevelRef.current > 1) {
        mainScene.setLevelSilently(garageLevelRef.current)
      }

      // Синхронизируем декорации сразу после готовности сцены
      if (activeDecorationsRef.current.length > 0) {
        mainScene.syncGameData({ activeDecorations: activeDecorationsRef.current })
      }

      // Подписываемся на событие клика по гаражу из Phaser
      mainScene.events.on('garageClicked', (event: { x: number, y: number }) => {
        // Блокируем клики, если вкладка «Игра» неактивна
        if (!isActiveRef.current) return
        // Вызываем коллбэк через ref (защита от stale closure)
        onGarageClickRef.current(event)
      })

      // Подписываемся на событие завершения анимации перехода уровня
      mainScene.events.on('levelTransitionComplete', () => {
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

      // Clear sound bridge
      audioBridge.clearSink()

      // Clear critical effect bridge
      if (critEffectRef) {
        critEffectRef.current = null
      }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportGameError]) // Инициализация Phaser при монтировании

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let lastHeight = resolveGameHeight(container.getBoundingClientRect().height)
    const resizeGame = () => {
      if (!gameRef.current) return

      const nextHeight = resolveGameHeight(container.getBoundingClientRect().height)
      if (nextHeight === lastHeight) return

      lastHeight = nextHeight
      gameRef.current.scale.resize(GAME_DIMENSIONS.width, nextHeight)
    }

    const observer = new ResizeObserver(() => {
      resizeGame()
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  /**
   * Эффект блокировки ввода Phaser при открытых модалках / неактивном табе.
   * Отключает scene.input чтобы предотвратить визуальные эффекты
   * (bounce, частицы) при кликах сквозь модальные окна.
   */
  useEffect(() => {
    if (!sceneRef.current || !isSceneAlive(sceneRef.current)) return
    sceneRef.current.input.enabled = isActive
  }, [isActive])

  /**
   * Эффект синхронизации уровня гаража с Phaser сценой
   * Срабатывает при изменении garageLevel prop
   */
  useEffect(() => {
    // Проверяем, что сцена доступна и жива
    if (!sceneRef.current || !isSceneAlive(sceneRef.current)) return

    // Вызываем метод обновления уровня у сцены
    sceneRef.current.updateGarageLevel(garageLevel)

  }, [garageLevel]) // Эффект выполняется при изменении garageLevel

  /**
   * Эффект синхронизации активных декораций с Phaser сценой
   */
  useEffect(() => {
    if (!sceneRef.current || !isSceneAlive(sceneRef.current)) return
    sceneRef.current.syncGameData({ activeDecorations })
  }, [activeDecorations])

  /**
   * Эффект синхронизации флага открытых модалок с Phaser сценой.
   * Позволяет MainScene блокировать клики без DOM-запросов.
   */
  useEffect(() => {
    if (sceneRef.current && isSceneAlive(sceneRef.current)) {
      sceneRef.current.isModalOpen = isModalOpen ?? false
    }
  }, [isModalOpen])

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

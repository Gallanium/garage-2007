import Phaser from 'phaser'
import type { SceneData } from './types'
import {
  GAME_DIMENSIONS,
  DEPTH_LAYERS,
  EFFECT_COLORS,
  ANIMATION_CONFIG,
} from './types'

/**
 * Главная игровая сцена "Гараж 2007"
 * Отвечает за визуализацию гаража и обработку кликов
 */
export default class MainScene extends Phaser.Scene {
  // Спрайт гаража (пока placeholder - прямоугольник)
  private garageSprite?: Phaser.GameObjects.Rectangle

  // Текст уровня на гараже (обновляется в updateGarageLevel)
  private levelText?: Phaser.GameObjects.Text

  // Текущий уровень гаража (1-5)
  private currentLevel: number = 1

  // Контейнер для эффектов частиц
  private particlesContainer?: Phaser.GameObjects.Container
  
  // Цвета для разных уровней гаража
  private readonly LEVEL_COLORS: Record<number, number> = {
    1: 0x8B4513, // Уровень 1: Ржавая ракушка - тёмно-коричневый
    2: 0xA0522D, // Уровень 2: Начало пути - сиена
    3: 0xCD853F, // Уровень 3: Базовый ремонт - перу
    4: 0xDEB887, // Уровень 4: Мастерская - бурливуд
    5: 0xF4A460, // Уровень 5: Гараж механика - песочно-коричневый
  }

  constructor() {
    super({ key: 'MainScene' })
  }

  /**
   * PRELOAD - Загрузка ассетов
   * Пока пустой, позже здесь будут загружаться реальные спрайты
   */
  preload(): void {
    console.log('MainScene: Preload начат...')
    
    // TODO: Загрузка спрайтов гаража
    // this.load.image('garage-level-1', 'assets/sprites/garage-1.png')
    // this.load.image('garage-level-2', 'assets/sprites/garage-2.png')
    // ...
    
    // TODO: Загрузка звуковых эффектов
    // this.load.audio('click-sound', 'assets/sounds/click.mp3')
    // this.load.audio('upgrade-sound', 'assets/sounds/upgrade.mp3')
    
    console.log('MainScene: Preload завершён')
  }

  /**
   * CREATE - Создание игровых объектов
   * Вызывается один раз после загрузки ассетов
   */
  create(): void {
    console.log('MainScene: Create начат...')

    // Создаём контейнер для частиц
    this.particlesContainer = this.add.container(0, 0)
    this.particlesContainer.setDepth(DEPTH_LAYERS.EFFECTS)

    // Создаём временный спрайт гаража (прямоугольник)
    this.createGaragePlaceholder()

    // Подписываемся на события изменения данных
    this.setupEventListeners()

    console.log('MainScene: Create завершён, сцена готова!')
  }

  /**
   * UPDATE - Игровой цикл
   * Вызывается каждый кадр (~60 раз в секунду)
   */
  update(_time: number, _delta: number): void {
    // Пока здесь пусто, позже можно добавить:
    // - Анимации фона
    // - Случайные эффекты
    // - Обновление партиклов
  }

  /**
   * Создание временного прямоугольника вместо спрайта гаража
   */
  private createGaragePlaceholder(): void {
    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2

    // Создаём прямоугольник-плейсхолдер
    this.garageSprite = this.add.rectangle(
      centerX,
      centerY,
      300, // Ширина
      200, // Высота
      this.LEVEL_COLORS[this.currentLevel], // Цвет зависит от уровня
      1.0  // Непрозрачность
    )

    // Устанавливаем глубину (z-index)
    this.garageSprite.setDepth(DEPTH_LAYERS.GARAGE)

    // Добавляем обводку для визуализации границ
    this.garageSprite.setStrokeStyle(3, 0x000000, 0.5)

    // Делаем интерактивным
    this.garageSprite.setInteractive({ useHandCursor: true })

    // Добавляем hover эффект
    this.garageSprite.on('pointerover', () => {
      this.garageSprite?.setAlpha(0.9)
    })

    this.garageSprite.on('pointerout', () => {
      this.garageSprite?.setAlpha(1.0)
    })

    // Обработчик клика
    this.garageSprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleGarageClick(pointer)
    })

    // Добавляем текст с номером уровня (сохраняем ссылку для обновления в updateGarageLevel)
    this.levelText = this.add.text(
      centerX,
      centerY,
      `Уровень ${this.currentLevel}`,
      {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
      }
    )
    this.levelText.setOrigin(0.5)
    this.levelText.setDepth(DEPTH_LAYERS.UI)

    console.log('Placeholder гаража создан для уровня:', this.currentLevel)
  }

  /**
   * Обработчик клика по гаражу
   */
  private handleGarageClick(pointer: Phaser.Input.Pointer): void {
    console.log('Клик по гаражу в точке:', pointer.x, pointer.y)

    // Создаём визуальный эффект в точке клика
    this.createClickEffect(pointer.x, pointer.y)

    // Небольшая анимация "нажатия" самого гаража
    this.tweens.add({
      targets: this.garageSprite,
      scale: 0.95,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    })

    // Отправляем событие в React (через события Phaser)
    // React компонент будет слушать это событие
    this.events.emit('garageClicked', {
      x: pointer.x,
      y: pointer.y,
      timestamp: Date.now(),
    })
  }

  /**
   * Создание визуального эффекта частиц при клике
   * @param x - координата X клика
   * @param y - координата Y клика
   */
  private createClickEffect(x: number, y: number): void {
    const particleCount = Phaser.Math.Between(8, 12) // Случайное количество 8-12

    for (let i = 0; i < particleCount; i++) {
      // Создаём круг-частицу
      const particle = this.add.circle(
        x,
        y,
        Phaser.Math.Between(3, 6), // Случайный радиус 3-6px
        EFFECT_COLORS.money,        // Цвет из констант
        1.0
      )

      // Устанавливаем глубину
      particle.setDepth(DEPTH_LAYERS.EFFECTS)

      // Добавляем в контейнер (для удобства управления)
      this.particlesContainer?.add(particle)

      // Случайный угол разлёта (360 градусов)
      const angle = Phaser.Math.Between(0, 360)
      const distance = Phaser.Math.Between(40, 80)

      // Вычисляем конечную позицию
      const endX = x + Math.cos(Phaser.Math.DegToRad(angle)) * distance
      const endY = y + Math.sin(Phaser.Math.DegToRad(angle)) * distance

      // Анимация разлёта
      this.tweens.add({
        targets: particle,
        x: endX,
        y: endY - 30, // Добавляем подъём вверх
        alpha: 0,     // Исчезновение
        scale: 0.2,   // Уменьшение
        duration: Phaser.Math.Between(400, 600), // Случайная длительность
        ease: 'Cubic.easeOut',
        onComplete: () => {
          particle.destroy() // Удаляем после завершения
        },
      })
    }

    console.log(`Создано ${particleCount} частиц в точке (${x}, ${y})`)
  }

  /**
   * Обновление уровня гаража
   * Вызывается из React когда игрок достигает нового уровня
   * @param level - новый уровень (1-5)
   */
  public updateGarageLevel(level: number): void {
    if (level < 1) {
      console.warn('Недопустимый уровень:', level)
      return
    }

    console.log(`Обновление уровня гаража: ${this.currentLevel} → ${level}`)

    this.currentLevel = level

    if (!this.garageSprite) {
      console.error('Спрайт гаража не найден!')
      return
    }

    // Получаем цвет для уровня (или последний известный)
    const maxDefinedLevel = Math.max(...Object.keys(this.LEVEL_COLORS).map(Number))
    const colorKey = Math.min(level, maxDefinedLevel)
    const newColor = this.LEVEL_COLORS[colorKey]

    // Анимация перехода:
    // 1. Увеличение масштаба
    // 2. Смена цвета
    // 3. Возврат к нормальному масштабу
    this.tweens.add({
      targets: this.garageSprite,
      scale: 1.1,
      duration: ANIMATION_CONFIG.DEFAULT_DURATION,
      ease: ANIMATION_CONFIG.EASING.SMOOTH,
      yoyo: true,
      onStart: () => {
        // Меняем цвет в начале анимации
        this.garageSprite?.setFillStyle(newColor)
      },
      onComplete: () => {
        console.log('Анимация смены уровня завершена')
        
        // Отправляем событие о завершении анимации
        this.events.emit('levelTransitionComplete', { level })
      },
    })

    // Создаём эффект "вспышки" при повышении уровня
    this.createLevelUpEffect()

    // Обновляем текст уровня через сохранённую ссылку
    if (this.levelText) {
      this.levelText.setText(`Уровень ${level}`)
    }
  }

  /**
   * Создание эффекта повышения уровня
   * Визуальная вспышка и партиклы
   */
  private createLevelUpEffect(): void {
    if (!this.garageSprite) return

    const centerX = this.garageSprite.x
    const centerY = this.garageSprite.y

    // Создаём временную вспышку
    const flash = this.add.circle(
      centerX,
      centerY,
      150,
      EFFECT_COLORS.levelUp,
      0.0
    )
    flash.setDepth(DEPTH_LAYERS.EFFECTS)

    // Анимация вспышки
    this.tweens.add({
      targets: flash,
      alpha: 0.7,
      scale: 1.5,
      duration: 200,
      yoyo: true,
      onComplete: () => flash.destroy(),
    })

    // Создаём множество частиц вокруг гаража
    const particleCount = 20
    for (let i = 0; i < particleCount; i++) {
      const angle = (360 / particleCount) * i
      const startDistance = 50
      
      const startX = centerX + Math.cos(Phaser.Math.DegToRad(angle)) * startDistance
      const startY = centerY + Math.sin(Phaser.Math.DegToRad(angle)) * startDistance
      
      const particle = this.add.circle(startX, startY, 4, 0xFFD700, 1.0)
      particle.setDepth(DEPTH_LAYERS.EFFECTS)

      const endDistance = 120
      const endX = centerX + Math.cos(Phaser.Math.DegToRad(angle)) * endDistance
      const endY = centerY + Math.sin(Phaser.Math.DegToRad(angle)) * endDistance

      this.tweens.add({
        targets: particle,
        x: endX,
        y: endY,
        alpha: 0,
        scale: 0.2,
        duration: 800,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      })
    }

    console.log('Эффект повышения уровня создан')
  }

  /**
   * Настройка слушателей событий
   */
  private setupEventListeners(): void {
    // Можно добавить слушателей для событий из React
    // Например, для триггера специальных эффектов
    
    this.events.on('playSpecialEffect', (data: any) => {
      console.log('Получен запрос на спецэффект:', data)
      // TODO: Обработка специальных эффектов
    })
  }

  /**
   * Метод для синхронизации данных из React
   * Вызывается когда нужно обновить визуал на основе состояния игры
   * @param data - данные из React/Zustand store
   */
  public syncGameData(data: SceneData): void {
    console.log('Синхронизация данных сцены:', data)

    // Обновляем уровень, если он изменился
    if (data.garageLevel !== this.currentLevel) {
      this.updateGarageLevel(data.garageLevel)
    }

    // TODO: Можно добавить визуализацию активных бустов
    // TODO: Можно показывать критические клики по-особенному
  }

  /**
   * Cleanup при уничтожении сцены
   */
  shutdown(): void {
    console.log('MainScene: Shutdown вызван')
    
    // Очищаем слушателей событий
    this.events.off('garageClicked')
    this.events.off('playSpecialEffect')
    
    // Уничтожаем контейнеры
    this.particlesContainer?.destroy()
  }
}
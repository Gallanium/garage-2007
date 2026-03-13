// src/game/MainScene.ts
import Phaser from 'phaser'
import type { SceneData, GarageClickEvent } from './types'
import { GarageVisualManager } from './managers/GarageVisualManager'
import { ClickEffectManager } from './managers/ClickEffectManager'
import { LevelUpEffectManager } from './managers/LevelUpEffectManager'

/**
 * Главная игровая сцена «Гараж 2007».
 * Оркестратор: создаёт и соединяет менеджеры, пробрасывает события.
 * Вся логика визуала делегирована managers/*.
 */
export default class MainScene extends Phaser.Scene {
  private garageVisual!: GarageVisualManager
  private clickEffect!: ClickEffectManager
  private levelUpEffect!: LevelUpEffectManager
  private boostGlow: Phaser.GameObjects.Graphics | null = null
  private eventGlow: Phaser.GameObjects.Graphics | null = null

  constructor() {
    super({ key: 'MainScene' })
  }

  preload(): void {
    // TODO: Загрузка спрайтов гаража (Stage: Pixel Art Pipeline)
    // TODO: Загрузка звуковых эффектов (Stage 11)
  }

  create(): void {
    this.garageVisual = new GarageVisualManager(this)
    this.clickEffect = new ClickEffectManager(this)
    this.levelUpEffect = new LevelUpEffectManager(this)

    this.garageVisual.onPointerDown((x, y) => {
      this.garageVisual.playClickBounce()
      this.clickEffect.spawn(this, x, y)
      const event: GarageClickEvent = { x, y, timestamp: Date.now() }
      this.events.emit('garageClicked', event)
    })

    this.events.on('playSpecialEffect', () => {
      // TODO: Обработка специальных эффектов (Stage 8)
    })
  }

  update(): void {
    // Пока пусто — анимации управляются tweens
  }

  /**
   * Обновляет визуал гаража при смене уровня.
   * Вызывается из PhaserGame.tsx.
   */
  public updateGarageLevel(level: number): void {
    this.garageVisual.setLevel(level)
    this.levelUpEffect.play(this, this.garageVisual.center)
  }

  /**
   * Синхронизирует произвольные данные из React.
   * Вызывается из PhaserGame.tsx.
   */
  public syncGameData(data: SceneData): void {
    if (data.garageLevel !== undefined) {
      this.updateGarageLevel(data.garageLevel)
    }
  }

  /**
   * Включает/выключает визуальный индикатор активного буста.
   * Вызывается из PhaserGame.tsx при изменении hasAnyActiveBoost.
   */
  public setBoostActive(isActive: boolean): void {
    if (isActive) {
      if (!this.boostGlow) {
        this.boostGlow = this.add.graphics()
        this.boostGlow.setDepth(15) // между GARAGE(10) и EFFECTS(20)
      }
      // Пульсирующая аура вокруг спрайта гаража
      const pad = 10
      const b = this.garageVisual.bounds
      this.boostGlow.clear()
      this.boostGlow.lineStyle(4, 0xFFAA00, 0.8)
      this.boostGlow.strokeRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2)
      this.tweens.add({
        targets: this.boostGlow,
        alpha: { from: 0.3, to: 0.9 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      if (this.boostGlow) {
        this.tweens.killTweensOf(this.boostGlow)
        this.boostGlow.destroy()
        this.boostGlow = null
      }
    }
  }

  private readonly EVENT_GLOW_COLORS = {
    positive: 0x22C55E,
    negative: 0xEF4444,
    neutral:  0x3B82F6,
  } as const

  /**
   * Включает/выключает визуальный эффект активного случайного события.
   * Цвет зависит от категории: зелёный / красный / синий.
   * Вызывается из PhaserGame.tsx при изменении activeEventCategory.
   */
  public setEventActive(category: 'positive' | 'negative' | 'neutral' | null): void {
    if (category) {
      if (!this.eventGlow) {
        this.eventGlow = this.add.graphics()
        this.eventGlow.setDepth(16) // на 1 выше boost glow
      }
      const color = this.EVENT_GLOW_COLORS[category]
      const pad = 6
      const b = this.garageVisual.bounds
      this.eventGlow.clear()
      this.eventGlow.lineStyle(3, color, 0.7)
      this.eventGlow.strokeRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2)
      this.tweens.killTweensOf(this.eventGlow)
      this.tweens.add({
        targets: this.eventGlow,
        alpha: { from: 0.2, to: 0.7 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      if (this.eventGlow) {
        this.tweens.killTweensOf(this.eventGlow)
        this.eventGlow.destroy()
        this.eventGlow = null
      }
    }
  }

  shutdown(): void {
    this.events.off('garageClicked')
    this.events.off('playSpecialEffect')
    if (this.boostGlow) {
      this.boostGlow.destroy()
      this.boostGlow = null
    }
    if (this.eventGlow) {
      this.eventGlow.destroy()
      this.eventGlow = null
    }
    this.garageVisual.destroy()
    this.clickEffect.destroy()
    this.levelUpEffect.destroy()
  }
}

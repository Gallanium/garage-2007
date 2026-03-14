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

  shutdown(): void {
    this.events.off('garageClicked')
    this.events.off('playSpecialEffect')
    this.garageVisual.destroy()
    this.clickEffect.destroy()
    this.levelUpEffect.destroy()
  }
}

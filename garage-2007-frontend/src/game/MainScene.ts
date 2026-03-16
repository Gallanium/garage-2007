// src/game/MainScene.ts
import Phaser from 'phaser'
import type { SceneData, GarageClickEvent, DecorationRenderData } from './types'
import { DEPTH_LAYERS } from './types'
import { GarageVisualManager } from './managers/GarageVisualManager'
import { ClickEffectManager } from './managers/ClickEffectManager'
import { LevelUpEffectManager } from './managers/LevelUpEffectManager'
import { DecorationManager } from './managers/DecorationManager'
import { DECORATION_CATALOG } from '../store/constants/decorations'

/**
 * Главная игровая сцена «Гараж 2007».
 * Оркестратор: создаёт и соединяет менеджеры, пробрасывает события.
 * Вся логика визуала делегирована managers/*.
 */
export default class MainScene extends Phaser.Scene {
  private garageVisual!: GarageVisualManager
  private clickEffect!: ClickEffectManager
  private levelUpEffect!: LevelUpEffectManager
  private decorationManager!: DecorationManager

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
    this.decorationManager = new DecorationManager(this)

    this.garageVisual.onPointerDown((x, y) => {
      this.garageVisual.playClickBounce()
      this.clickEffect.spawn(this, x, y)
      const event: GarageClickEvent = { x, y, timestamp: Date.now() }
      this.events.emit('garageClicked', event)
    })

    this.events.on('playSpecialEffect', () => {
      // TODO: Обработка специальных эффектов (Stage 8)
    })

    this.events.once('shutdown', () => {
      this.events.off('garageClicked')
      this.events.off('playSpecialEffect')
      this.garageVisual.destroy()
      this.clickEffect.destroy()
      this.levelUpEffect.destroy()
      this.decorationManager.destroy()
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
    if (!this.sys?.displayList) return
    if (data.garageLevel !== undefined && data.garageLevel > 0) {
      this.updateGarageLevel(data.garageLevel)
    }
    if (data.activeDecorations !== undefined) {
      const renderData: DecorationRenderData[] = data.activeDecorations
        .map(id => {
          const def = DECORATION_CATALOG[id]
          if (!def) return null
          const item: DecorationRenderData = {
            id,
            position: def.position,
            size: def.size,
            color: def.color,
            icon: def.icon,
            depth: DEPTH_LAYERS.DECORATIONS as number,
          }
          return item
        })
        .filter((d): d is DecorationRenderData => d !== null)
      this.decorationManager.syncDecorations(renderData)
    }
  }
}

// src/game/MainScene.ts
import Phaser from 'phaser'
import type { SceneData, GarageClickEvent, DecorationRenderData } from './types'
import { DEPTH_LAYERS } from './types'
import { GarageVisualManager } from './managers/GarageVisualManager'
import { ClickEffectManager } from './managers/ClickEffectManager'
import { LevelUpEffectManager } from './managers/LevelUpEffectManager'
import { DecorationManager } from './managers/DecorationManager'
import { AudioManager } from './managers/AudioManager'
import { DECORATION_CATALOG } from '../store/constants/decorations'

/**
 * Главная игровая сцена «Гараж 2007».
 * Оркестратор: создаёт и соединяет менеджеры, пробрасывает события.
 * Вся логика визуала делегирована managers/*.
 */
export default class MainScene extends Phaser.Scene {
  /** Установить в true когда открыто любое модальное окно — блокирует клики в Phaser */
  public isModalOpen = false

  private garageVisual!: GarageVisualManager
  private clickEffect!: ClickEffectManager
  private levelUpEffect!: LevelUpEffectManager
  private decorationManager!: DecorationManager
  private audioManager!: AudioManager

  constructor() {
    super({ key: 'MainScene' })
  }

  preload(): void {
    // TODO: Загрузка спрайтов гаража (Stage: Pixel Art Pipeline)
    // Audio is loaded non-blocking in create() to avoid hanging
    // the preloader in mobile WebViews with suspended AudioContext
  }

  create(): void {
    this.garageVisual = new GarageVisualManager(this)
    this.clickEffect = new ClickEffectManager(this)
    this.levelUpEffect = new LevelUpEffectManager(this)
    this.decorationManager = new DecorationManager(this)
    this.audioManager = new AudioManager(this)
    this.audioManager.loadAndCreate()

    this.garageVisual.onPointerDown((x, y) => {
      if (!this.input.enabled) return
      
      // Блокируем клики если открыто любое модальное окно (флаг синхронизируется из React)
      if (this.isModalOpen) {
        return
      }

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
      this.audioManager.destroy()
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
    this.audioManager.playSfx('level_up')
  }

  /**
   * Устанавливает уровень гаража без анимации и звука.
   * Используется при начальной загрузке, чтобы избежать ложного level-up эффекта.
   */
  public setLevelSilently(level: number): void {
    this.garageVisual.setLevelSilently(level)
  }

  /** Воспроизводит усиленный визуальный эффект критического клика. */
  public playCriticalClickEffect(x: number, y: number): void {
    this.clickEffect.spawnCritical(this, x, y)
  }

  /** Play a sound effect by key — callable from React via PhaserGame bridge */
  public playSound(key: string): void {
    this.audioManager.playSfx(key)
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

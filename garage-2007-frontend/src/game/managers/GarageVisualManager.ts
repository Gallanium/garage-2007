// src/game/managers/GarageVisualManager.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS, ANIMATION_CONFIG } from '../types'
import type { LevelTransitionEvent } from '../types'
import { LEVEL_COLORS } from '../config/garageColors'

/**
 * Управляет визуальным представлением гаража:
 * прямоугольник-плейсхолдер, текст уровня, цвет по уровню,
 * анимация перехода уровня.
 */
export class GarageVisualManager {
  private scene: Phaser.Scene
  private sprite: Phaser.GameObjects.Rectangle
  private levelText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const cx = scene.scale.width / 2
    const cy = scene.scale.height / 2

    this.sprite = scene.add.rectangle(cx, cy, 300, 200, LEVEL_COLORS[1], 1.0)
    this.sprite.setDepth(DEPTH_LAYERS.GARAGE)
    this.sprite.setStrokeStyle(3, 0x000000, 0.5)
    this.sprite.setInteractive({ useHandCursor: true })

    this.sprite.on('pointerover', () => this.sprite.setAlpha(0.9))
    this.sprite.on('pointerout',  () => this.sprite.setAlpha(1.0))

    this.levelText = scene.add.text(cx, cy, 'Ур. 1', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: '"Press Start 2P", cursive',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3,
    })
    this.levelText.setOrigin(0.5)
    this.levelText.setDepth(DEPTH_LAYERS.UI)
  }

  /** Регистрирует обработчик нажатия на спрайт гаража. */
  onPointerDown(callback: (x: number, y: number) => void): void {
    this.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      callback(pointer.x, pointer.y)
    })
  }

  /** Обновляет уровень: меняет цвет и текст, воспроизводит tween перехода. */
  setLevel(level: number): void {
    if (level < 1) {
      console.warn('[GarageVisualManager] Недопустимый уровень:', level)
      return
    }
    const maxDefined = Math.max(...Object.keys(LEVEL_COLORS).map(Number))
    const colorKey = Math.min(level, maxDefined)
    const newColor = LEVEL_COLORS[colorKey]

    this.scene.tweens.add({
      targets: this.sprite,
      scale: 1.1,
      duration: ANIMATION_CONFIG.DEFAULT_DURATION,
      ease: ANIMATION_CONFIG.EASING.SMOOTH,
      yoyo: true,
      onStart: () => this.sprite.setFillStyle(newColor),
      onComplete: () => {
        const event: LevelTransitionEvent = { level }
        this.scene.events.emit('levelTransitionComplete', event)
      },
    })

    this.levelText.setText(`Ур. ${level}`)
  }

  /** Анимация "нажатия" спрайта при клике. */
  playClickBounce(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 0.95,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    })
  }

  /** Центр спрайта — нужен LevelUpEffectManager для радиального взрыва. */
  get center(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y }
  }

  /** Границы спрайта в мировых координатах (без учёта временного tween-масштаба). */
  get bounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.sprite.x - this.sprite.width / 2,
      y: this.sprite.y - this.sprite.height / 2,
      width: this.sprite.width,
      height: this.sprite.height,
    }
  }

  destroy(): void {
    this.sprite.removeAllListeners()
    this.sprite.destroy()
    this.levelText.destroy()
  }
}

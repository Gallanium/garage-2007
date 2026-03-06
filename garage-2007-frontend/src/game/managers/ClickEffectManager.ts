// src/game/managers/ClickEffectManager.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS, EFFECT_COLORS } from '../types'
import { spawnParticles } from '../utils/particles'

/**
 * Создаёт визуальный эффект частиц при каждом клике по гаражу.
 * Инкапсулирует логику, ранее находившуюся в MainScene.createClickEffect().
 */
export class ClickEffectManager {
  private container: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH_LAYERS.EFFECTS)
  }

  /** Воспроизводит взрыв частиц в точке клика (x, y). */
  spawn(scene: Phaser.Scene, x: number, y: number): void {
    spawnParticles({
      scene,
      container: this.container,
      x,
      y,
      count: Phaser.Math.Between(8, 12),
      color: EFFECT_COLORS.money,
      radiusRange: [3, 6],
      distanceRange: [40, 80],
      durationRange: [400, 600],
      riseY: 30,
    })
  }

  destroy(): void {
    this.container.destroy()
  }
}

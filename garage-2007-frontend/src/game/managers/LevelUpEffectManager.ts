// src/game/managers/LevelUpEffectManager.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS, EFFECT_COLORS } from '../types'
import { spawnParticles } from '../utils/particles'

/**
 * Создаёт вспышку и радиальный взрыв частиц при повышении уровня гаража.
 * Инкапсулирует логику, ранее находившуюся в MainScene.createLevelUpEffect().
 */
export class LevelUpEffectManager {
  private container: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0)
    this.container.setDepth(DEPTH_LAYERS.EFFECTS)
  }

  /** Воспроизводит вспышку + радиальный разлёт частиц из точки center. */
  play(scene: Phaser.Scene, center: { x: number; y: number }): void {
    this.spawnFlash(scene, center)
    spawnParticles({
      scene,
      container: this.container,
      x: center.x,
      y: center.y,
      count: 20,
      color: 0xFFD700,
      radiusRange: [4, 4],
      distanceRange: [120, 120],
      durationRange: [800, 800],
      startDistance: 50,
    })
  }

  private spawnFlash(scene: Phaser.Scene, center: { x: number; y: number }): void {
    const flash = scene.add.circle(center.x, center.y, 150, EFFECT_COLORS.levelUp, 0.0)
    flash.setDepth(DEPTH_LAYERS.EFFECTS)
    scene.tweens.add({
      targets: flash,
      alpha: 0.7,
      scale: 1.5,
      duration: 200,
      yoyo: true,
      onComplete: () => flash.destroy(),
    })
  }

  destroy(): void {
    this.container.destroy()
  }
}

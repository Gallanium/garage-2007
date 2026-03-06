// src/game/utils/particles.ts
import Phaser from 'phaser'
import { DEPTH_LAYERS } from '../types'

export interface ParticleConfig {
  scene: Phaser.Scene
  container: Phaser.GameObjects.Container
  x: number
  y: number
  count: number
  color: number
  /** [min, max] радиус круга в px */
  radiusRange: [number, number]
  /** [min, max] дальность разлёта от точки клика в px */
  distanceRange: [number, number]
  /** [min, max] длительность tween в мс */
  durationRange: [number, number]
  /** Смещение вверх при движении (для click particles). По умолчанию 0. */
  riseY?: number
  /**
   * Расстояние начального кольца от центра (для level-up radial burst).
   * Если указан — частицы стартуют по кругу, а не из точки клика.
   */
  startDistance?: number
}

/**
 * Создаёт n кружков-частиц, анимирует их разлёт и уничтожает по завершении.
 * Используется в ClickEffectManager и LevelUpEffectManager.
 */
export function spawnParticles(config: ParticleConfig): void {
  const {
    scene,
    container,
    x,
    y,
    count,
    color,
    radiusRange,
    distanceRange,
    durationRange,
    riseY = 0,
    startDistance,
  } = config

  for (let i = 0; i < count; i++) {
    const angle = startDistance !== undefined
      ? (360 / count) * i          // равномерно по кольцу (level-up)
      : Phaser.Math.Between(0, 360) // случайный (click)

    const startX = startDistance !== undefined
      ? x + Math.cos(Phaser.Math.DegToRad(angle)) * startDistance
      : x
    const startY = startDistance !== undefined
      ? y + Math.sin(Phaser.Math.DegToRad(angle)) * startDistance
      : y

    const radius = Phaser.Math.Between(radiusRange[0], radiusRange[1])
    const distance = Phaser.Math.Between(distanceRange[0], distanceRange[1])
    const duration = Phaser.Math.Between(durationRange[0], durationRange[1])

    const particle = scene.add.circle(startX, startY, radius, color, 1.0)
    particle.setDepth(DEPTH_LAYERS.EFFECTS)
    container.add(particle)

    const endX = x + Math.cos(Phaser.Math.DegToRad(angle)) * distance
    const endY = y + Math.sin(Phaser.Math.DegToRad(angle)) * distance

    scene.tweens.add({
      targets: particle,
      x: endX,
      y: endY - riseY,
      alpha: 0,
      scale: 0.2,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    })
  }
}

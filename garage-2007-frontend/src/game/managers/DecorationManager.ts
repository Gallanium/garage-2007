// src/game/managers/DecorationManager.ts
import Phaser from 'phaser'
import { ANIMATION_CONFIG } from '../types'
import type { DecorationRenderData } from '../types'

/**
 * Управляет визуальным отображением декораций гаража.
 * Паттерн аналогичен GarageVisualManager.
 */
export class DecorationManager {
  private scene: Phaser.Scene
  private containers: Map<string, Phaser.GameObjects.Container>

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.containers = new Map()
  }

  /**
   * Синхронизирует отображаемые декорации с переданным массивом.
   * Удаляет декорации, которых нет в activeData. Добавляет новые.
   */
  syncDecorations(activeData: DecorationRenderData[]): void {
    const activeIds = new Set(activeData.map(d => d.id))

    // Удалить декорации, которых нет в активных (два прохода — без мутации во время итерации)
    const toRemove = [...this.containers.keys()].filter(id => !activeIds.has(id))
    for (const id of toRemove) {
      this.containers.get(id)!.destroy()
      this.containers.delete(id)
    }

    // Добавить новые
    for (const data of activeData) {
      if (!this.containers.has(data.id)) {
        this.createDecoration(data)
      }
    }
  }

  private createDecoration(data: DecorationRenderData): void {
    const container = this.scene.add.container(data.position.x, data.position.y)
    container.setDepth(data.depth)
    container.setAlpha(0)

    const rect = this.scene.add.rectangle(0, 0, data.size.w, data.size.h, data.color, 0.85)
    rect.setStrokeStyle(1, 0x000000, 0.3)

    const fontSize = Math.min(data.size.w, data.size.h) * 0.7
    const text = this.scene.add.text(0, 0, data.icon, {
      fontSize: `${fontSize}px`,
    })
    text.setOrigin(0.5)

    container.add([rect, text])
    this.containers.set(data.id, container)

    // Анимация появления
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: ANIMATION_CONFIG.DEFAULT_DURATION,
      ease: ANIMATION_CONFIG.EASING.SMOOTH,
    })
  }

  destroy(): void {
    for (const container of this.containers.values()) {
      container.destroy()
    }
    this.containers.clear()
  }
}

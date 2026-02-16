import Phaser from 'phaser';
import MainScene from './MainScene';
import { GAME_DIMENSIONS } from './types';

/**
 * ИСПРАВЛЕНИЕ БАГА 2: Убрана строка parent: 'phaser-container'
 * 
 * Причина: parent передается напрямую в PhaserGame.tsx как containerRef.current,
 * а 'phaser-container' не существует в DOM, что вызывало проблемы с позиционированием
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_DIMENSIONS.width,
  height: GAME_DIMENSIONS.height,
  // parent: 'phaser-container', <-- УДАЛЕНО: parent устанавливается в PhaserGame.tsx
  backgroundColor: 'transparent',
  scale: {
  mode: Phaser.Scale.NONE,          // было: FIT
  autoCenter: Phaser.Scale.NO_CENTER,  // было: CENTER_BOTH
},
  scene: [MainScene],
  // Дополнительная настройка для точного позиционирования
  render: {
    pixelArt: true, // Четкий рендеринг pixel art без размытия
    antialias: false,
  },
};
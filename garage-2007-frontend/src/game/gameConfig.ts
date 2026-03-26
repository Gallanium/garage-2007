import Phaser from 'phaser';
import MainScene from './MainScene';
import { GAME_DIMENSIONS } from './types';

export function resolveGameHeight(containerHeight?: number): number {
  return containerHeight
    ? Math.max(GAME_DIMENSIONS.minHeight, Math.min(containerHeight, GAME_DIMENSIONS.maxHeight))
    : GAME_DIMENSIONS.height
}

/** Create Phaser config with dynamic height based on container */
export function createGameConfig(containerHeight?: number): Phaser.Types.Core.GameConfig {
  const height = resolveGameHeight(containerHeight)

  return {
    type: Phaser.AUTO,
    width: GAME_DIMENSIONS.width,
    height,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MainScene],
    render: {
      pixelArt: true,
      antialias: false,
    },
  };
}

// Backward-compatible default export for any code that imports gameConfig directly
export const gameConfig = createGameConfig();

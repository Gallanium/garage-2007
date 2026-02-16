import Phaser from 'phaser';
import MainScene from './MainScene';
import { GAME_DIMENSIONS } from './types';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_DIMENSIONS.width,
  height: GAME_DIMENSIONS.height,
  parent: 'phaser-container',
  backgroundColor: 'transparent',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainScene],
};
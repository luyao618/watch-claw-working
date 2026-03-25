import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { HouseScene } from './scenes/HouseScene'
import { UIScene } from './scenes/UIScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 512,
  height: 512,
  pixelArt: true, // disable anti-aliasing for pixel art
  roundPixels: true,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false,
    },
  },
  scene: [BootScene, HouseScene, UIScene],
}

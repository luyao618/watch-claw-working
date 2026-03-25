import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Asset loading will go here (T0.3)
  }

  create() {
    this.scene.start('HouseScene')
    this.scene.launch('UIScene') // parallel overlay scene
  }
}

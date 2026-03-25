import Phaser from 'phaser'

export class HouseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HouseScene' })
  }

  create() {
    this.add.text(100, 100, 'Watch Claw v1.0 — HouseScene', {
      fontSize: '12px',
      color: '#ffffff',
    })
  }

  update(_time: number, _delta: number) {
    // Game logic will go here
  }
}

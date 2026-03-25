import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // --- Generate placeholder tileset texture (16x16 per tile, 4 tiles in a row) ---
    const tileSize = 16
    const tileCanvas = document.createElement('canvas')
    tileCanvas.width = tileSize * 4
    tileCanvas.height = tileSize
    const tileCtx = tileCanvas.getContext('2d')!
    // Tile 0: empty (transparent)
    // Tile 1: floor (brown)
    tileCtx.fillStyle = '#8B7355'
    tileCtx.fillRect(tileSize * 1, 0, tileSize, tileSize)
    tileCtx.strokeStyle = '#6B5335'
    tileCtx.strokeRect(tileSize * 1, 0, tileSize, tileSize)
    // Tile 2: wall (dark gray)
    tileCtx.fillStyle = '#4a4a5a'
    tileCtx.fillRect(tileSize * 2, 0, tileSize, tileSize)
    // Tile 3: door (lighter)
    tileCtx.fillStyle = '#a89070'
    tileCtx.fillRect(tileSize * 3, 0, tileSize, tileSize)
    this.textures.addCanvas('placeholder-tiles', tileCanvas)

    // --- Generate placeholder character texture (32x32, single frame) ---
    const charCanvas = document.createElement('canvas')
    charCanvas.width = 32
    charCanvas.height = 32
    const charCtx = charCanvas.getContext('2d')!
    // Body
    charCtx.fillStyle = '#4a7ab5'
    charCtx.fillRect(8, 12, 16, 14)
    // Head
    charCtx.fillStyle = '#f0d0a0'
    charCtx.beginPath()
    charCtx.arc(16, 9, 7, 0, Math.PI * 2)
    charCtx.fill()
    // Lobster hat (red)
    charCtx.fillStyle = '#e04040'
    charCtx.fillRect(8, 1, 16, 6)
    // Eyes
    charCtx.fillStyle = '#000'
    charCtx.fillRect(12, 8, 2, 2)
    charCtx.fillRect(18, 8, 2, 2)
    // Feet
    charCtx.fillStyle = '#333'
    charCtx.fillRect(9, 26, 6, 4)
    charCtx.fillRect(17, 26, 6, 4)
    this.textures.addCanvas('placeholder-char', charCanvas)

    // --- Loading bar ---
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const barWidth = 200
    const barHeight = 12
    const barX = (width - barWidth) / 2
    const barY = height / 2

    this.add.rectangle(barX + barWidth / 2, barY, barWidth, barHeight, 0x333333)
    const progressBar = this.add.rectangle(barX, barY, 0, barHeight, 0x4a9eff)
    progressBar.setOrigin(0, 0.5)

    this.add
      .text(width / 2, barY - 20, 'Loading...', {
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      progressBar.width = barWidth * value
    })

    // --- T1.2: Load tilemap and tileset ---
    this.load.tilemapTiledJSON('house', 'assets/tilemaps/house.json')
    this.load.image('interior-tiles', 'assets/tilesets/interior.png')
    this.load.image('furniture-tiles', 'assets/tilesets/furniture.png')

    // --- House background artwork ---
    this.load.image('house-bg', 'assets/house-bg.png')

    // --- T2.2: Load character spritesheet ---
    this.load.spritesheet('lobster', 'assets/character/lobster.png', {
      frameWidth: 32,
      frameHeight: 32,
    })

    // --- T3.2 / T3.3: Load emotion and particle sprites ---
    this.load.spritesheet('emotions', 'assets/ui/emotions.png', {
      frameWidth: 16,
      frameHeight: 16,
    })
    this.load.image('confetti', 'assets/effects/confetti.png')
    this.load.image('zzz', 'assets/effects/zzz.png')
    this.load.image('spark', 'assets/effects/spark.png')

    // --- T4.4: Load audio files ---
    this.load.audio('footstep', 'assets/audio/footstep.ogg')
    this.load.audio('typing', 'assets/audio/typing.ogg')
    this.load.audio('snore', 'assets/audio/snore.ogg')
    this.load.audio('jump', 'assets/audio/jump.ogg')
    this.load.audio('celebrate', 'assets/audio/celebrate.ogg')
    this.load.audio('error', 'assets/audio/error.ogg')
  }

  create() {
    this.scene.start('HouseScene')
    this.scene.launch('UIScene') // parallel overlay scene
  }
}

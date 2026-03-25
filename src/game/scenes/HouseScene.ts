/**
 * HouseScene — main game scene with tilemap, character, physics, and all systems.
 * [T1.2] Tilemap loading
 * [T1.3] Collision layer & physics
 * [T1.4] RoomManager
 * [T2.2] LobsterCharacter
 * [T2.4] FurnitureRenderer
 * [T3.2] EmotionSystem
 * [T3.3] ParticleEffects
 * [T4.4] SoundManager
 * [T5.2] Ladder physics
 * [T5.4] Camera polish & visual effects
 */

import Phaser from 'phaser'
import { LobsterCharacter } from '../characters/LobsterCharacter.ts'
import { RoomManager } from '../systems/RoomManager.ts'
import { EmotionSystem } from '../systems/EmotionSystem.ts'
import { ParticleEffects } from '../systems/ParticleEffects.ts'
import { SoundManager } from '../systems/SoundManager.ts'
import { createEventBus } from '@/utils/eventBus.ts'

// Event types for Phaser → React bridge
type GameEvents = Record<string, unknown> & {
  'character-state-change': {
    state: string
    room: string | null
    emotion: string | null
  }
}

// Singleton event bus for Phaser → React communication
export const gameEventBus = createEventBus<GameEvents>()

export class HouseScene extends Phaser.Scene {
  public character!: LobsterCharacter
  public roomManager!: RoomManager

  private map!: Phaser.Tilemaps.Tilemap
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer
  private emotionSystem!: EmotionSystem
  private particleEffects!: ParticleEffects
  private soundManager!: SoundManager
  private prevState: string = 'idle'
  private isFullHouseView = false
  private isDragging = false
  private oneWayPlatforms: Phaser.Physics.Arcade.StaticGroup | null = null

  constructor() {
    super({ key: 'HouseScene' })
  }

  create() {
    // --- Create tilemap (for collision + object layers only) ---
    const map = this.make.tilemap({ key: 'house' })
    const tileset = map.addTilesetImage('interior', 'interior-tiles')!

    // Create tile layers but hide them — the background art replaces visuals
    const bgLayer = map.createLayer('background', tileset)
    const floorLayer = map.createLayer('floors', tileset)
    const wallLayer = map.createLayer('walls', tileset)
    const fgLayer = map.createLayer('foreground', tileset)
    bgLayer?.setVisible(false)
    floorLayer?.setVisible(false)
    wallLayer?.setVisible(false)
    fgLayer?.setVisible(false)

    // --- House background artwork ---
    if (this.textures.exists('house-bg')) {
      const bg = this.add.image(0, 0, 'house-bg')
      bg.setOrigin(0, 0)
      // Image is 512x512 = exactly matches 32x32 tile map at 16px/tile
      bg.setDepth(-5)
    }

    // --- Collision layer ---
    const collisionLayer = map.createLayer('collision', tileset)
    if (collisionLayer) {
      collisionLayer.setCollisionByExclusion([-1])
      collisionLayer.setVisible(false)
      this.collisionLayer = collisionLayer
    }

    this.map = map

    // --- Physics world bounds ---
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

    // --- Room Manager ---
    this.roomManager = new RoomManager(map)

    // --- Create Character (no programmatic furniture — art has it all) ---
    const spawn = this.roomManager.getSpawnPoint()
    this.character = new LobsterCharacter(this, spawn.x, spawn.y)
    if (this.collisionLayer) {
      this.physics.add.collider(this.character, this.collisionLayer)
    }

    // --- One-way platforms at passage openings ---
    this.setupOneWayPlatforms()

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
    this.cameras.main.setBackgroundColor('#1a1a2e')
    this.cameras.main.startFollow(this.character, true, 0.08, 0.08)
    // Camera dead zone so character can move a bit without camera following
    this.cameras.main.setDeadzone(40, 20)

    // --- Mouse drag to pan camera ---
    this.setupCameraDrag()

    // --- Emotion System ---
    this.emotionSystem = new EmotionSystem(this, this.character)

    // --- Particle Effects ---
    this.particleEffects = new ParticleEffects(this)

    // --- Sound Manager ---
    this.soundManager = new SoundManager(this)

    // --- Keyboard shortcuts ---
    this.setupKeyboardShortcuts()

    // --- Forward character state changes to React event bus ---
    this.events.on(
      'character-state-change',
      (data: {
        state: string
        room: string | null
        emotion: string | null
      }) => {
        gameEventBus.emit('character-state-change', data)
      },
    )

    // --- Day/night tint (T5.4) ---
    this.applyDayNightTint()

    // --- Room name labels ---
    this.addRoomLabels()

    // --- Animated decorations (T5.4) ---
    this.setupAnimatedDecorations()
  }

  update(time: number, delta: number) {
    // Camera drag
    this.updateCameraDrag()

    // Update character
    this.character.update(time, delta)

    // Update emotion bubble position
    this.emotionSystem.update()

    // Track state changes for sound and particle effects
    const currentState = this.character.currentState
    if (currentState !== this.prevState) {
      this.soundManager.onStateChange(currentState)

      // Handle sleep Z's
      if (currentState === 'sleeping') {
        this.particleEffects.startSleepZzz(this.character)
      } else if (this.prevState === 'sleeping') {
        this.particleEffects.stopSleepZzz()
      }

      this.prevState = currentState
    }

    // Update sound manager (for footstep timing)
    this.soundManager.update(currentState, delta)
  }

  // --- Mouse drag to pan camera ---
  private setupCameraDrag(): void {
    this.input.on('pointerdown', () => {
      this.isDragging = true
      this.cameras.main.stopFollow()
    })

    this.input.on('pointerup', () => {
      if (this.isDragging) {
        this.isDragging = false
        // Resume following character after drag ends
        if (!this.isFullHouseView) {
          this.cameras.main.startFollow(this.character, true, 0.08, 0.08)
        }
      }
    })
  }

  // Handle drag in update() for reliable tracking
  private updateCameraDrag(): void {
    if (!this.isDragging) return

    const pointer = this.input.activePointer
    if (!pointer.isDown) {
      this.isDragging = false
      return
    }

    const cam = this.cameras.main
    // worldX/worldY takes zoom into account automatically
    cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
    cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
  }

  /** Resume camera follow (called by 'F' key) */
  private resumeCameraFollow(): void {
    this.isFullHouseView = false
    this.cameras.main.zoomTo(1, 300, 'Sine.easeInOut')
    this.cameras.main.startFollow(this.character, true, 0.08, 0.08)
  }

  // --- One-way platforms: can jump up through, stand on top, press down to drop ---
  private setupOneWayPlatforms(): void {
    this.oneWayPlatforms = this.physics.add.staticGroup()

    // Passage locations — one-way platforms at floor openings
    // 3F-2F left:  cols 8-10  (px 128-175), center x=152
    // 3F-2F right: cols 18-20 (px 288-335), center x=312
    // 2F-1F:       cols 18-20 (px 288-335), center x=312
    // Platforms at row 10 (3F-2F floor, y=160) and row 20 (2F-1F floor, y=320)
    const platforms = [
      { x: 9 * 16, y: 10 * 16 + 8, width: 48, height: 16 }, // 3F-2F left
      { x: 19 * 16, y: 10 * 16 + 8, width: 48, height: 16 }, // 3F-2F right
      { x: 19 * 16, y: 20 * 16 + 8, width: 48, height: 16 }, // 2F-1F
    ]

    for (const p of platforms) {
      const platform = this.add.rectangle(
        p.x,
        p.y,
        p.width,
        p.height,
        0x000000,
        0,
      )
      this.physics.add.existing(platform, true) // static
      const body = platform.body as Phaser.Physics.Arcade.StaticBody
      // Only collide from the top — character can jump through from below
      body.checkCollision.down = false
      body.checkCollision.left = false
      body.checkCollision.right = false
      this.oneWayPlatforms.add(platform)
    }

    // Add collider between character and one-way platforms
    this.physics.add.collider(
      this.character,
      this.oneWayPlatforms,
      undefined,
      (_char, _platform) => {
        // If character is dropping (pressing down), don't collide
        if (this.character.isDropping()) return false
        return true
      },
      this,
    )
  }

  // --- Keyboard Shortcuts ---
  private setupKeyboardShortcuts(): void {
    // 'Z' to toggle full house view (T5.4)
    this.input.keyboard?.on('keydown-Z', () => {
      this.toggleFullHouseView()
    })

    // 'F' to resume camera follow on character
    this.input.keyboard?.on('keydown-F', () => {
      this.resumeCameraFollow()
    })

    // +/- keys for zoom
    this.input.keyboard?.on('keydown-PLUS', () => {
      this.adjustZoom(0.25)
    })
    this.input.keyboard?.on('keydown-MINUS', () => {
      this.adjustZoom(-0.25)
    })
    // Also support = key (same key as + without shift)
    this.input.keyboard?.on('keydown-EQUAL', () => {
      this.adjustZoom(0.25)
    })

    // Mouse wheel zoom
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        this.adjustZoom(deltaY < 0 ? 0.25 : -0.25)
      },
    )
  }

  // --- Camera Zoom ---
  private adjustZoom(delta: number): void {
    if (this.isFullHouseView) return // don't zoom during full-house view
    const cam = this.cameras.main
    const newZoom = Phaser.Math.Clamp(cam.zoom + delta, 0.5, 5)
    cam.zoomTo(newZoom, 150, 'Sine.easeInOut')
  }

  // --- Camera: Toggle full house view (T5.4) ---
  private toggleFullHouseView(): void {
    this.isFullHouseView = !this.isFullHouseView
    const cam = this.cameras.main

    if (this.isFullHouseView) {
      cam.stopFollow()
      // Zoom out to see the whole map
      const zoomX = cam.width / this.map.widthInPixels
      const zoomY = cam.height / this.map.heightInPixels
      const zoom = Math.min(zoomX, zoomY) * 0.95

      cam.pan(
        this.map.widthInPixels / 2,
        this.map.heightInPixels / 2,
        500,
        'Sine.easeInOut',
      )
      cam.zoomTo(zoom, 500, 'Sine.easeInOut')
    } else {
      // Zoom back to normal and follow character
      cam.zoomTo(1, 500, 'Sine.easeInOut')
      this.time.delayedCall(500, () => {
        cam.startFollow(this.character, true, 0.08, 0.08)
      })
    }
  }

  // --- Day/Night Tint (T5.4) ---
  private applyDayNightTint(): void {
    try {
      const hour = new Date().getHours()
      if (hour < 6 || hour > 20) {
        // Night time: blue tint
        const fx = this.cameras.main.postFX?.addColorMatrix()
        if (fx) {
          fx.night(0.3)
        }
      } else if (hour < 8 || hour > 18) {
        // Dawn/dusk: warm tint
        const fx = this.cameras.main.postFX?.addColorMatrix()
        if (fx) {
          fx.saturate(0.1)
        }
      }
    } catch {
      // postFX may not be supported in all renderers
    }
  }

  // --- Room name labels at top-center of each room ---
  private addRoomLabels(): void {
    const labels: Record<string, string> = {
      warehouse: 'Warehouse (Download)',
      study: 'Study (Docs)',
      balcony: 'Balcony (Search)',
      toolbox: 'Toolbox (Execute)',
      office: 'Office (Chat)',
      bedroom: 'Bedroom (Rest)',
      basement: 'Basement (Apps)',
      server_room: 'Server Room (Code)',
      trash: 'Trash (Delete)',
    }

    // Y offset per floor to fine-tune label position
    const floorLabelY: Record<number, number> = {
      3: 20, // 3F: keep
      2: 8, // 2F: keep
      1: -2, // 1F: above the ceiling line
    }

    for (const room of this.roomManager.getAllRooms()) {
      const label = labels[room.id] ?? room.id
      const cx = room.bounds.x + room.bounds.width / 2
      const offsetY = floorLabelY[room.floor] ?? 12
      const cy = room.bounds.y + offsetY

      this.add
        .text(cx, cy, label, {
          fontSize: '8px',
          fontFamily: 'monospace',
          color: '#eeddaa',
          stroke: '#000000',
          strokeThickness: 1,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(30)
    }
  }

  // --- Animated Decorations (T5.4) ---
  // Background art already contains all furniture and decorations.
  // Only keep subtle overlays if needed.
  private setupAnimatedDecorations(): void {
    // No-op: the house-bg.png artwork has all visual details
  }
}

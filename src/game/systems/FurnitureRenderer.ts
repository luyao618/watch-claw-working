/**
 * FurnitureRenderer — draws placeholder furniture in each room using Phaser graphics primitives.
 * [T2.4] Furniture & Room Decoration (Programmatic)
 */

import Phaser from 'phaser'
import type { RoomDef } from './RoomManager.ts'

export class FurnitureRenderer {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  renderAll(rooms: RoomDef[]): void {
    for (const room of rooms) {
      this.renderRoom(room)
      this.renderRoomLabel(room)
    }
  }

  private renderRoom(room: RoomDef): void {
    switch (room.id) {
      case 'workshop':
      case 'toolbox':
        this.renderToolbox(room)
        break
      case 'study':
      case 'office':
        this.renderOffice(room)
        break
      case 'bedroom':
        this.renderBedroom(room)
        break
      case 'warehouse':
        this.renderWarehouse(room)
        break
      case 'balcony':
        this.renderBalcony(room)
        break
      case 'basement':
        this.renderBasement(room)
        break
      case 'server_room':
        this.renderServerRoom(room)
        break
      case 'trash':
        this.renderTrash(room)
        break
      default:
        this.renderGeneric(room)
        break
    }
  }

  private renderToolbox(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Workbench
    this.scene.add
      .rectangle(bx + 40, by + bh - 48, 64, 16, 0x8b6914)
      .setDepth(5)
    // Workbench legs
    this.scene.add.rectangle(bx + 14, by + bh - 36, 4, 20, 0x6b4914).setDepth(5)
    this.scene.add.rectangle(bx + 66, by + bh - 36, 4, 20, 0x6b4914).setDepth(5)

    // Terminal screen (dark with green text glow)
    this.scene.add
      .rectangle(bx + 40, by + bh - 64, 24, 20, 0x1a1a2e)
      .setDepth(5)
    // Green glow
    const glow = this.scene.add
      .rectangle(bx + 40, by + bh - 64, 20, 16, 0x22cc44)
      .setDepth(5)
    glow.setAlpha(0.3)
  }

  private renderOffice(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Desk
    this.scene.add
      .rectangle(bx + 80, by + bh - 48, 80, 12, 0x8b6914)
      .setDepth(5)
    // Desk legs
    this.scene.add.rectangle(bx + 44, by + bh - 36, 4, 20, 0x6b4914).setDepth(5)
    this.scene.add
      .rectangle(bx + 116, by + bh - 36, 4, 20, 0x6b4914)
      .setDepth(5)

    // Computer monitor
    this.scene.add
      .rectangle(bx + 80, by + bh - 64, 28, 22, 0x222233)
      .setDepth(5)
    // Blue screen glow
    const screenGlow = this.scene.add
      .rectangle(bx + 80, by + bh - 64, 24, 18, 0x4488cc)
      .setDepth(5)
    screenGlow.setAlpha(0.4)

    // Office chair
    this.scene.add
      .rectangle(bx + 80, by + bh - 32, 20, 24, 0x4a5a8b)
      .setDepth(3)
  }

  private renderBedroom(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Bed (large blue-white rectangle)
    this.scene.add
      .rectangle(bx + 80, by + bh - 32, 80, 20, 0x6688aa)
      .setDepth(5)
    // Pillow
    this.scene.add
      .rectangle(bx + 48, by + bh - 36, 20, 14, 0xccccdd)
      .setDepth(6)
    // Blanket overlay
    this.scene.add
      .rectangle(bx + 90, by + bh - 32, 50, 16, 0x4466aa)
      .setDepth(6)

    // Nightstand
    this.scene.add
      .rectangle(bx + 130, by + bh - 40, 16, 16, 0x6b4914)
      .setDepth(5)

    // Window (on wall)
    this.scene.add.rectangle(bx + 100, by + 32, 32, 24, 0x88aacc).setDepth(2)
    this.scene.add
      .rectangle(bx + 100, by + 32, 32, 24, 0x444466)
      .setDepth(2)
      .setStrokeStyle(1, 0x666688)
  }

  private renderWarehouse(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Crates
    this.scene.add
      .rectangle(bx + 30, by + bh - 40, 24, 24, 0x8b7355)
      .setDepth(5)
    this.scene.add
      .rectangle(bx + 60, by + bh - 40, 24, 24, 0x9b8365)
      .setDepth(5)
    this.scene.add
      .rectangle(bx + 45, by + bh - 64, 24, 24, 0x7b6345)
      .setDepth(5)

    // Shelf
    this.scene.add
      .rectangle(bx + 120, by + bh - 56, 48, 6, 0x6b4914)
      .setDepth(5)
    this.scene.add
      .rectangle(bx + 120, by + bh - 80, 48, 6, 0x6b4914)
      .setDepth(5)
  }

  private renderBalcony(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Railing
    this.scene.add
      .rectangle(bx + 80, by + bh - 48, 140, 4, 0x888888)
      .setDepth(15)

    // Potted plant
    this.scene.add
      .rectangle(bx + 30, by + bh - 56, 12, 16, 0x228833)
      .setDepth(5)
    this.scene.add
      .rectangle(bx + 30, by + bh - 40, 16, 10, 0x8b5a2b)
      .setDepth(5)
  }

  private renderBasement(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Old computer (CRT)
    this.scene.add
      .rectangle(bx + 50, by + bh - 56, 28, 24, 0x555555)
      .setDepth(5)
    const screen = this.scene.add
      .rectangle(bx + 50, by + bh - 58, 22, 16, 0x225522)
      .setDepth(5)
    screen.setAlpha(0.6)

    // Cables
    const gfx = this.scene.add.graphics()
    gfx.lineStyle(2, 0x333333)
    gfx.lineBetween(bx + 40, by + bh - 28, bx + 90, by + bh - 24)
    gfx.lineBetween(bx + 60, by + bh - 28, bx + 100, by + bh - 20)
    gfx.setDepth(4)
  }

  private renderServerRoom(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Server rack
    this.scene.add
      .rectangle(bx + 80, by + bh - 56, 20, 80, 0x333344)
      .setDepth(5)

    // LED indicators
    for (let i = 0; i < 5; i++) {
      const led = this.scene.add
        .rectangle(bx + 80, by + bh - 88 + i * 12, 4, 4, 0x00ff44)
        .setDepth(6)
      led.setAlpha(0.8)
    }

    // Second rack
    this.scene.add
      .rectangle(bx + 110, by + bh - 56, 20, 80, 0x333344)
      .setDepth(5)
  }

  private renderTrash(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Trash bin
    this.scene.add
      .rectangle(bx + 80, by + bh - 40, 32, 32, 0x555566)
      .setDepth(5)
    // Items sticking out
    this.scene.add.rectangle(bx + 75, by + bh - 60, 8, 12, 0xaa8855).setDepth(6)
    this.scene.add.rectangle(bx + 85, by + bh - 58, 6, 10, 0x8888aa).setDepth(6)
  }

  private renderGeneric(room: RoomDef): void {
    const bx = room.bounds.x
    const by = room.bounds.y
    const bh = room.bounds.height

    // Generic table
    this.scene.add
      .rectangle(bx + 80, by + bh - 48, 48, 12, 0x8b6914)
      .setDepth(5)
  }

  private renderRoomLabel(room: RoomDef): void {
    const bx = room.bounds.x
    const bw = room.bounds.width
    const by = room.bounds.y

    this.scene.add
      .text(bx + bw / 2, by + 8, room.name.toUpperCase(), {
        fontSize: '7px',
        color: '#aaaacc',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 0)
      .setDepth(25)
  }
}

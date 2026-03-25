/**
 * RoomManager — detects which room the character is in, based on Tiled object layers.
 * [T1.4] + [T5.2] ladder zones
 */

import Phaser from 'phaser'

export interface RoomDef {
  id: string
  name: string
  floor: number
  bounds: Phaser.Geom.Rectangle
  activitySpot: { x: number; y: number }
  activityAnim: string
  activityDirection: 'left' | 'right'
}

export class RoomManager {
  private rooms: RoomDef[] = []
  private ladders: Phaser.Geom.Rectangle[] = []
  private spawnPoint: { x: number; y: number } = { x: 240, y: 288 }

  constructor(map: Phaser.Tilemaps.Tilemap) {
    this.parseRoomZones(map)
    this.parseActivitySpots(map)
    this.parseSpawnPoints(map)
    this.parseLadderZones(map)
  }

  private parseRoomZones(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('room_zones')
    if (!layer) {
      console.warn(
        '[RoomManager] No room_zones layer found, using hardcoded fallback',
      )
      this.createFallbackRooms()
      return
    }
    for (const obj of layer.objects) {
      const props = obj.properties as
        | Array<{ name: string; value: unknown }>
        | undefined
      this.rooms.push({
        id: obj.name,
        name: obj.name,
        floor: (props?.find((p) => p.name === 'floor')?.value as number) ?? 2,
        bounds: new Phaser.Geom.Rectangle(
          obj.x!,
          obj.y!,
          obj.width!,
          obj.height!,
        ),
        activitySpot: {
          x: obj.x! + obj.width! / 2,
          y: obj.y! + obj.height! - 32,
        },
        activityAnim: 'idle',
        activityDirection: 'right',
      })
    }
  }

  private parseActivitySpots(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('activity_spots')
    if (!layer) return
    for (const obj of layer.objects) {
      const room = this.rooms.find((r) => r.id === obj.name)
      if (room) {
        room.activitySpot = { x: obj.x!, y: obj.y! }
        const props = obj.properties as
          | Array<{ name: string; value: unknown }>
          | undefined
        room.activityAnim =
          (props?.find((p) => p.name === 'anim')?.value as string) ?? 'idle'
        room.activityDirection =
          (props?.find((p) => p.name === 'direction')?.value as
            | 'left'
            | 'right') ?? 'right'
      }
    }
  }

  private parseSpawnPoints(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('spawn_points')
    if (!layer) return
    const sp = layer.objects.find((o) => o.name === 'player_start')
    if (sp) this.spawnPoint = { x: sp.x!, y: sp.y! }
  }

  private parseLadderZones(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('ladders')
    if (!layer) return
    for (const obj of layer.objects) {
      this.ladders.push(
        new Phaser.Geom.Rectangle(
          obj.x!,
          obj.y!,
          obj.width || 16,
          obj.height || 80,
        ),
      )
    }
  }

  private createFallbackRooms(): void {
    // All 9 rooms across 3 floors, matching the tilemap layout exactly.
    // Room zones from Tiled: each room is 160×160px, arranged in a 3×3 grid.
    //   3F (y=0):   warehouse | study   | balcony
    //   2F (y=176): toolbox   | office  | bedroom
    //   1F (y=352): basement  | server_room | trash
    // Activity spots use the exact coordinates from Tiled activity_spots layer.
    const roomDefs = [
      // 3F — Attic
      {
        id: 'warehouse',
        floor: 3,
        x: 16,
        y: 0,
        w: 160,
        h: 160,
        spotX: 96,
        spotY: 112,
        anim: 'type',
        dir: 'right' as const,
      },
      {
        id: 'study',
        floor: 3,
        x: 176,
        y: 0,
        w: 160,
        h: 160,
        spotX: 256,
        spotY: 112,
        anim: 'think',
        dir: 'right' as const,
      },
      {
        id: 'balcony',
        floor: 3,
        x: 336,
        y: 0,
        w: 160,
        h: 160,
        spotX: 416,
        spotY: 112,
        anim: 'think',
        dir: 'right' as const,
      },
      // 2F — Main Floor
      {
        id: 'toolbox',
        floor: 2,
        x: 16,
        y: 176,
        w: 160,
        h: 160,
        spotX: 96,
        spotY: 288,
        anim: 'type',
        dir: 'right' as const,
      },
      {
        id: 'office',
        floor: 2,
        x: 176,
        y: 176,
        w: 160,
        h: 160,
        spotX: 256,
        spotY: 288,
        anim: 'type',
        dir: 'right' as const,
      },
      {
        id: 'bedroom',
        floor: 2,
        x: 336,
        y: 176,
        w: 160,
        h: 160,
        spotX: 420,
        spotY: 285,
        anim: 'sleep',
        dir: 'left' as const,
      },
      // 1F — Basement
      {
        id: 'basement',
        floor: 1,
        x: 16,
        y: 352,
        w: 160,
        h: 160,
        spotX: 96,
        spotY: 464,
        anim: 'think',
        dir: 'right' as const,
      },
      {
        id: 'server_room',
        floor: 1,
        x: 176,
        y: 352,
        w: 160,
        h: 160,
        spotX: 256,
        spotY: 464,
        anim: 'type',
        dir: 'right' as const,
      },
      {
        id: 'trash',
        floor: 1,
        x: 336,
        y: 352,
        w: 160,
        h: 160,
        spotX: 416,
        spotY: 464,
        anim: 'type',
        dir: 'right' as const,
      },
    ]
    for (const rd of roomDefs) {
      this.rooms.push({
        id: rd.id,
        name: rd.id,
        floor: rd.floor,
        bounds: new Phaser.Geom.Rectangle(rd.x, rd.y, rd.w, rd.h),
        activitySpot: { x: rd.spotX, y: rd.spotY },
        activityAnim: rd.anim,
        activityDirection: rd.dir,
      })
    }
  }

  getCurrentRoom(x: number, y: number): RoomDef | null {
    return this.rooms.find((r) => r.bounds.contains(x, y)) ?? null
  }

  getRoomById(id: string): RoomDef | null {
    return this.rooms.find((r) => r.id === id) ?? null
  }

  getSpawnPoint(): { x: number; y: number } {
    return { ...this.spawnPoint }
  }

  getAllRooms(): RoomDef[] {
    return [...this.rooms]
  }

  getLadderZones(): Phaser.Geom.Rectangle[] {
    return [...this.ladders]
  }

  /** Find the nearest ladder to a given position */
  getNearestLadder(x: number, y: number): Phaser.Geom.Rectangle | null {
    if (this.ladders.length === 0) return null
    let nearest: Phaser.Geom.Rectangle | null = null
    let minDist = Infinity
    for (const ladder of this.ladders) {
      const cx = ladder.x + ladder.width / 2
      const cy = ladder.y + ladder.height / 2
      const dist = Math.abs(cx - x) + Math.abs(cy - y)
      if (dist < minDist) {
        minDist = dist
        nearest = ladder
      }
    }
    return nearest
  }
}

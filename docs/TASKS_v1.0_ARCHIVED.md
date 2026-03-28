# Watch Claw - Task Breakdown (v1.0 — ARCHIVED ✅)

> **Version**: 1.0.0
> **Date**: 2026-03-24
> **Status**: ✅ ALL COMPLETED — Archived on 2026-03-27
> **Audience**: AI coding agent (vibe coding) + human (art assets)
> **Previous tasks**: See [TASKS_v0.2_ARCHIVED.md](./TASKS_v0.2_ARCHIVED.md)
>
> **Note**: This file is archived. v1.0 tasks are all completed. See [TASKS.md](./TASKS.md) for current tasks.
>
> Tasks marked `[AI]` are for AI coding agents to execute directly.
> Tasks marked `[HUMAN]` require human work (art, audio, design) — with exact specifications.

---

## Context for AI Agent

You are working on **Watch Claw**, a Phaser 3 side-view pixel-art game that visualizes an OpenClaw AI agent's real-time working state. The game shows a three-floor house where a lobster-hat character moves between rooms based on the agent's activity.

**Project structure you need to know:**

- `src/connection/` — **DO NOT MODIFY**. This layer handles WebSocket connection to Bridge Server and produces `CharacterAction` objects. It is fully working.
- `src/engine/` — **TO BE DELETED** after migration. Old Canvas 2D renderer.
- `src/world/` — **TO BE DELETED** after migration. Old tilemap and room definitions.
- `src/game/` — **NEW directory you will create**. All Phaser code goes here.
- `src/ui/` — React overlay. `Dashboard.tsx` stays. `CanvasView.tsx` and `ZoomControls.tsx` will be replaced.
- `bridge/server.ts` — **DO NOT MODIFY**. Watches OpenClaw session logs and pushes via WebSocket.
- `electron/` — **DO NOT MODIFY** until T4.4.
- `public/assets/` — Game assets. Human will provide art; you create placeholder programmatic assets.

**Key types from `src/connection/types.ts` (DO NOT CHANGE yet — will be updated in T5.3):**

```typescript
// v0.2 MVP rooms (current code). In T5.3 these will be renamed and expanded.
// For now, reuse these IDs with new room meanings:
//   'workshop' → Toolbox (2F, Execute)
//   'study'    → Office (2F, Chat)
//   'bedroom'  → Bedroom (2F, Rest)
type RoomId = 'workshop' | 'study' | 'bedroom'
type CharacterAction =
  | {
      type: 'GOTO_ROOM'
      room: RoomId
      animation: AnimationId
      emotion: EmotionId
      speed?: 'fast' | 'slow' | 'normal'
    }
  | { type: 'WAKE_UP' }
  | { type: 'GO_SLEEP' }
  | { type: 'CELEBRATE' }
  | { type: 'CONFUSED' }
  | { type: 'RESET' }
```

**The `ConnectionManager` class (in `src/connection/connectionManager.ts`) provides:**

```typescript
cm.onAction((action: CharacterAction) => { ... })       // subscribe to character actions; returns unsubscribe function () => void
cm.onStatusChange((status: ConnectionStatus) => { ... }) // returns unsubscribe function () => void
cm.onEventLog((event: SessionLogEvent) => { ... })       // returns unsubscribe function () => void
cm.session  // { model, provider, sessionId, totalTokens, totalCost }
```

---

## Phase Summary

| Phase | Name                       | AI Tasks | Human Tasks | Scope                                         |
| ----- | -------------------------- | -------- | ----------- | --------------------------------------------- |
| P0    | Phaser Bootstrap           | 3        | 0           | Install Phaser, game config, React mount      |
| P1    | Tilemap & World            | 3        | 1           | Tiled import, collision, room detection       |
| P2    | Character & Physics        | 3        | 1           | Sprite, FSM, physics, auto-navigation         |
| P3    | Event Bridge & Integration | 3        | 1           | Wire connection layer, emotions, particles    |
| P4    | UI & Polish                | 3        | 1           | Dashboard, scaling, sound, Electron           |
| P5    | Three-Floor Expansion      | 3        | 1           | 9 rooms, ladders, full mapping, camera polish |

---

## Phase 0: Phaser Bootstrap

### T0.1 [AI] — Install Phaser & Create Game Config

**Goal**: Set up Phaser 3 in the existing Vite + React + TypeScript project with a blank running game.

**Steps**:

1. Run `pnpm add phaser` to install Phaser 3.

2. Create file `src/game/config.ts`:

```typescript
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { HouseScene } from './scenes/HouseScene'
import { UIScene } from './scenes/UIScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 270,
  zoom: 2, // 2x pixel scaling → 960×540 rendered (top-level, NOT inside scale)
  pixelArt: true, // disable anti-aliasing for pixel art
  roundPixels: true,
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
```

3. Create these stub scene files:

`src/game/scenes/BootScene.ts`:

```typescript
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
```

`src/game/scenes/HouseScene.ts`:

```typescript
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
```

`src/game/scenes/UIScene.ts`:

```typescript
import Phaser from 'phaser'

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' })
  }
  create() {
    // HUD overlay will go here (T3.4)
  }
}
```

4. Create `src/game/index.ts`:

```typescript
export { gameConfig } from './config'
export { BootScene } from './scenes/BootScene'
export { HouseScene } from './scenes/HouseScene'
export { UIScene } from './scenes/UIScene'
```

5. Verify `pnpm dev` starts without errors. The Phaser game won't be mounted yet (that's T0.2), but there should be no TypeScript compilation errors.

**Done when**: `pnpm typecheck` passes and all files above exist.

---

### T0.2 [AI] — PhaserContainer React Component

**Goal**: Replace the old `<CanvasView>` with a React component that mounts and manages the Phaser game lifecycle.

**Steps**:

1. Create `src/ui/PhaserContainer.tsx`:

```typescript
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '@/game'

export interface PhaserContainerHandle {
  getGame(): Phaser.Game | null
}

export const PhaserContainer = forwardRef<PhaserContainerHandle>(
  function PhaserContainer(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const gameRef = useRef<Phaser.Game | null>(null)

    useImperativeHandle(ref, () => ({
      getGame: () => gameRef.current,
    }))

    useEffect(() => {
      if (!containerRef.current || gameRef.current) return

      const game = new Phaser.Game({
        ...gameConfig,
        parent: containerRef.current,
      })
      gameRef.current = game

      return () => {
        game.destroy(true)
        gameRef.current = null
      }
    }, [])

    return (
      <div
        ref={containerRef}
        style={{ flex: 1, minWidth: 0, minHeight: 0, background: '#1a1a2e' }}
      />
    )
  }
)
```

2. Update `src/App.tsx`:
   - Replace `import { CanvasView, ... } from '@/ui'` → import `PhaserContainer` and `PhaserContainerHandle`
   - Remove all references to `GameLoop`, `renderFrame`, `setupCanvas`, `buildWorldState`, old `gameState` (the `useMemo<GameState>` block)
   - Remove the `CanvasView` and `ZoomControls` components from the JSX
   - Keep `ConnectionManager` initialization (the `useEffect` that creates `cm`), `Dashboard`, keyboard shortcuts, session info polling
   - In the JSX, replace the canvas area with `<PhaserContainer ref={phaserRef} />`
   - Store phaserRef: `const phaserRef = useRef<PhaserContainerHandle>(null)`
   - **Important**: Do NOT wire ConnectionManager to Phaser yet (that's T3.1). Just make sure both exist side by side.

3. Delete these files (they are now replaced):
   - `src/ui/CanvasView.tsx`
   - `src/ui/ZoomControls.tsx`

4. Update `src/ui/index.ts` to export `PhaserContainer` instead of `CanvasView` and `ZoomControls`.

**Done when**: `pnpm dev` shows the Phaser game (with "Watch Claw v1.0 — HouseScene" text) on the left, and the Dashboard on the right. No console errors.

---

### T0.3 [AI] — BootScene with Loading Bar

**Goal**: Add a loading progress bar to BootScene, and generate programmatic placeholder assets.

**Steps**:

1. Create a placeholder tileset programmatically. Add to `BootScene.preload()`:

```typescript
preload() {
  // --- Generate placeholder tileset texture (16x16 per tile, 4 tiles in a row) ---
  const tileSize = 16
  const canvas = document.createElement('canvas')
  canvas.width = tileSize * 4
  canvas.height = tileSize
  const ctx = canvas.getContext('2d')!
  // Tile 0: empty (transparent)
  // Tile 1: floor (brown)
  ctx.fillStyle = '#8B7355'
  ctx.fillRect(tileSize * 1, 0, tileSize, tileSize)
  ctx.strokeStyle = '#6B5335'
  ctx.strokeRect(tileSize * 1, 0, tileSize, tileSize)
  // Tile 2: wall (dark gray)
  ctx.fillStyle = '#4a4a5a'
  ctx.fillRect(tileSize * 2, 0, tileSize, tileSize)
  // Tile 3: door (lighter)
  ctx.fillStyle = '#a89070'
  ctx.fillRect(tileSize * 3, 0, tileSize, tileSize)
  this.textures.addCanvas('placeholder-tiles', canvas)

  // --- Generate placeholder character texture (32x32, single frame matching spritesheet frame size) ---
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

  const bgBar = this.add.rectangle(barX + barWidth/2, barY, barWidth, barHeight, 0x333333)
  const progressBar = this.add.rectangle(barX, barY, 0, barHeight, 0x4a9eff)
  progressBar.setOrigin(0, 0.5)

  this.add.text(width / 2, barY - 20, 'Loading...', {
    fontSize: '10px', color: '#ffffff'
  }).setOrigin(0.5)

  this.load.on('progress', (value: number) => {
    progressBar.width = barWidth * value
  })
}
```

2. `create()` stays the same — starts HouseScene and UIScene.

**Done when**: Loading bar appears briefly (even if assets load instantly), then the HouseScene text appears. Both placeholder textures are available to Phaser via `this.textures.get('placeholder-tiles')` and `this.textures.get('placeholder-char')`.

---

## Phase 1: Tilemap & World

### T1.1 [HUMAN] — Create Tileset & Tilemap in Tiled 🎨

> **This task is for the human developer. You need to create art assets and a Tiled map file.**

**What you need to install**:

- [Tiled Map Editor](https://www.mapeditor.org/) (free, all platforms)

**Tileset image to create — `public/assets/tilesets/interior.png`**:

| Spec              | Value                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tile size**     | 16×16 pixels                                                                                                                                                       |
| **Image format**  | PNG with transparency                                                                                                                                              |
| **Art style**     | Pixel art, side-view / cross-section (like a dollhouse cutaway). Warm color palette. Similar to games like "Tiny Room Stories" or "Sheltered" cross-section style. |
| **Pixel density** | 1 pixel = 1 pixel (no anti-aliasing, no gradients, hard edges only)                                                                                                |
| **Color palette** | Max 32 colors. Warm wood tones for floors (#8B7355, #6B5335), cool grays for walls (#4a4a5a), accent colors for special tiles.                                     |

**Tiles needed in the tileset** (minimum):

| Tile # | Name                    | Description                                           |
| ------ | ----------------------- | ----------------------------------------------------- |
| 0      | Empty                   | Fully transparent                                     |
| 1      | Wood floor              | Warm brown planks, side-view showing thickness (~2px) |
| 2      | Stone floor             | Gray stone blocks, for basement                       |
| 3      | Carpet floor            | Soft blue/red carpet tile                             |
| 4      | Interior wall (top)     | Upper portion of wall with molding                    |
| 5      | Interior wall (body)    | Repeatable middle wall section                        |
| 6      | Interior wall (base)    | Wall baseboard                                        |
| 7      | Exterior wall           | Dark brick/stone, house exterior                      |
| 8      | Door frame (top)        | Arched doorway top                                    |
| 9      | Door frame (side)       | Doorway side pillar                                   |
| 10     | Window                  | Glass pane with frame (for exterior walls)            |
| 11     | Stairs (left)           | Ascending left-to-right step                          |
| 12     | Stairs (right)          | Ascending right-to-left step                          |
| 13     | Ladder                  | Vertical ladder rungs                                 |
| 14     | Railing                 | Safety railing for stairs                             |
| 15     | Roof tile (left slope)  | For the house top                                     |
| 16     | Roof tile (right slope) | For the house top                                     |

**Tilemap to create — `public/assets/tilemaps/house.json`**:

| Spec            | Value                                          |
| --------------- | ---------------------------------------------- |
| **Map size**    | 30 tiles wide × 30 tiles tall (480×480 pixels) |
| **Format**      | Tiled JSON export                              |
| **Orientation** | Orthogonal (standard 2D, NOT isometric)        |

**Tile layers needed**:

| Layer name   | Purpose                          | Notes                                                                                                                                                     |
| ------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background` | Exterior walls, sky, house frame | Behind everything                                                                                                                                         |
| `floors`     | All floor surfaces               | One layer for all 3 floors                                                                                                                                |
| `walls`      | Interior walls, room dividers    | Rendered behind character                                                                                                                                 |
| `collision`  | Invisible solid tiles            | Use tile #2 (any tile); set custom property `collides: true`. Mark all solid surfaces: floors, walls, ceilings. **This layer will be hidden at runtime.** |
| `foreground` | Items in front of character      | Desk fronts, table edges, etc.                                                                                                                            |

**Object layers needed**:

| Layer name       | Object type       | What to place                                                                                                                                                  |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spawn_points`   | Point object      | One point named `player_start` at the 2F Office area                                                                                                           |
| `room_zones`     | Rectangle objects | One rectangle per room. Name = room ID (e.g., `toolbox`). Custom property: `floor` (integer: 1, 2, or 3)                                                       |
| `activity_spots` | Point objects     | One point per room where character performs activity. Name = room ID. Custom properties: `anim` (string, e.g. `type`), `direction` (string: `left` or `right`) |
| `ladders`        | Rectangle objects | Vertical zones where character can climb. Name = `ladder`                                                                                                      |

**Floor layout** (MVP — start with 2F only, expand to 3 floors in T5.1):

```
2F Main Floor (10 tiles tall):
┌──────────┬──────────┬──────────┐
│          │          │          │
│  🔧      │  🛋       │  🛏      │
│ Toolbox  │  Office  │ Bedroom  │
│ (exec)   │  (chat)  │ (rest)   │
│          │          │          │
└──────────┴──────────┴──────────┘
  10 tiles    10 tiles   10 tiles
```

**Important Tiled settings**:

- In Tiled, name the tileset exactly **`interior`** (this name is used in code: `map.addTilesetImage('interior', ...)`)
- Set "Tile Width" and "Tile Height" both to 16
- For collision tiles, use `setCollisionByExclusion` — simply paint any non-empty tile in the collision layer; all non-empty tiles will be treated as solid

**Deliverable**: Place these files in the project:

- `public/assets/tilesets/interior.png`
- `public/assets/tilemaps/house.json` (exported from Tiled)
- `public/assets/tilemaps/house.tmx` (Tiled project file, for future editing)

---

### T1.2 [AI] — Load Tilemap in HouseScene

**Goal**: Import the Tiled JSON tilemap (from T1.1) into HouseScene and render all layers.

**Context**: The human has created `public/assets/tilemaps/house.json` and `public/assets/tilesets/interior.png`. If these files don't exist yet, use the placeholder tileset generated in T0.3 and create a simple programmatic tilemap.

**Steps**:

1. Update `BootScene.preload()` to load the tilemap and tileset:

```typescript
// If real assets exist:
this.load.tilemapTiledJSON('house', 'assets/tilemaps/house.json')
this.load.image('interior-tiles', 'assets/tilesets/interior.png')
```

2. Update `HouseScene.create()`:

```typescript
create() {
  // Create tilemap
  const map = this.make.tilemap({ key: 'house' })
  const tileset = map.addTilesetImage('interior', 'interior-tiles')!

  // Create layers (names must match Tiled layer names)
  const bgLayer = map.createLayer('background', tileset)!
  const floorLayer = map.createLayer('floors', tileset)!
  const wallLayer = map.createLayer('walls', tileset)!
  const fgLayer = map.createLayer('foreground', tileset)!

  // Set foreground layer depth above character (character depth = 10)
  fgLayer.setDepth(20)

  // Store reference for physics setup
  this.map = map

  // Set camera bounds to map size
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
  this.cameras.main.setBackgroundColor('#1a1a2e')
}
```

3. Add `private map!: Phaser.Tilemaps.Tilemap` to HouseScene class properties.

4. If tilemap files don't exist yet, create a **fallback**: generate a simple 30×10 tilemap programmatically using `this.make.tilemap({ width: 30, height: 10, tileWidth: 16, tileHeight: 16 })` with the placeholder-tiles texture. Draw a simple floor + walls pattern.

**Done when**: Running `pnpm dev` shows the tilemap rendered in the game area. Rooms are visible (even if using placeholder colored tiles).

---

### T1.3 [AI] — Collision Layer & Physics World

**Goal**: Parse the collision layer from the tilemap and set up Arcade Physics world bounds.

**Steps**:

1. In `HouseScene.create()`, after creating the tilemap layers:

```typescript
// Create collision layer — use setCollisionByExclusion: all non-empty tiles are solid
const collisionLayer = map.createLayer('collision', tileset)
if (collisionLayer) {
  collisionLayer.setCollisionByExclusion([-1]) // every non-empty tile = solid
  collisionLayer.setVisible(false) // hide collision tiles
  this.collisionLayer = collisionLayer
}

// Set world bounds
this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
```

2. Add `private collisionLayer!: Phaser.Tilemaps.TilemapLayer` to HouseScene.

3. Create a temporary test sprite to verify physics:

```typescript
// Temporary test — remove after T2.1
const testSprite = this.physics.add.sprite(160, 0, 'placeholder-char')
testSprite.setBounce(0.1)
testSprite.setCollideWorldBounds(true)
if (this.collisionLayer) {
  this.physics.add.collider(testSprite, this.collisionLayer)
}
this.cameras.main.startFollow(testSprite, true, 0.08, 0.08)

// Arrow key movement for testing
const cursors = this.input.keyboard!.createCursorKeys()
this.events.on('update', () => {
  if (cursors.left.isDown) testSprite.setVelocityX(-100)
  else if (cursors.right.isDown) testSprite.setVelocityX(100)
  else testSprite.setVelocityX(0)
  if (cursors.up.isDown && testSprite.body!.blocked.down)
    testSprite.setVelocityY(-300)
})
```

**Done when**: The test sprite falls with gravity, lands on the floor (collision layer), cannot walk through walls, and can be moved with arrow keys + jump. Remove the test sprite code after confirming it works.

---

### T1.4 [AI] — RoomManager

**Goal**: Create a system that detects which room the character is in, based on Tiled object layers.

**Steps**:

1. Create `src/game/systems/RoomManager.ts`:

```typescript
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
  private spawnPoint: { x: number; y: number } = { x: 160, y: 80 }

  constructor(map: Phaser.Tilemaps.Tilemap) {
    this.parseRoomZones(map)
    this.parseActivitySpots(map)
    this.parseSpawnPoints(map)
  }

  private parseRoomZones(map: Phaser.Tilemaps.Tilemap): void {
    const layer = map.getObjectLayer('room_zones')
    if (!layer) {
      console.warn('[RoomManager] No room_zones layer found')
      return
    }
    for (const obj of layer.objects) {
      this.rooms.push({
        id: obj.name,
        name: obj.name,
        floor:
          (obj.properties?.find((p: any) => p.name === 'floor')
            ?.value as number) ?? 2,
        bounds: new Phaser.Geom.Rectangle(
          obj.x!,
          obj.y!,
          obj.width!,
          obj.height!,
        ),
        activitySpot: {
          x: obj.x! + obj.width! / 2,
          y: obj.y! + obj.height! / 2,
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
        room.activityAnim =
          (obj.properties?.find((p: any) => p.name === 'anim')
            ?.value as string) ?? 'idle'
        room.activityDirection =
          (obj.properties?.find((p: any) => p.name === 'direction')?.value as
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
}
```

2. In `HouseScene.create()`, instantiate RoomManager after creating the tilemap:

```typescript
this.roomManager = new RoomManager(map)
```

3. Add `private roomManager!: RoomManager` to HouseScene.

**Done when**: `RoomManager.getCurrentRoom(x, y)` correctly returns the room at any position. `getSpawnPoint()` returns the player start position. If Tiled object layers don't exist yet, the fallback returns hardcoded room definitions.

---

## Phase 2: Character & Physics

### T2.1 [HUMAN] — Character Spritesheet 🎨

> **This task is for the human developer. Create the character sprite art.**

**Character spritesheet — `public/assets/character/lobster.png`**:

| Spec              | Value                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sprite size**   | 32×32 pixels per frame                                                                                                                                             |
| **Image format**  | PNG with transparency                                                                                                                                              |
| **Art style**     | Pixel art, side-view. Chibi/cute proportions (large head ~40% of height). The character wears a distinctive red lobster-shaped hat (OpenClaw mascot).              |
| **Color palette** | Max 16 colors for the character. Body: blue clothing (#4a7ab5). Head: warm skin (#f0d0a0). Hat: red (#e04040) with darker red claws (#c03030). Shoes: dark (#333). |
| **Layout**        | Horizontal strip. Each animation is a row. All frames in one PNG file.                                                                                             |

**Animations needed** (each row in the spritesheet):

| Row | Animation   | Frames | Frame rate | Loop | Description                                |
| --- | ----------- | ------ | ---------- | ---- | ------------------------------------------ |
| 0   | `idle`      | 4      | 6 fps      | yes  | Slight breathing motion. Arms at sides.    |
| 1   | `walk`      | 6      | 10 fps     | yes  | Walking cycle. Arms swing. Legs step.      |
| 2   | `jump`      | 3      | 8 fps      | no   | Crouch → rise → airborne pose.             |
| 3   | `type`      | 4      | 8 fps      | yes  | Seated, arms move over keyboard.           |
| 4   | `sleep`     | 2      | 2 fps      | yes  | Lying down, gentle breathing. Eyes closed. |
| 5   | `think`     | 4      | 4 fps      | yes  | Standing, hand on chin, looking up.        |
| 6   | `celebrate` | 4      | 8 fps      | yes  | Jumping with arms up, happy face.          |
| 7   | `climb`     | 4      | 8 fps      | yes  | Climbing motion on ladder.                 |

**Total spritesheet size**: 192×256 pixels (6 frames wide × 8 rows tall, each frame 32×32)

> **Tip**: You can use [Aseprite](https://www.aseprite.org/) ($20) or [LibreSprite](https://libresprite.github.io/) (free) or [Piskel](https://www.piskelapp.com/) (free, web-based) to create pixel art spritesheets.
>
> **Alternative**: Search [itch.io](https://itch.io/game-assets/free/tag-pixel-art/tag-character) for a free platformer character spritesheet and modify it to add the lobster hat. Look for "tiny character" or "chibi platformer" style.

**Deliverable**: `public/assets/character/lobster.png`

---

### T2.2 [AI] — LobsterCharacter Sprite & Physics

**Goal**: Create the main character class with Arcade Physics, load the spritesheet, and set up basic movement.

**Context**: The character spritesheet is at `public/assets/character/lobster.png` (32×32 frames, 6 columns × 8 rows). If it doesn't exist yet, use the `placeholder-char` texture from T0.3.

**Steps**:

1. Update `BootScene.preload()` to load the character spritesheet:

```typescript
if (/* real asset exists */) {
  this.load.spritesheet('lobster', 'assets/character/lobster.png', {
    frameWidth: 32, frameHeight: 32,
  })
} // else: placeholder-char from T0.3 is already available
```

2. Create `src/game/characters/LobsterCharacter.ts`:

```typescript
import Phaser from 'phaser'

export class LobsterCharacter extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private autoNavTarget: { x: number; y: number } | null = null
  private targetState: string | null = null
  private targetEmotion: string | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Use real spritesheet if available, else placeholder
    const textureKey = scene.textures.exists('lobster')
      ? 'lobster'
      : 'placeholder-char'
    super(scene, x, y, textureKey)

    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Physics body configuration
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(14, 24) // hitbox smaller than sprite
    body.setOffset(9, 8) // center the hitbox
    body.setMaxVelocity(160, 400)
    body.setDrag(800, 0)
    body.setBounce(0)
    body.setCollideWorldBounds(true)

    this.setDepth(10) // above floors/walls, below foreground

    // Create animations
    this.createAnimations()

    // Keyboard input (for debug / manual control)
    this.cursors = scene.input.keyboard!.createCursorKeys()
  }

  private createAnimations(): void {
    const scene = this.scene
    const key = this.texture.key

    if (key === 'placeholder-char') {
      // No animation for placeholder — it's a single frame
      return
    }

    const anims: Array<{
      key: string
      row: number
      frames: number
      rate: number
      loop: boolean
    }> = [
      { key: 'idle', row: 0, frames: 4, rate: 6, loop: true },
      { key: 'walk', row: 1, frames: 6, rate: 10, loop: true },
      { key: 'jump', row: 2, frames: 3, rate: 8, loop: false },
      { key: 'type', row: 3, frames: 4, rate: 8, loop: true },
      { key: 'sleep', row: 4, frames: 2, rate: 2, loop: true },
      { key: 'think', row: 5, frames: 4, rate: 4, loop: true },
      { key: 'celebrate', row: 6, frames: 4, rate: 8, loop: true },
      { key: 'climb', row: 7, frames: 4, rate: 8, loop: true },
    ]

    const cols = 6 // frames per row in spritesheet
    for (const a of anims) {
      if (scene.anims.exists(a.key)) continue
      scene.anims.create({
        key: a.key,
        frames: scene.anims.generateFrameNumbers(key, {
          start: a.row * cols,
          end: a.row * cols + a.frames - 1,
        }),
        frameRate: a.rate,
        repeat: a.loop ? -1 : 0,
      })
    }
  }

  update(_time: number, _delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down

    // If auto-navigating, handle that instead of keyboard
    if (this.autoNavTarget) {
      this.updateAutoNav()
      return
    }

    // Manual keyboard control (for testing)
    if (this.cursors.left.isDown) {
      body.setVelocityX(-160)
      this.setFlipX(true)
      if (onGround) this.playAnim('walk')
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(160)
      this.setFlipX(false)
      if (onGround) this.playAnim('walk')
    } else {
      if (onGround) this.playAnim('idle')
    }

    if (this.cursors.up.isDown && onGround) {
      body.setVelocityY(-350)
      this.playAnim('jump')
    }
  }

  private playAnim(key: string): void {
    if (this.scene.anims.exists(key) && this.anims.currentAnim?.key !== key) {
      this.anims.play(key, true)
    }
  }

  // --- Auto-navigation (called by EventBridge) ---
  navigateTo(x: number, y: number, state?: string, emotion?: string): void {
    this.autoNavTarget = { x, y }
    this.targetState = state ?? null
    this.targetEmotion = emotion ?? null
  }

  cancelNavigation(): void {
    this.autoNavTarget = null
    this.targetState = null
    this.targetEmotion = null
  }

  private updateAutoNav(): void {
    if (!this.autoNavTarget) return
    const body = this.body as Phaser.Physics.Arcade.Body
    const dx = this.autoNavTarget.x - this.x
    const threshold = 4 // pixels

    if (Math.abs(dx) > threshold) {
      // Walk toward target
      const speed = 120
      body.setVelocityX(dx > 0 ? speed : -speed)
      this.setFlipX(dx < 0)
      if (body.blocked.down) this.playAnim('walk')
    } else {
      // Arrived
      body.setVelocityX(0)
      this.x = this.autoNavTarget.x

      // Transition to target state
      if (this.targetState) {
        this.playAnim(this.targetState)
      } else {
        this.playAnim('idle')
      }

      this.autoNavTarget = null
      this.targetState = null
      this.targetEmotion = null
    }
  }
}
```

3. In `HouseScene.create()`, replace the test sprite with LobsterCharacter:

```typescript
const spawn = this.roomManager.getSpawnPoint()
this.character = new LobsterCharacter(this, spawn.x, spawn.y)
this.physics.add.collider(this.character, this.collisionLayer)
this.cameras.main.startFollow(this.character, true, 0.08, 0.08)
```

4. In `HouseScene.update()`:

```typescript
update(time: number, delta: number) {
  this.character.update(time, delta)
}
```

**Done when**: Character stands on the floor, walks left/right with arrow keys, jumps with up arrow, plays animations (or stays static with placeholder). Camera follows.

---

### T2.3 [AI] — Character FSM & Auto-Navigation

**Goal**: Implement the full state machine and the `handleCharacterAction()` method that will be called by EventBridge.

**Steps**:

1. Add a `currentState` property and state machine to `LobsterCharacter`:

```typescript
export type LobsterState =
  | 'idle' | 'walking' | 'jumping' | 'typing' | 'thinking'
  | 'sleeping' | 'celebrating' | 'climbing'

// In the class:
private _state: LobsterState = 'idle'
private idleTimer = 0
private readonly IDLE_SLEEP_THRESHOLD = 30 // seconds

get currentState(): LobsterState { return this._state }

setState(newState: LobsterState): void {
  if (this._state === newState) return
  this._state = newState
  this.idleTimer = 0

  // Play animation for this state
  this.playAnim(newState === 'walking' ? 'walk' : newState === 'jumping' ? 'jump' : newState)

  // Physics changes per state
  const body = this.body as Phaser.Physics.Arcade.Body
  if (newState === 'climbing') {
    body.setAllowGravity(false) // disable gravity for ladder climbing
  } else {
    body.setAllowGravity(true)
  }
}
```

2. Add `handleCharacterAction()` — this is the main entry point for the EventBridge:

```typescript
handleCharacterAction(action: CharacterAction): void {
  switch (action.type) {
    case 'GOTO_ROOM': {
      // Get the room manager from the scene
      const scene = this.scene as HouseScene
      const room = scene.roomManager.getRoomById(action.room)
      if (!room) { console.warn(`Unknown room: ${action.room}`); return }
      this.navigateTo(room.activitySpot.x, room.activitySpot.y, action.animation, action.emotion)
      this.setState('walking')
      break
    }
    case 'WAKE_UP':
      if (this._state === 'sleeping') {
        this.setState('idle')
      }
      break
    case 'GO_SLEEP': {
      const scene = this.scene as HouseScene
      const bedroom = scene.roomManager.getRoomById('bedroom')
      if (bedroom) {
        this.navigateTo(bedroom.activitySpot.x, bedroom.activitySpot.y, 'sleep', 'sleepy')
        this.setState('walking')
      }
      break
    }
    case 'CELEBRATE':
      this.setState('celebrating')
      break
    case 'CONFUSED':
      // Show confused emotion without changing room
      this.scene.events.emit('show-emotion', 'confused')
      break
    case 'RESET':
      this.cancelNavigation()
      const scene2 = this.scene as HouseScene
      const bed = scene2.roomManager.getRoomById('bedroom')
      if (bed) {
        this.setPosition(bed.activitySpot.x, bed.activitySpot.y)
      }
      this.setState('sleeping')
      break
  }
}
```

3. Update `updateAutoNav()` to call `setState()` on arrival instead of just playing animation.

4. Add idle timer logic in `update()`: if character is idle for more than 30 seconds, automatically dispatch `GO_SLEEP`.

**Done when**: You can manually call `character.handleCharacterAction({ type: 'GOTO_ROOM', room: 'bedroom', animation: 'sleep', emotion: 'sleepy' })` from browser console and the character walks to the bedroom and lies down.

---

### T2.4 [AI] — Furniture & Room Decoration (Programmatic)

**Goal**: Add placeholder furniture to each room so they're visually distinct, using Phaser graphics primitives. These will be replaced with real art assets later.

**Steps**:

1. Create `src/game/systems/FurnitureRenderer.ts`:
   - For each room, draw simple colored rectangles representing furniture
   - **Toolbox (2F)**: Workbench (brown rectangle), terminal screen (dark rectangle with green text glow)
   - **Office (2F)**: Desk (brown), computer monitor (dark + blue glow), office chair (blue rectangle)
   - **Bedroom (2F)**: Bed (large blue-white rectangle), nightstand (small brown), window (light blue rectangle on wall)
   - Use `this.add.rectangle()` and `this.add.graphics()` in HouseScene
   - Set depths correctly: furniture behind character (depth 5), some items in front (depth 15)

2. Add room name labels using Phaser text at the top of each room. Use the built-in monospace font (no custom font needed yet).

**Done when**: Each room has at least 2-3 furniture pieces drawn with colored rectangles. Rooms are visually distinguishable. Room names displayed.

---

## Phase 3: Event Bridge & Integration

### T3.1 [AI] — EventBridge (ConnectionManager → Phaser)

**Goal**: Wire the existing `ConnectionManager` (in `src/connection/`) to dispatch `CharacterAction` events to the Phaser HouseScene.

**Steps**:

1. Create `src/game/systems/EventBridge.ts`:

```typescript
import type { ConnectionManager } from '@/connection/connectionManager'
import type { CharacterAction } from '@/connection/types'
import type { HouseScene } from '../scenes/HouseScene'

export class EventBridge {
  private unsubAction: (() => void) | null = null
  private unsubStatus: (() => void) | null = null

  constructor(
    private cm: ConnectionManager,
    private scene: HouseScene,
  ) {}

  connect(): void {
    this.unsubAction = this.cm.onAction((action: CharacterAction) => {
      // Dispatch to character in the HouseScene
      if (this.scene.character) {
        this.scene.character.handleCharacterAction(action)
      }
    })

    this.unsubStatus = this.cm.onStatusChange((status) => {
      // Emit event for UIScene to display
      this.scene.events.emit('connection-status', status)
    })
  }

  disconnect(): void {
    this.unsubAction?.()
    this.unsubStatus?.()
    this.unsubAction = null
    this.unsubStatus = null
  }
}
```

2. Update `src/ui/PhaserContainer.tsx`:
   - Accept a `connectionManager` prop
   - After Phaser game is created, wait for HouseScene to be ready, then create EventBridge
   - Use `game.scene.getScene('HouseScene')` to get the scene reference
   - Listen for scene 'create' event to know when it's ready

3. Update `src/App.tsx`:
   - Pass `connectionRef.current` to `<PhaserContainer connectionManager={connectionRef.current} />`

4. Make `character` and `roomManager` public on HouseScene so EventBridge can access them.

**Done when**: Start Bridge Server (`pnpm run dev` which runs both vite and bridge), start an OpenClaw session, and verify the character moves to the correct room when tools are called.

---

### T3.2 [AI] — EmotionSystem

**Goal**: Show emotion bubbles above the character.

**Steps**:

1. Create `src/game/systems/EmotionSystem.ts`:
   - Creates a Phaser `Container` positioned above character head
   - Contains a speech bubble background (rounded rectangle via Graphics) and an icon text
   - Emotion map: `{ focused: '💡', thinking: '?', sleepy: '💤', happy: '😊', confused: '❗', curious: '🔍', serious: '⚡', satisfied: '✨' }`
   - `show(emotion: string)`: create/update bubble, set icon, start float tween (`y: -3` to `y: 3`, yoyo, repeat: -1)
   - `hide()`: fade out tween then destroy
   - `update()`: follow character position (x, y - 24)

2. Instantiate EmotionSystem in HouseScene, call `update()` in HouseScene `update()`.

3. Wire to EventBridge: when `GOTO_ROOM` action has emotion, call `emotionSystem.show(action.emotion)`.

**Done when**: Emotion bubble appears above character head when events arrive. Bubble follows character and floats gently.

---

### T3.3 [AI] — Particle Effects

**Goal**: Add particle effects for celebration, error, sleeping.

**Steps**:

1. Create `src/game/systems/ParticleEffects.ts`:
   - `celebration(x, y)`: Colorful confetti using Phaser 3.80+ particle API:
     ```typescript
     const emitter = this.scene.add.particles(x, y, 'confetti', {
       speed: { min: 50, max: 200 },
       angle: { min: 230, max: 310 },
       gravityY: 300,
       lifespan: 1500,
       quantity: 20,
       emitting: false,
     })
     emitter.explode() // one-shot burst
     ```
   - `errorSparks(x, y)`: Red/orange sparks that burst outward:
     ```typescript
     const emitter = this.scene.add.particles(x, y, 'spark', {
       speed: { min: 30, max: 100 },
       angle: { min: 0, max: 360 },
       tint: [0xff4444, 0xff8800],
       lifespan: 800,
       quantity: 10,
       emitting: false,
     })
     emitter.explode()
     ```
   - `sleepZzz(x, y)`: Create Phaser text objects ("z", "Z") that float upward and fade out using tweens.

2. Call these from LobsterCharacter state transitions.

**Done when**: Celebrate state shows confetti. Sleeping shows floating Z's. Error shows sparks.

---

### T3.4 [HUMAN] — Emotion Bubble & Particle Sprites 🎨

> **This task is for the human developer.**

**Emotion bubble spritesheet — `public/assets/ui/emotions.png`**:

| Spec           | Value                                                   |
| -------------- | ------------------------------------------------------- |
| **Frame size** | 16×16 pixels                                            |
| **Layout**     | Horizontal strip, 8 frames                              |
| **Style**      | White speech bubble background with colored icon inside |
| **Art style**  | Pixel art, 1-2px border, minimal detail                 |

| Frame | Emotion   | Icon             | Color            |
| ----- | --------- | ---------------- | ---------------- |
| 0     | focused   | Lightbulb        | Yellow #FFD700   |
| 1     | thinking  | Question mark    | Purple #A855F7   |
| 2     | sleepy    | Moon + Z         | Gray #6B7280     |
| 3     | happy     | Star sparkle     | Green #22C55E    |
| 4     | confused  | Exclamation      | Red #EF4444      |
| 5     | curious   | Magnifying glass | Orange #F59E0B   |
| 6     | serious   | Lightning bolt   | Dark red #DC2626 |
| 7     | satisfied | Checkmark        | Teal #10B981     |

**Particle sprites — `public/assets/effects/`**:

| File           | Size                                          | Description                                      |
| -------------- | --------------------------------------------- | ------------------------------------------------ |
| `confetti.png` | 4×4 pixels, 5 colored squares in a row (20×4) | Red, yellow, green, blue, pink squares           |
| `zzz.png`      | 8×8 pixels                                    | White pixel letter "Z" on transparent background |
| `spark.png`    | 4×4 pixels                                    | Single bright orange/red dot with 1px glow       |

**Deliverable**: Place files in `public/assets/ui/` and `public/assets/effects/`.

---

## Phase 4: UI & Polish

### T4.1 [AI] — Dashboard Update

**Goal**: Update the React Dashboard to show character state alongside Phaser game.

**Steps**:

1. Update `Dashboard.tsx`:
   - Remove any references to old `CharacterState` from `engine/gameState.ts`
   - Accept new props: `characterState?: string`, `currentRoom?: string`, `currentEmotion?: string`
   - Display these in the dashboard panel
   - Keep existing: `connectionStatus`, `sessionInfo`, `events`, `fps`

2. Create a bridge from Phaser → React for dashboard data:
   - In HouseScene, emit events via `eventBus`: `eventBus.emit('character-state-change', { state, room, emotion })`
   - In App.tsx, subscribe to eventBus and update React state for Dashboard props

**Done when**: Dashboard shows current room name, character state, and emotion updating in real-time.

---

### T4.2 [AI] — Pixel-Perfect Scaling

**Goal**: Ensure pixel art renders crisp at all window sizes.

**Steps**:

1. The game config from T0.1 already has `pixelArt: true` and `scale.mode: FIT`. Verify these work.

2. Add Electron minimum window size in `electron/main.cjs`:

```javascript
mainWindow = new BrowserWindow({ width: 960, height: 600, minWidth: 800, minHeight: 600, ... })
```

3. Test that pixels are sharp (no blurring) at 1x and 2x DPI. If blurry, add:

```typescript
canvas.style.imageRendering = 'pixelated'
```

**Done when**: Pixels are crisp, no sub-pixel blurring at any window size.

---

### T4.3 [HUMAN] — Sound Effects 🔊

> **This task is for the human developer.**

**Sound effects needed — place in `public/assets/audio/`**:

| File            | Format     | Duration | Description                             | Where to find                                                               |
| --------------- | ---------- | -------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `footstep.ogg`  | OGG Vorbis | 0.1-0.2s | Soft step on wood floor                 | [freesound.org](https://freesound.org/search/?q=footstep+wood)              |
| `typing.ogg`    | OGG Vorbis | 0.3-0.5s | Mechanical keyboard keypress (2-3 keys) | [freesound.org](https://freesound.org/search/?q=keyboard+typing+mechanical) |
| `snore.ogg`     | OGG Vorbis | 1-2s     | Gentle breathing / light snore          | [freesound.org](https://freesound.org/search/?q=snore+gentle)               |
| `jump.ogg`      | OGG Vorbis | 0.2s     | Soft whoosh / hop sound                 | [freesound.org](https://freesound.org/search/?q=jump+small)                 |
| `celebrate.ogg` | OGG Vorbis | 0.5-1s   | Short happy chime / fanfare             | [freesound.org](https://freesound.org/search/?q=success+chime+8bit)         |
| `error.ogg`     | OGG Vorbis | 0.3s     | Soft alert buzz (not alarming)          | [freesound.org](https://freesound.org/search/?q=error+buzz+soft)            |

> **License**: Only use sounds with **CC0** or **CC-BY** license. OGG Vorbis format preferred (Phaser loads it natively). MP3 also works as fallback.

**Deliverable**: 6 audio files in `public/assets/audio/`.

---

### T4.4 [AI] — Sound System & Electron Integration

**Goal**: Load and play sound effects based on character state changes. Polish Electron wrapper.

**Steps**:

1. In `BootScene.preload()`, load all audio files:

```typescript
this.load.audio('footstep', 'assets/audio/footstep.ogg')
this.load.audio('typing', 'assets/audio/typing.ogg')
// ... etc
```

2. Create `src/game/systems/SoundManager.ts`:
   - Play `footstep` during walking (every 0.3s interval, not every frame)
   - Play `typing` during typing state (loop)
   - Play `snore` during sleeping (loop)
   - Mute toggle: listen for 'M' key
   - If audio files don't exist, silently skip (no errors)

3. Update `electron/main.cjs`:
   - System tray icon
   - Always-on-top toggle
   - Auto-start Bridge Server as child process

**Done when**: Sounds play during state transitions. 'M' key mutes. Electron builds and runs.

---

## Phase 5: Three-Floor Expansion

### T5.1 [HUMAN] — Three-Floor Tilemap & Furniture Art 🎨

> **This task is for the human developer. Expand the tilemap and create furniture art.**

**Expand the Tiled map** (`house.tmx`) to three floors:

```
         ┌──────────────────────────────────────────────┐
  3F     │  📦 仓库(下载)  📚 书房(文档)  🌙 阳台(搜索) │
         ├────────────────────────────────────────────────┤
  2F     │  🔧 工具(执行)  🛋 办公(对话)  🛏 卧室(休息)  │
         ├────────────────────────────────────────────────┤
  1F     │  📱 地下室(应用) 💻 机房(code)  🗑 垃圾桶     │
         └──────────────────────────────────────────────┘
```

**New map size**: 30 tiles wide × 34 tiles tall (each floor ~10 tiles + 2 tiles for floor/ceiling structure)

**Add these elements in Tiled**:

- Ladders or staircases connecting 1F↔2F and 2F↔3F (place in `ladders` object layer as rectangles)
- `room_zones` rectangles for all 9 rooms
- `activity_spots` points for all 9 rooms

**Furniture spritesheet — `public/assets/tilesets/furniture.png`**:

| Spec          | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| **Tile size** | 16×16 pixels                                                   |
| **Style**     | Same pixel art style as interior.png. Side-view cross-section. |

**Furniture tiles needed**:

| Tile # | Name             | Room                | Description                          |
| ------ | ---------------- | ------------------- | ------------------------------------ |
| 0      | Desk             | Office, Study       | Wooden desk surface with legs        |
| 1      | Computer monitor | Office, Server Room | Screen with blue/green glow          |
| 2      | Office chair     | Office              | Swivel chair, side view              |
| 3      | Bed (left half)  | Bedroom             | Pillow + blanket left portion        |
| 4      | Bed (right half) | Bedroom             | Blanket + footboard right portion    |
| 5      | Nightstand       | Bedroom             | Small table with lamp                |
| 6      | Bookshelf (full) | Study               | Packed with colored book spines      |
| 7      | Bookshelf (half) | Study               | Partially filled shelf               |
| 8      | Couch (left)     | Study               | Soft couch left arm                  |
| 9      | Couch (right)    | Study               | Soft couch right arm                 |
| 10     | Server rack      | Server Room         | Tall rack with blinking LEDs         |
| 11     | Workbench        | Toolbox             | Sturdy table with tools on it        |
| 12     | Tool wall        | Toolbox             | Wall-mounted tool pegboard           |
| 13     | Crate/box        | Warehouse           | Wooden crate for downloads           |
| 14     | Shelf with boxes | Warehouse           | Storage shelf                        |
| 15     | Trash bin        | Trash               | Open-top bin with items sticking out |
| 16     | Railing/fence    | Balcony             | Outdoor railing                      |
| 17     | Potted plant     | Balcony             | Outdoor plant                        |
| 18     | Old computer     | Basement            | Retro CRT monitor                    |
| 19     | Cable mess       | Basement            | Tangled cables on floor              |

**Deliverable**:

- Updated `public/assets/tilemaps/house.json` (re-export from Tiled)
- `public/assets/tilesets/furniture.png`

---

### T5.2 [AI] — Ladder Physics & Cross-Floor Navigation

**Goal**: Implement climbing mechanics and auto-navigation across floors.

**Steps**:

1. Parse `ladders` object layer from tilemap in RoomManager:

```typescript
getLadderZones(): Phaser.Geom.Rectangle[] { ... }
```

2. In HouseScene, create invisible overlap zones for each ladder:

```typescript
for (const zone of this.roomManager.getLadderZones()) {
  const ladderZone = this.add.zone(
    zone.x + zone.width / 2,
    zone.y + zone.height / 2,
    zone.width,
    zone.height,
  )
  this.physics.add.existing(ladderZone, true) // static body
  this.physics.add.overlap(this.character, ladderZone, () => {
    this.character.setInLadderZone(true)
  })
}
```

3. Add ladder climbing to LobsterCharacter:
   - Add property `private inLadderZone = false` and setter `setInLadderZone(v: boolean)`
   - **Important**: Reset at the beginning of each `update()`: `this.inLadderZone = false` — the overlap callback will set it back to `true` if still overlapping
   - When `inLadderZone` and up/down pressed: disable gravity, move vertically
   - When leaving zone: re-enable gravity
   - Auto-navigation: if target is on different floor, walk to nearest ladder → climb → walk to target

4. Update auto-navigation to handle multi-floor paths:

```typescript
// Determine if target is on a different floor
// If yes: navigate to ladder X position → climb to correct Y → navigate to target X
```

**Done when**: Character can climb ladders between all 3 floors. Auto-navigation works across floors.

---

### T5.3 [AI] — Full Event Mapping (9 Rooms)

**Goal**: Extend RoomId and EventParser to support all 9 rooms.

**Steps**:

1. Update `src/connection/types.ts` — extend `RoomId`:

```typescript
export type RoomId =
  | 'warehouse'
  | 'study'
  | 'balcony' // 3F
  | 'toolbox'
  | 'office'
  | 'bedroom' // 2F
  | 'basement'
  | 'server_room'
  | 'trash' // 1F
```

2. Update `src/connection/eventParser.ts` — update `TOOL_ROOM_MAP`:

```typescript
const TOOL_ROOM_MAP: Record<string, ToolMapping> = {
  // 1F — Basement
  write: { room: 'server_room', animation: 'type', emotion: 'focused' },
  edit: { room: 'server_room', animation: 'type', emotion: 'focused' },
  process: { room: 'basement', animation: 'type', emotion: 'serious' },
  task: { room: 'basement', animation: 'think', emotion: 'thinking' },
  sessions_spawn: { room: 'basement', animation: 'think', emotion: 'thinking' },

  // 2F — Main Floor
  exec: { room: 'toolbox', animation: 'type', emotion: 'serious' },
  todowrite: { room: 'office', animation: 'type', emotion: 'focused' },

  // 3F — Attic
  read: { room: 'study', animation: 'think', emotion: 'curious' },
  grep: { room: 'study', animation: 'think', emotion: 'curious' },
  glob: { room: 'warehouse', animation: 'type', emotion: 'busy' },
  web_search: { room: 'balcony', animation: 'think', emotion: 'curious' },
}
```

3. Update default tool mapping to go to `office`.

4. Update `parseSessionLogEvent()`:
   - User message → `office` (2F, chat/dialogue)
   - Assistant text streaming → `office` (2F)
   - Session end (`stopReason: 'stop'`) → `bedroom` (2F, sleep)
   - Session start → `office` (2F, wake up)

**Done when**: Each OpenClaw tool call sends the character to the correct room across all 3 floors.

---

### T5.4 [AI] — Camera Polish & Visual Effects

**Goal**: Smooth camera transitions and ambient visual effects.

**Steps**:

1. Camera improvements:
   - When character changes floor, smooth pan the camera (don't snap)
   - Add whole-house zoom-out view toggle (press 'Z' to zoom out and see all 3 floors)
   - Camera dead zone so character can move a bit without camera following

2. Visual polish:
   - Day/night tint: use Phaser 3.80+ post-FX API:
     ```typescript
     const fx = this.cameras.main.postFX.addColorMatrix()
     const hour = new Date().getHours()
     if (hour < 6 || hour > 20) fx.night(0.3) // blue tint at night
     ```
   - Add simple parallax: create a sky/clouds background layer that moves slower than the main camera

3. Animated decorations:
   - Server room LEDs: flickering colored rectangles using Phaser timer events
   - Computer screens: alternating glow colors

**Done when**: Camera smoothly follows across floors. Day/night tint visible. At least 2 animated decorations working. Press 'Z' to toggle full-house view.

---

## Dependency Graph

```
        [AI]                             [HUMAN]
T0.1 → T0.2 → T0.3
                 ↓
               T1.1 [HUMAN: tileset + tilemap]
                 ↓
         T1.2 → T1.3 → T1.4
                 ↓
               T2.1 [HUMAN: character spritesheet]
                 ↓
         T2.2 → T2.3 → T2.4
                         ↓
                 T3.1 → T3.2 → T3.3
                                 ↓
                               T3.4 [HUMAN: emotion + particle sprites]
                                 ↓
                 T4.1   T4.2
                                 ↓
                               T4.3 [HUMAN: sound effects]
                                 ↓
                         T4.4
                                 ↓
                               T5.1 [HUMAN: 3-floor tilemap + furniture]
                                 ↓
                 T5.2 → T5.3 → T5.4
```

**Note**: AI tasks can proceed with programmatic placeholders while waiting for human art assets. When the human delivers the assets, they are hot-swapped in (just replace the files, no code changes needed).

---

## Estimated Timeline

| Phase     | AI Work      | Human Work                             | Calendar       |
| --------- | ------------ | -------------------------------------- | -------------- |
| P0        | 1.5 days     | —                                      | Day 1–2        |
| P1        | 1.5 days     | 1–2 days (tileset + tilemap)           | Day 2–4        |
| P2        | 2 days       | 1–2 days (character spritesheet)       | Day 4–7        |
| P3        | 2 days       | 0.5 day (emotion + particle sprites)   | Day 7–9        |
| P4        | 1.5 days     | 0.5 day (sound effects)                | Day 9–11       |
| P5        | 1.5 days     | 1–2 days (3-floor tilemap + furniture) | Day 11–13      |
| **Total** | **~10 days** | **~5 days**                            | **~2.5 weeks** |

> Human art tasks can be done **in parallel** with AI coding tasks. The AI uses programmatic placeholders until real assets are delivered.

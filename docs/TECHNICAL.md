# Watch Claw - Technical Design Document

> **Version**: 1.0.0
> **Date**: 2026-03-24
> **Status**: In Progress
> **Previous**: v0.2 used hand-written Canvas 2D renderer with 3/4 top-down view. v1.0 migrates to Phaser 3 with side-view platformer style.

---

## 1. Tech Stack

### 1.1 Selection Summary

| Layer              | Choice                                          | Rationale                                                                                   |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Language**       | TypeScript 5.x (strict mode)                    | Type safety for game state, events, and protocol                                            |
| **Game Engine**    | Phaser 3.80+                                    | Built-in Arcade Physics, Tilemap, Sprite animation, Camera — ideal for 2D platformer style  |
| **UI Framework**   | React 18                                        | Overlay UI only (dashboard, controls); game state lives inside Phaser Scene                 |
| **Build Tool**     | Vite 8                                          | Fast HMR, native TS, Phaser-compatible                                                     |
| **Map Editor**     | Tiled (exports JSON)                            | Visual tilemap editing, collision layers, object layers for spawn points — Phaser native     |
| **Communication**  | Session Log file monitoring + WebSocket Bridge  | Monitor OpenClaw JSONL session logs, push to browser via Node.js bridge (unchanged from v0.2)|
| **Rendering**      | Phaser WebGL / Canvas 2D (auto-detect)          | GPU-accelerated sprites, particles, lighting effects; Canvas 2D fallback                    |
| **Package Manager**| pnpm                                            | Fast, disk-efficient, strict dependencies                                                   |
| **Linting**        | ESLint + Prettier                               | Consistent code style, type-aware linting                                                   |
| **Testing**        | Vitest                                          | Fast unit tests, Vite-compatible                                                            |
| **Desktop**        | Electron                                        | Standalone desktop window, system tray, always-on-top                                       |

### 1.2 Why Phaser (not Canvas 2D / PixiJS)

| Alternative         | Why we chose differently                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Canvas 2D (v0.2)**| v0.2's hand-written renderer produced functional but visually poor results (colored rectangles). No physics, no tilemap, no particle system. Significant effort to add platformer physics and effects from scratch. |
| **PixiJS**          | Excellent renderer, but **no physics engine**. Our side-view platformer needs gravity, jump, platform collision — would require integrating matter.js/planck.js manually with significant glue code. |
| **Phaser 3**        | **Best fit for side-view platformer**: Arcade Physics (gravity, velocity, bounce, colliders), native Tiled tilemap support, sprite animation system, camera follow, particle emitter — all built-in. The ~1MB bundle is acceptable for an Electron desktop app. |

### 1.3 Why Side-View Platformer (not 3/4 Top-Down)

| 3/4 Top-Down (v0.2)                            | Side-View Platformer (v1.0)                          |
| ----------------------------------------------- | ---------------------------------------------------- |
| Single floor, horizontal rooms                  | **Three floors stacked vertically** — natural house   |
| No verticality, rooms feel flat                 | Gravity + jump → satisfying movement                 |
| BFS pathfinding on tile grid                    | Physics-based: walk, jump, climb stairs/ladders      |
| Y-sort depth ordering (complex)                 | Simple left-right sprite layering                    |
| Similar to Star Office UI (competitor)          | **Unique visual identity** — no competitor does this |

---

## 2. Architecture

### 2.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Electron Desktop App                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     React Shell                               │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │   PhaserContainer    │  │      Dashboard.tsx            │  │  │
│  │  │   (mounts Phaser)    │  │      (status, tokens, logs)   │  │  │
│  │  └──────────┬───────────┘  └──────────────────────────────┘  │  │
│  └─────────────│────────────────────────────────────────────────┘  │
│                │                                                    │
│                ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Phaser Game Instance                             │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ BootScene   │→│  HouseScene   │  │  UIScene (overlay)  │  │  │
│  │  │ (preload)   │  │  (gameplay)  │  │  (HUD, bubbles)     │  │  │
│  │  └─────────────┘  └──────┬───────┘  └─────────────────────┘  │  │
│  │                          │                                    │  │
│  │           ┌──────────────┼──────────────────┐                 │  │
│  │           ▼              ▼                  ▼                 │  │
│  │    ┌────────────┐ ┌────────────┐ ┌──────────────────┐        │  │
│  │    │  Tilemap   │ │  Character │ │  Arcade Physics  │        │  │
│  │    │  (Tiled)   │ │  Controller│ │  (gravity, jump, │        │  │
│  │    │            │ │  (FSM)     │ │   colliders)     │        │  │
│  │    └────────────┘ └────────────┘ └──────────────────┘        │  │
│  │           ▲                                                   │  │
│  │           │ dispatch(CharacterAction)                         │  │
│  │    ┌──────┴──────────────────────────────────────────┐        │  │
│  │    │           Event Bridge (adapter)                 │        │  │
│  │    │  ConnectionManager → EventParser → CharacterAction│       │  │
│  │    └─────────────────────────────────────────────────┘        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          │                                         │
│                          │ WebSocket                               │
│                          ▼                                         │
│                Bridge Server (Node.js)                             │
│                ws://127.0.0.1:18790                                │
│                          │                                         │
│                          │ fs.watch                                │
│                          ▼                                         │
│              OpenClaw Session Log (JSONL)                          │
│              ~/.openclaw/agents/main/sessions/                    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Design Decisions

1. **Phaser owns the game loop and rendering** — no more hand-written `GameLoop`, `renderer.ts`, `coordinates.ts`. Phaser's `update()` runs at 60fps with built-in delta-time handling.

2. **Connection Layer is preserved** — `BridgeClient`, `EventParser`, `ConnectionManager`, `ActionQueue` stay unchanged. They produce `CharacterAction` objects that the Phaser scene consumes via an Event Bridge adapter.

3. **React is overlay only** — `Dashboard.tsx` subscribes to ConnectionManager for status/token/log updates. Phaser renders the game world. No React ↔ Phaser state sync needed for gameplay.

4. **Tiled maps for level design** — Room layouts, collision layers, furniture placement, and spawn points are all defined in Tiled JSON files. No more hardcoded `FLOOR_LAYOUT` arrays or `pixelFurniture.ts` rectangle drawing.

5. **Arcade Physics for platformer feel** — Gravity pulls character down, jump sets negative Y velocity, platform colliders prevent falling through floors. Stairs/ladders use overlap zones with custom physics toggle.

---

## 3. Directory Structure

```
watch-claw/
├── bridge/                          # Bridge Server (UNCHANGED)
│   └── server.ts                    #   watches session JSONL → WS push
├── electron/                        # Electron shell (UNCHANGED)
│   ├── main.cjs
│   └── preload.cjs
├── src/
│   ├── connection/                  # Connection Layer (UNCHANGED)
│   │   ├── types.ts                 #   event types, CharacterAction, etc.
│   │   ├── bridgeClient.ts          #   WebSocket client with reconnect
│   │   ├── eventParser.ts           #   session log → CharacterAction
│   │   ├── actionQueue.ts           #   priority queue for actions
│   │   ├── connectionManager.ts     #   orchestrates bridge + parsing
│   │   └── index.ts
│   ├── game/                        # Phaser Game Layer (NEW — replaces engine/)
│   │   ├── config.ts                #   Phaser.Types.Core.GameConfig
│   │   ├── scenes/
│   │   │   ├── BootScene.ts         #   asset preloading, loading bar
│   │   │   ├── HouseScene.ts        #   main gameplay scene (tilemap, character, physics)
│   │   │   └── UIScene.ts           #   HUD overlay scene (emotion bubbles, room labels)
│   │   ├── characters/
│   │   │   ├── LobsterCharacter.ts  #   player character sprite + FSM + physics
│   │   │   └── PetCompanion.ts      #   optional pet that follows character
│   │   ├── systems/
│   │   │   ├── EventBridge.ts       #   adapter: ConnectionManager → Phaser scene events
│   │   │   ├── RoomManager.ts       #   room detection, activity zones, room labels
│   │   │   ├── EmotionSystem.ts     #   emotion bubble sprites above character
│   │   │   └── ParticleEffects.ts   #   celebration confetti, error sparks, etc.
│   │   └── index.ts
│   ├── ui/                          # React Overlay (UPDATED)
│   │   ├── PhaserContainer.tsx      #   mounts Phaser game into React DOM (NEW)
│   │   ├── Dashboard.tsx            #   status panel (UPDATED)
│   │   ├── ConnectionBadge.tsx      #   connection indicator (UNCHANGED)
│   │   └── index.ts
│   ├── utils/                       # Utilities (UNCHANGED)
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   ├── eventBus.ts
│   │   └── index.ts
│   ├── App.tsx                      #   root component (UPDATED for Phaser)
│   ├── main.tsx                     #   entry point
│   └── index.css
├── public/
│   └── assets/
│       ├── tilemaps/                #   Tiled JSON exports (NEW)
│       │   ├── house.json           #     three-floor house tilemap
│       │   └── house.tmx            #     Tiled project file (not bundled)
│       ├── tilesets/                #   tileset images (NEW)
│       │   ├── interior.png         #     room tiles (floor, wall, door)
│       │   └── furniture.png        #     furniture spritesheet
│       ├── character/               #   character spritesheets (UPDATED)
│       │   └── lobster.png          #     combined spritesheet (192×256, 6cols × 8rows, 32×32 per frame)
│       ├── effects/                 #   particle & effect sprites (NEW)
│       │   ├── confetti.png
│       │   ├── zzz.png
│       │   └── spark.png
│       └── ui/                      #   UI assets
│           └── emotions.png
├── docs/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── vitest.config.ts
```

### 3.1 What's Removed (v0.2 → v1.0)

| Removed File/Dir                | Reason                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| `src/engine/gameLoop.ts`        | Phaser provides its own game loop                           |
| `src/engine/renderer.ts`        | Phaser renders via WebGL/Canvas automatically               |
| `src/engine/coordinates.ts`     | No more isometric coordinate conversion (side-view is 1:1)  |
| `src/engine/camera.ts`          | Phaser camera system replaces this                          |
| `src/engine/gameState.ts`       | Game state now lives in Phaser Scene; connection types stay  |
| `src/engine/pathfinding.ts`     | Replaced by physics-based movement (walk + jump)            |
| `src/engine/pixelFurniture.ts`  | Replaced by Tiled tilemap + spritesheet assets              |
| `src/engine/spritesheet.ts`     | Phaser has built-in spritesheet loader                      |
| `src/engine/tileAtlas.ts`       | Phaser has built-in tile atlas support                      |
| `src/world/tileMap.ts`          | Replaced by Tiled JSON import                               |
| `src/world/rooms.ts`            | Replaced by RoomManager reading Tiled object layers         |
| `src/world/furniture.ts`        | Replaced by Tiled tilemap furniture layer                   |
| `src/world/sprites.ts`          | Phaser manages sprite loading and animation                 |
| `src/ui/CanvasView.tsx`         | Replaced by PhaserContainer.tsx                             |
| `src/ui/ZoomControls.tsx`       | Phaser camera handles zoom natively                         |

### 3.2 What's Preserved (unchanged from v0.2)

| Preserved File/Dir                  | Reason                                           |
| ----------------------------------- | ------------------------------------------------ |
| `bridge/server.ts`                  | Session log watching → WS push (works perfectly) |
| `src/connection/bridgeClient.ts`    | WebSocket client with reconnect logic            |
| `src/connection/eventParser.ts`     | Session log event → CharacterAction mapping      |
| `src/connection/actionQueue.ts`     | Priority queue for actions                       |
| `src/connection/connectionManager.ts`| Orchestrates connection and event dispatch       |
| `src/connection/types.ts`           | All type definitions (extended, not replaced)    |
| `src/utils/constants.ts`            | Constants (extended with Phaser-specific ones)   |
| `src/utils/helpers.ts`              | Utility functions                                |
| `src/utils/eventBus.ts`             | Pub/sub for React ↔ game communication           |
| `electron/main.cjs`                 | Electron shell                                   |
| `electron/preload.cjs`              | Electron preload script                          |

---

## 4. Phaser Scene Design

### 4.1 Scene Graph

```
Phaser.Game
├── BootScene          # runs first: preload all assets, show loading bar
├── HouseScene         # main scene: tilemap, character, physics
│   ├── Tilemap Layers
│   │   ├── background    (walls, exterior)
│   │   ├── floors        (floor tiles per room)
│   │   ├── furniture     (desks, beds, bookshelves — decorative)
│   │   ├── collision     (invisible tiles marking solid ground/walls)
│   │   └── foreground    (items rendered in front of character)
│   ├── Object Layers (from Tiled)
│   │   ├── spawn_points  (character start position)
│   │   ├── room_zones    (rectangle objects defining room boundaries)
│   │   ├── ladders       (overlap zones for climbing)
│   │   └── activity_spots(where character sits/types/sleeps)
│   ├── Character Sprite
│   │   └── LobsterCharacter (physics body, FSM, animations)
│   └── Arcade Physics
│       ├── character ↔ collision layer
│       └── character ↔ ladder zones (overlap)
└── UIScene (parallel) # overlay: emotion bubbles, room name, notifications
```

### 4.2 Three-Floor House Layout (Side View)

```
         ┌──────────────────────────────────────────────┐
  3F     │     📦           📚           🌙             │
  Attic  │  Warehouse     Study       Balcony           │
         │  (Downloads)   (Documents) (Search)          │
         │    ┌──┐         ┌──┐                         │
         ├────┤  ├─────────┤  ├─────────────────────────┤
  2F     │     🔧           🛋           🛏              │
  Main   │  Toolbox      Office      Bedroom            │
         │  (Execute)    (Chat)      (Rest)             │
         │    ┌──┐         ┌──┐                         │
         ├────┤  ├─────────┤  ├─────────────────────────┤
  1F     │     📱           💻           🗑              │
  Base   │  Basement     Server Room  Trash             │
         │  (Apps)       (Code)      (Cleanup)          │
         └──────────────────────────────────────────────┘
              ▲ stairs/ladders connect floors ▲
```

- Each floor is ~30 tiles wide × ~10 tiles tall
- Floors connected by **staircases** (walkable slope) or **ladders** (climb zone)
- Camera follows character with smooth lerp, clamped to house bounds
- Rooms defined by Tiled rectangle objects in `room_zones` layer

### 4.3 Character Controller (LobsterCharacter)

```
State Machine:
                              ┌──────────┐
                   jump ┌─────│  JUMPING  │
                        │     └────┬─────┘
                        │          │ land
  ┌────────┐     move  ┌▼─────────▼┐     stop    ┌────────┐
  │SLEEPING│◄─────────│   IDLE     │────────────►│ WALKING│
  └───┬────┘  wake_up  └─────┬─────┘              └────────┘
      │                      │
      │              activity zone reached
      │                      │
      │         ┌────────────┼────────────┐
      │         ▼            ▼            ▼
      │   ┌──────────┐ ┌──────────┐ ┌────────────┐
      │   │  TYPING  │ │ THINKING │ │CELEBRATING │
      │   └──────────┘ └──────────┘ └────────────┘
      │         │            │            │
      │         └────────────┼────────────┘
      │              new action arrives
      │                      │
      └──────────────────────┘
              GO_SLEEP (idle > 30s)
```

**Physics properties:**
- `body.setGravityY(800)` — standard platformer gravity
- `body.setMaxVelocity(160, 400)` — walk speed cap (X), fall speed cap (Y)
- `body.setDrag(800, 0)` — smooth horizontal deceleration
- Jump: `body.setVelocityY(-350)` when `body.blocked.down`
- Ladder climbing: temporarily disable gravity, allow Y movement

**Auto-navigation:**
When `CharacterAction(GOTO_ROOM)` arrives:
1. Determine target room's floor and activity zone
2. If same floor → walk horizontally to target X
3. If different floor → walk to nearest staircase → go up/down → walk to target X
4. Arrive at activity zone → transition to target animation state

### 4.4 Camera System

- `camera.startFollow(character, true, 0.08, 0.08)` — smooth lerp follow
- `camera.setBounds(0, 0, mapWidth, mapHeight)` — clamp to house
- Zoom: `camera.setZoom(2)` for pixel-perfect scaling (2x or 3x)
- Dead zone: character can move slightly without camera moving

---

## 5. Tilemap Design (Tiled)

### 5.1 Tile Layers

| Layer Name    | Type       | Purpose                                             |
| ------------- | ---------- | --------------------------------------------------- |
| `background`  | Tile Layer | Exterior walls, sky, house frame                    |
| `floor_1f`    | Tile Layer | Basement floor tiles (Basement, Server Room, Trash)  |
| `floor_2f`    | Tile Layer | Main floor tiles (Toolbox, Office, Bedroom)          |
| `floor_3f`    | Tile Layer | Attic floor tiles (Warehouse, Study, Balcony)        |
| `walls`       | Tile Layer | Interior walls, room dividers                       |
| `furniture`   | Tile Layer | Decorative furniture (non-collidable)               |
| `collision`   | Tile Layer | Invisible tiles for physics collision (not rendered) |
| `foreground`  | Tile Layer | Items rendered in front of character (depth sorting) |

### 5.2 Object Layers

| Layer Name       | Object Type | Properties                                      |
| ---------------- | ----------- | ----------------------------------------------- |
| `spawn_points`   | Point       | `name: "player_start"`, position                |
| `room_zones`     | Rectangle   | `name: "office"`, `floor: 2`, bounds            |
| `activity_spots` | Point       | `name: "desk"`, `room: "office"`, `anim: "type"`|
| `ladders`        | Rectangle   | Overlap zone where gravity is disabled           |
| `stairs`         | Polygon     | Slope collision for natural staircase walking    |

### 5.3 Tileset Requirements

| Tileset        | Tile Size | Content                                        |
| -------------- | --------- | ---------------------------------------------- |
| `interior.png` | 16×16     | Floor tiles, wall tiles, doors, windows, stairs|
| `furniture.png`| 16×16     | Desk, computer, bed, server rack, bookshelf, trash bin, decorations (plants, lamps, rugs) |

---

## 6. Event Flow (End-to-End)

```
OpenClaw runs tool "write"
       │
       ▼
Session JSONL appended:
  {"type":"message","message":{"role":"assistant","content":[{"type":"toolCall","name":"write",...}]}}
       │
       ▼
Bridge Server (fs.watch) detects change
  → reads new bytes → parses JSON → broadcasts via WebSocket
       │
       ▼
BridgeClient (browser) receives message
  → passes to ConnectionManager.handleEvent()
       │
       ▼
EventParser.parseSessionLogEvent()
  → returns CharacterAction: { type: "GOTO_ROOM", room: "server_room", animation: "type", emotion: "focused" }
       │
       ▼
EventBridge dispatches to HouseScene
  → HouseScene.handleCharacterAction(action)
       │
       ▼
LobsterCharacter receives action
  → Calculates path: current position → stairs (if needed) → office activity zone
  → Sets FSM state to WALKING, begins moving
       │
       ▼
Character arrives at server room terminal
  → FSM transitions to TYPING
  → Plays "lobster-type" spritesheet animation
  → EmotionSystem shows "focused" bubble above head
       │
       ▼
Player sees: lobster character walks to server room, sits at terminal, types with focused bubble
```

---

## 7. Room-to-Event Mapping (v1.0 Complete)

### 7.1 Three-Floor Mapping

| Floor | Room             | OpenClaw Events                                | Animation         | Emotion   |
| ----- | ---------------- | ---------------------------------------------- | ----------------- | --------- |
| 3F    | Warehouse        | `glob` (file downloads, large file ops)        | Sorting boxes     | Busy      |
| 3F    | Study            | `read`, `grep` (document browsing)             | Sitting, flipping | Curious   |
| 3F    | Balcony          | `web_search`, `web_fetch` (search/browse)      | Browsing phone    | Curious   |
| 2F    | Toolbox          | `exec` (system commands, scripts)              | Using tools       | Serious   |
| 2F    | Office           | `write`, `edit`, assistant streaming (chat)     | Typing at desk    | Focused   |
| 2F    | Bedroom          | Idle, waiting, session end (rest)              | Sleeping in bed   | Sleepy    |
| 1F    | Basement         | `task` (sub-agent), complex multi-tool chains  | Tinkering         | Thinking  |
| 1F    | Server Room      | `write` (code), `edit` (code), coding tasks    | Coding at terminal| Focused   |
| 1F    | Trash            | Task completed / cleanup                       | Sweeping          | Satisfied |

### 7.2 MVP Subset (v1.0-MVP)

For the initial release, we implement **one floor (2F Main)** with the full Phaser engine, then expand to 3 floors:

| Phase      | Floors | Rooms                         |
| ---------- | ------ | ----------------------------- |
| v1.0-MVP   | 2F     | Toolbox, Office, Bedroom      |
| v1.0-Full  | All    | 9 rooms across 3 floors       |

---

## 8. Non-Functional Requirements

| Requirement          | Target                                                                   |
| -------------------- | ------------------------------------------------------------------------ |
| **Frame rate**       | 60fps (Phaser requestAnimationFrame)                                     |
| **Bundle size**      | < 1.5MB gzipped (Phaser ~1MB + app code ~200KB + assets loaded lazily)   |
| **Platform**         | Electron desktop app (macOS first, Windows/Linux later)                  |
| **Responsive**       | Min 800×600, scales to 4K with integer pixel scaling                     |
| **Startup time**     | < 3s to first meaningful paint (loading bar during asset preload)        |
| **Bridge reconnect** | Auto-reconnect with exponential backoff (1s–30s) — unchanged            |
| **Memory usage**     | < 150MB (Phaser + textures)                                             |
| **Accessibility**    | Reduced motion support (`prefers-reduced-motion`)                       |

---

## 9. Migration Risk Assessment

| Risk                                | Mitigation                                                              |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Phaser bundle size (~1MB)           | Acceptable for Electron app; lazy-load assets after boot                |
| Learning curve for Phaser API       | Well-documented, extensive examples, active community                   |
| Tiled tilemap design effort         | Start with simple placeholder tiles; polish art later                   |
| Physics tuning (jump feel)          | Use proven platformer constants; iterate on gravity/velocity values     |
| React ↔ Phaser communication       | Clean EventBridge adapter pattern; minimal coupling                     |
| Sprite art requirements             | Use free itch.io pixel art packs initially; commission custom art later |

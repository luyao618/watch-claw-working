# Watch Claw - Technical Design Document

> **Version**: 0.1.0 (Draft)
> **Date**: 2026-03-22
> **Status**: In Progress

---

## 1. Tech Stack

### 1.1 Selection Summary

| Layer                | Choice                                             | Rationale                                                                           |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Language**         | TypeScript 5.x (strict mode)                       | Type safety for game state, event parsing, and WebSocket protocol                   |
| **UI Framework**     | React 18                                           | Only used for overlay UI (dashboard, controls); game state lives outside React      |
| **Rendering**        | Canvas 2D API                                      | Pixel-perfect control, integer scaling, no WebGL complexity needed for this scale   |
| **Build Tool**       | Vite 6                                             | Fast HMR, native TS support, simple config, proven in both reference projects       |
| **Communication**    | Session Log file monitoring + WebSocket Bridge     | Monitor OpenClaw JSONL session logs, push to browser via lightweight Node.js bridge |
| **State Management** | Imperative game state + React useReducer (UI only) | Game world state outside React avoids re-render overhead on every frame             |
| **Package Manager**  | pnpm                                               | Fast, disk-efficient, strict dependency resolution                                  |
| **Linting**          | ESLint + Prettier                                  | Consistent code style, type-aware linting                                           |
| **Testing**          | Vitest                                             | Fast unit tests, compatible with Vite, native TS support                            |

### 1.2 Why Not...

| Alternative           | Why we chose differently                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phaser / PixiJS**   | Overkill for a single-character isometric scene; brings large bundle and API surface we don't need. Canvas 2D is sufficient and keeps the bundle small.                                                    |
| **WebGL / Three.js**  | 2D pixel art doesn't benefit from GPU shaders. Canvas 2D with integer scaling gives pixel-perfect results more easily.                                                                                     |
| **Zustand / Redux**   | Game state updates at 60fps. React state management would cause unnecessary re-renders. Imperative state with selective React updates is the proven pattern (used by Pixel Agents).                        |
| **Socket.IO**         | Our WebSocket is only a simple push channel from bridge to browser. Socket.IO adds unnecessary abstraction and bundle weight.                                                                              |
| **Next.js / Remix**   | No server-side rendering needed. This is a pure client-side SPA that connects to a local WebSocket bridge. Vite is simpler and faster.                                                                     |
| **Gateway WebSocket** | OpenClaw Gateway's WebSocket protocol is unstable and its event format differs from session logs. Session logs are append-only JSONL, verified format with real-time writes — a more reliable data source. |

---

## 2. Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Web App)                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     React Shell                           │  │
│  │  ┌─────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │   CanvasView.tsx    │  │    Dashboard.tsx            │  │  │
│  │  │   (mounts <canvas>) │  │    (status, tokens, logs)  │  │  │
│  │  └────────┬────────────┘  └────────────┬───────────────┘  │  │
│  └───────────┼────────────────────────────┼──────────────────┘  │
│              │ ref                         │ subscribe           │
│  ┌───────────▼────────────────────────────▼──────────────────┐  │
│  │                   Game Engine (imperative)                 │  │
│  │                                                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ GameLoop │→│ Renderer │ │Character │ │ Pathfinding │  │  │
│  │  │ (rAF)   │ │(Canvas2D)│ │  (FSM)   │ │   (BFS)     │  │  │
│  │  └────┬─────┘ └──────────┘ └──────────┘ └─────────────┘  │  │
│  │       │ update                                            │  │
│  │  ┌────▼──────────────────────────────────────────┐        │  │
│  │  │              GameState                         │        │  │
│  │  │  - character: { position, state, emotion }     │        │  │
│  │  │  - world: { rooms, tiles, furniture }          │        │  │
│  │  │  - camera: { offset, zoom }                    │        │  │
│  │  │  - connection: { status, lastEvent }           │        │  │
│  │  └────▲──────────────────────────────────────────┘        │  │
│  └───────┼───────────────────────────────────────────────────┘  │
│          │ dispatch(action)                                      │
│  ┌───────┴───────────────────────────────────────────────────┐  │
│  │                  Connection Layer                          │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐ │  │
│  │  │ Bridge   │  │ EventParser  │  │   MockProvider      │ │  │
│  │  │ Client   │→ │              │→ │ (fallback when      │ │  │
│  │  │ (WS)    │  │ SessionLog   │  │  Bridge is offline) │ │  │
│  │  │         │  │ → CharAction │  │                     │ │  │
│  │  └──────────┘  └──────────────┘  └─────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          │ WebSocket                             │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────────┐
              │   Bridge Server (Node.js)  │
              │   ws://127.0.0.1:18790     │
              │                            │
              │   - fs.watch session JSONL  │
              │   - Parse + push new events│
              │   - Session discovery/swap │
              └──────────────┬─────────────┘
                             │ fs.watch
                             ▼
              ┌────────────────────────────┐
              │   OpenClaw Session Logs    │
              │   ~/.openclaw/agents/main/ │
              │   sessions/<id>.jsonl      │
              │                            │
              │   - JSONL append-only      │
              │   - Real-time writes       │
              │   - Structured event types │
              └────────────────────────────┘
```

### 2.2 Layer Responsibilities

| Layer          | Responsibility                                                       | React Aware? |
| -------------- | -------------------------------------------------------------------- | ------------ |
| **Connection** | Bridge WebSocket lifecycle, session log event parsing, mock data gen | No           |
| **Engine**     | Game loop, rendering, character FSM, pathfinding, camera             | No           |
| **World**      | Tile map data, room definitions, sprite data, furniture catalog      | No           |
| **UI**         | Canvas DOM mounting, dashboard overlay, controls                     | Yes          |

### 2.3 Key Design Decisions

**Decision 1: Game state lives outside React**

The game world updates at 60fps. If game state were in React state, every frame would trigger a re-render cascade. Instead:

- `GameState` is a plain TypeScript object, mutated imperatively
- The game loop reads and writes `GameState` directly
- React components subscribe to specific slices via a lightweight pub/sub (`EventEmitter`)
- The dashboard updates at most 4 times per second (throttled)

**Decision 2: Single Canvas, no DOM tiles**

Unlike PixelHQ ULTRA which uses DOM elements for tiles, we use a single `<canvas>` element. This gives us:

- Pixel-perfect control over isometric rendering
- Better performance for complex scenes with many overlapping sprites
- Easier z-ordering (painter's algorithm in a single draw pass)
- Native support for pixel-art scaling without CSS subpixel issues

**Decision 3: Session Log file monitoring + Bridge Server**

OpenClaw writes all session activity in real-time to JSONL files (`~/.openclaw/agents/main/sessions/<session-id>.jsonl`). We chose to monitor these files instead of connecting directly to the Gateway WebSocket for the following reasons:

- Session logs are append-only JSONL with a stable, verified format
- Include complete tool call info: tool name, arguments, results, duration
- Include token usage and cost data
- Include model/provider information
- No dependency on Gateway's WebSocket protocol (which is not stable enough)
- `sessions.json` index file provides active session discovery

Since browsers cannot access the local file system directly, we use a lightweight Node.js Bridge Server:

- Bridge uses `fs.watch` to monitor the JSONL file for changes
- Parses new lines, pushes to browser clients via WebSocket
- Auto-discovers the most recently active session (reads `sessions.json`, sorts by `updatedAt`)
- Bridge is ~50-80 lines of code, starts alongside `pnpm dev`

---

## 3. Project Structure

```
watch-claw-working/
│
├── docs/                               # Documentation
│   ├── PRD.md                          # Product requirements
│   ├── TECHNICAL.md                    # This document
│   ├── TASKS.md                        # Task breakdown
│   └── assets/                         # Doc assets (reference images)
│       └── reference-isometric-house.png
│
├── public/                             # Static assets (served as-is)
│   └── assets/
│       ├── character/                  # Lobster-hat character spritesheets
│       │   ├── idle.png               # Idle animation frames
│       │   ├── walk.png               # Walk animation frames (4 directions)
│       │   ├── sit.png                # Sitting at desk frames
│       │   ├── type.png               # Typing animation frames
│       │   └── sleep.png             # Sleeping animation frames
│       ├── tiles/                     # Isometric floor and wall tiles
│       │   ├── floor-wood.png         # Wooden floor tile
│       │   ├── floor-carpet.png       # Carpet floor tile
│       │   ├── wall-front.png         # Front-facing wall
│       │   ├── wall-side.png          # Side-facing wall
│       │   └── stairs.png            # Staircase tile
│       ├── furniture/                 # Furniture sprites
│       │   ├── desk-computer.png      # Computer desk with monitor
│       │   ├── chair-office.png       # Office chair
│       │   ├── sofa.png              # Living room sofa
│       │   ├── fireplace.png         # Fireplace
│       │   ├── bed.png               # Bed
│       │   ├── lamp.png              # Table lamp
│       │   └── bookshelf.png         # Bookshelf
│       └── ui/                        # UI sprites
│           ├── emotions/              # Emotion bubble sprites
│           │   ├── focused.png
│           │   ├── thinking.png
│           │   ├── sleepy.png
│           │   ├── happy.png
│           │   └── confused.png
│           └── connection-indicator.png
│
├── src/
│   ├── main.tsx                        # App entry point, React root mount
│   ├── App.tsx                         # Root component, layout shell
│   │
│   ├── connection/                     # === Connection Layer ===
│   │   ├── types.ts                    # Session log event type definitions
│   │   │                               #   - SessionLogEvent (union type)
│   │   │                               #   - SessionEvent, ModelChangeEvent
│   │   │                               #   - MessageEvent (user/assistant/toolResult)
│   │   │                               #   - ToolCallContent, ToolResultContent
│   │   │                               #   - CharacterAction (output type)
│   │   │
│   │   ├── bridgeClient.ts             # Bridge WebSocket client
│   │   │                               #   - connect(), disconnect()
│   │   │                               #   - Auto-reconnect with exp. backoff
│   │   │                               #   - Receives session log events from bridge
│   │   │                               #   - Connection state machine:
│   │   │                               #     DISCONNECTED → CONNECTING →
│   │   │                               #     CONNECTED → RECONNECTING
│   │   │
│   │   ├── eventParser.ts              # Event → CharacterAction mapper
│   │   │                               #   - parseSessionLogEvent()
│   │   │                               #   - mapToolToRoom()
│   │   │                               #   - mapToolToAnimation()
│   │   │                               #   - mapToolToEmotion()
│   │   │                               #   - Configurable mapping rules
│   │   │
│   │   ├── mockProvider.ts             # Mock event generator
│   │   │                               #   - Simulates realistic session log event sequences
│   │   │                               #   - Random tool calls with timing
│   │   │                               #   - Session simulation cycles
│   │   │                               #   - Auto-activates when Bridge offline
│   │   │
│   │   └── connectionManager.ts        # Orchestrator
│   │                                   #   - Manages bridge vs mock switching
│   │                                   #   - Emits normalized CharacterActions
│   │                                   #   - Exposes connection status
│   │
│   ├── engine/                         # === Game Engine Layer ===
│   │   ├── gameState.ts                # Central game state object
│   │   │                               #   - character: CharacterState
│   │   │                               #   - world: WorldState
│   │   │                               #   - camera: CameraState
│   │   │                               #   - ui: UIState
│   │   │                               #   - EventEmitter for UI subscriptions
│   │   │
│   │   ├── gameLoop.ts                 # requestAnimationFrame loop
│   │   │                               #   - Fixed timestep accumulator
│   │   │                               #   - update(dt) → render() cycle
│   │   │                               #   - FPS tracking
│   │   │                               #   - Pause/resume support
│   │   │
│   │   ├── renderer.ts                 # Canvas 2D isometric renderer
│   │   │                               #   - clearFrame()
│   │   │                               #   - renderFloor()
│   │   │                               #   - renderWalls()
│   │   │                               #   - renderFurniture()
│   │   │                               #   - renderCharacter()
│   │   │                               #   - renderEmotionBubble()
│   │   │                               #   - renderDebugGrid() (dev only)
│   │   │                               #   - Z-sort all entities before drawing
│   │   │
│   │   ├── character.ts                # Character finite state machine
│   │   │                               #   - States: IDLE, WALKING, SITTING,
│   │   │                               #     TYPING, SLEEPING, THINKING,
│   │   │                               #     CELEBRATING
│   │   │                               #   - Transitions with animation blending
│   │   │                               #   - Frame counter per animation
│   │   │                               #   - Direction: NE, NW, SE, SW
│   │   │
│   │   ├── pathfinding.ts              # Tile-based pathfinding
│   │   │                               #   - BFS on walkability grid
│   │   │                               #   - Path smoothing (remove redundant)
│   │   │                               #   - getPath(from, to): TileCoord[]
│   │   │                               #   - Door/transition tile handling
│   │   │
│   │   ├── camera.ts                   # Viewport and zoom
│   │   │                               #   - pan(dx, dy)
│   │   │                               #   - zoom(level: 0.5-5.0, step ±0.25)
│   │   │                               #   - worldToScreen(x, y)
│   │   │                               #   - screenToWorld(sx, sy)
│   │   │                               #   - centerOn(tileX, tileY)
│   │   │                               #   - Follow character (optional)
│   │   │
│   │   └── isometric.ts               # Isometric math utilities
│   │                                   #   - cartesianToIso(x, y)
│   │                                   #   - isoToCartesian(isoX, isoY)
│   │                                   #   - getTileAtScreen(sx, sy)
│   │                                   #   - TILE_WIDTH, TILE_HEIGHT constants
│   │
│   ├── world/                          # === World Data Layer ===
│   │   ├── tileMap.ts                  # Tile map definitions
│   │   │                               #   - TileType enum (FLOOR, WALL, DOOR,
│   │   │                               #     STAIRS, EMPTY)
│   │   │                               #   - Floor layout as 2D arrays
│   │   │                               #   - Walkability grid generation
│   │   │
│   │   ├── rooms.ts                    # Room definitions
│   │   │                               #   - Room interface: name, bounds,
│   │   │                               #     furniture list, entry tile,
│   │   │                               #     activity zone tile
│   │   │                               #   - MAIN_FLOOR_ROOMS constant
│   │   │                               #   - getRoomForAction(action): Room
│   │   │
│   │   ├── furniture.ts                # Furniture catalog
│   │   │                               #   - FurnitureType enum
│   │   │                               #   - Placement data: tile position,
│   │   │                               #     sprite key, z-offset, walkable
│   │   │
│   │   └── sprites.ts                  # Sprite definitions and loading
│   │                                   #   - SpriteSheet interface
│   │                                   #   - loadSprite(key): Promise<ImageBitmap>
│   │                                   #   - Sprite animation frame data
│   │                                   #   - Sprite cache (Map<string, ImageBitmap>)
│   │
│   ├── ui/                             # === React UI Layer ===
│   │   ├── CanvasView.tsx              # Canvas container component
│   │   │                               #   - Mounts <canvas>, passes ref to engine
│   │   │                               #   - Handles resize + DPR
│   │   │                               #   - Mouse event delegation to engine
│   │   │
│   │   ├── Dashboard.tsx               # Status dashboard panel
│   │   │                               #   - Connection status indicator
│   │   │                               #   - Agent state display
│   │   │                               #   - Token usage bar
│   │   │                               #   - Session info
│   │   │                               #   - Activity log (last N events)
│   │   │
│   │   ├── ConnectionBadge.tsx         # Connection status badge
│   │   │                               #   - Connected / Disconnected / Mock
│   │   │                               #   - Animated indicator
│   │   │
│   │   └── ZoomControls.tsx            # +/- zoom buttons
│   │
│   └── utils/
│       ├── constants.ts                # All magic numbers centralized
│       │                               #   - TILE_WIDTH = 64
│       │                               #   - TILE_HEIGHT = 32
│       │                               #   - CHARACTER_SPEED = 2
│       │                               #   - ANIMATION_FPS = 8
│       │                               #   - BRIDGE_WS_URL = ws://127.0.0.1:18790
│       │                               #   - SESSION_LOG_DIR (bridge side)
│       │                               #   - DASHBOARD_UPDATE_RATE = 250
│       │                               #   - etc.
│       │
│       ├── eventBus.ts                 # Lightweight pub/sub
│       │                               #   - on(event, callback)
│       │                               #   - off(event, callback)
│       │                               #   - emit(event, data)
│       │                               #   - Used for Engine → UI communication
│       │
│       └── helpers.ts                  # General utilities
│                                       #   - clamp(), lerp()
│                                       #   - throttle(), debounce()
│                                       #   - generateId()
│
├── bridge/                             # Bridge Server (Node.js)
│   └── server.ts                       # Session log file monitoring + WebSocket push
│                                       #   - fs.watch monitors JSONL file
│                                       #   - Parses new lines
│                                       #   - WebSocket server (port 18790)
│                                       #   - Auto-discovers latest active session
│                                       #   - sessions.json index reading
│
├── index.html                          # Vite entry HTML
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
└── README.md
```

---

## 4. Core Module Design

### 4.1 Bridge Server (`bridge/server.ts`) + Bridge Client (`connection/bridgeClient.ts`)

#### Architecture Overview

Browsers cannot directly read the local file system, so we use a lightweight Node.js Bridge Server as a middle layer:

```
Browser (BridgeClient) ◄──WebSocket──► Bridge Server ◄──fs.watch──► Session JSONL File
```

#### Bridge Server

The Bridge Server is a ~60-80 line Node.js script with these responsibilities:

1. Read `~/.openclaw/agents/main/sessions/sessions.json` to discover active sessions
2. Sort by `updatedAt`, select the most recently active session's JSONL file
3. Use `fs.watch` to monitor that file for changes
4. When new lines are appended, parse the new JSON lines
5. Push them to all connected browser clients via WebSocket (port 18790)
6. Periodically check `sessions.json` for changes, auto-switch when a new session is detected

```typescript
// Bridge Server core logic (simplified)
import { watch, readFileSync } from 'fs'
import { WebSocketServer } from 'ws'
import { resolve } from 'path'
import { homedir } from 'os'

const SESSIONS_DIR = resolve(homedir(), '.openclaw/agents/main/sessions')
const SESSIONS_INDEX = resolve(SESSIONS_DIR, 'sessions.json')
const PORT = 18790

interface SessionsIndex {
  [key: string]: {
    sessionId: string
    sessionFile: string
    updatedAt: number
  }
}

const wss = new WebSocketServer({ port: PORT })
let currentFile: string | null = null
let fileSize = 0
let currentWatcher: ReturnType<typeof watch> | null = null

function findLatestSession(): string | null {
  try {
    const index: SessionsIndex = JSON.parse(
      readFileSync(SESSIONS_INDEX, 'utf-8'),
    )
    const entries = Object.values(index)
    if (entries.length === 0) return null
    entries.sort((a, b) => b.updatedAt - a.updatedAt)
    return entries[0].sessionFile
  } catch {
    return null
  }
}

function watchSession(filePath: string): void {
  // Clean up previous watcher to avoid leaks on session switch
  if (currentWatcher) {
    currentWatcher.close()
    currentWatcher = null
  }

  currentFile = filePath
  fileSize = 0

  // Read existing content, send initial state
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)
  fileSize = content.length

  // Send recent N events to new clients as initial state
  // ...

  currentWatcher = watch(filePath, (eventType) => {
    if (eventType !== 'change') return
    const newContent = readFileSync(filePath, 'utf-8')
    const newSize = newContent.length
    if (newSize <= fileSize) return

    // Extract newly added content
    const added = newContent.slice(fileSize)
    fileSize = newSize

    const newLines = added.trim().split('\n').filter(Boolean)
    for (const line of newLines) {
      try {
        const event = JSON.parse(line)
        // Broadcast to all connected clients
        const msg = JSON.stringify(event)
        wss.clients.forEach((client) => {
          if (client.readyState === 1) client.send(msg)
        })
      } catch {
        /* ignore malformed lines */
      }
    }
  })
}

// Start
const sessionFile = findLatestSession()
if (sessionFile) watchSession(sessionFile)
console.log(`Bridge server listening on ws://127.0.0.1:${PORT}`)
```

#### Bridge Client Connection State Machine

```
                    ┌─────────────┐
         connect()  │DISCONNECTED │ ◄──── disconnect() / max retries
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ CONNECTING  │ ──── WebSocket error ──→ RECONNECTING
                    └──────┬──────┘
                           │ ws.onopen
                           ▼
                    ┌─────────────┐
                    │  CONNECTED  │ ──── ws.onclose ──→ RECONNECTING
                    └─────────────┘
                           ▲
                           │ ws.onopen
                    ┌──────┴──────┐
                    │RECONNECTING │ ──── timeout (exp. backoff)
                    └─────────────┘      retries: 1s, 2s, 4s, ... 30s max
```

Note: Compared to the original Gateway Client, the Bridge Client is simpler — no handshake step needed, connection immediately receives events.

#### Interface

```typescript
interface BridgeClient {
  // Lifecycle
  connect(url: string): void
  disconnect(): void

  // State
  readonly state: ConnectionState
  readonly isConnected: boolean

  // Events
  onEvent(handler: (event: SessionLogEvent) => void): () => void
  onStateChange(handler: (state: ConnectionState) => void): () => void
}

type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
```

---

### 4.2 Event Parser (`connection/eventParser.ts`)

#### Input: Session Log Events

OpenClaw's session log is in JSONL format with one JSON object per line. The following are the observed event types:

```typescript
// Session Log base event
interface SessionLogEventBase {
  type: string
  id: string
  parentId: string | null
  timestamp: string // ISO 8601
}

// Session initialization event
interface SessionInitEvent extends SessionLogEventBase {
  type: 'session'
  version: number // currently 3
  cwd: string
}

// Model change event
interface ModelChangeEvent extends SessionLogEventBase {
  type: 'model_change'
  provider: string // 'github-copilot'
  modelId: string // 'claude-opus-4.6'
}

// Thinking level change
interface ThinkingLevelChangeEvent extends SessionLogEventBase {
  type: 'thinking_level_change'
  thinkingLevel: string // 'low' | 'medium' | 'high'
}

// Message event (core event type)
interface MessageEvent extends SessionLogEventBase {
  type: 'message'
  message: {
    role: 'user' | 'assistant' | 'toolResult'
    content: string | MessageContent[] // string for user messages, array for assistant/toolResult
    // Additional fields for assistant messages
    provider?: string
    model?: string
    usage?: {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      totalTokens: number
      cost: {
        input: number
        output: number
        cacheRead: number
        cacheWrite: number
        total: number
      }
    }
    stopReason?: 'toolUse' | 'stop'
    timestamp?: number
  }
}

// Message content types
type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | {
      type: 'toolCall'
      id: string
      name: string
      arguments: Record<string, unknown>
    }

// toolResult message additional fields (within MessageEvent.message when role === 'toolResult')
// These fields extend the base message structure above
interface ToolResultFields {
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: { type: 'text'; text: string }[]
  details: {
    status: 'completed' | 'error'
    exitCode?: number
    durationMs: number
  }
  isError: boolean
}

// Union type of all session log events
// Note: toolResult is a MessageEvent with role 'toolResult' and additional ToolResultFields
type SessionLogEvent =
  | SessionInitEvent
  | ModelChangeEvent
  | ThinkingLevelChangeEvent
  | MessageEvent
```

#### Key Event Identification

Core event patterns related to character behavior in session logs:

| Event Pattern        | Identification                                     | Meaning                                            |
| -------------------- | -------------------------------------------------- | -------------------------------------------------- |
| Session start        | `type: 'session'`                                  | Agent session started → character wakes up         |
| User message         | `role: 'user'`                                     | User initiated request → character wakes up        |
| AI tool call         | `role: 'assistant'`, `content` contains `toolCall` | Agent is working → move to room based on tool type |
| Tool result          | `role: 'toolResult'`                               | Tool execution complete → brief pause              |
| AI text reply        | `role: 'assistant'`, `content` only has `text`     | Agent replying → typing in office                  |
| AI thinking          | `role: 'assistant'`, `content` contains `thinking` | Agent is thinking → thinking animation             |
| `stopReason: 'stop'` | assistant message's `stopReason`                   | Turn ended → go to sleep                           |

#### Tool Name Mapping

Tool names in session logs are different from Gateway — they are **lowercase**:

```typescript
const TOOL_ROOM_MAP: Record<
  string,
  { room: RoomId; animation: AnimationId; emotion: EmotionId }
> = {
  // Write tools → Office (typing animation)
  write: { room: 'office', animation: 'type', emotion: 'focused' },
  edit: { room: 'office', animation: 'type', emotion: 'focused' },

  // Execution tools → Office (typing animation, serious emotion)
  exec: { room: 'office', animation: 'type', emotion: 'serious' },

  // Reading/search tools → Living Room (sitting and reading)
  read: { room: 'living-room', animation: 'sit', emotion: 'thinking' },
  grep: { room: 'living-room', animation: 'sit', emotion: 'curious' },
  glob: { room: 'living-room', animation: 'sit', emotion: 'curious' },

  // Web/search tools → Living Room (thinking)
  web_search: { room: 'living-room', animation: 'think', emotion: 'curious' },

  // Memory related → Living Room
  memory_search: {
    room: 'living-room',
    animation: 'think',
    emotion: 'thinking',
  },
  memory_get: { room: 'living-room', animation: 'sit', emotion: 'thinking' },

  // Process management → Office
  process: { room: 'office', animation: 'type', emotion: 'serious' },

  // Session/subtask related → Living Room (planning/thinking)
  task: { room: 'living-room', animation: 'think', emotion: 'thinking' },
  todowrite: { room: 'office', animation: 'type', emotion: 'focused' },
  sessions_spawn: {
    room: 'living-room',
    animation: 'think',
    emotion: 'thinking',
  },
  sessions_send: {
    room: 'living-room',
    animation: 'think',
    emotion: 'thinking',
  },
  sessions_list: { room: 'living-room', animation: 'sit', emotion: 'curious' },
  sessions_history: {
    room: 'living-room',
    animation: 'sit',
    emotion: 'curious',
  },
}
```

#### Output: Character Actions

```typescript
type CharacterAction =
  | {
      type: 'GOTO_ROOM'
      room: RoomId
      animation: AnimationId
      emotion: EmotionId
    }
  | { type: 'CHANGE_EMOTION'; emotion: EmotionId }
  | { type: 'CHANGE_ANIMATION'; animation: AnimationId }
  | { type: 'WAKE_UP' }
  | { type: 'GO_SLEEP' }
  | { type: 'CELEBRATE' }
  | { type: 'CONFUSED' }

type RoomId = 'office' | 'living-room' | 'bedroom'
type AnimationId =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'type'
  | 'sleep'
  | 'think'
  | 'celebrate'
type EmotionId =
  | 'focused'
  | 'thinking'
  | 'sleepy'
  | 'happy'
  | 'confused'
  | 'curious'
  | 'serious'
  | 'satisfied'
  | 'none'
```

#### Parsing Logic

```typescript
function parseSessionLogEvent(event: SessionLogEvent): CharacterAction | null {
  // Session initialization → character wakes up
  if (event.type === 'session') {
    return { type: 'WAKE_UP' }
  }

  // Only process message type events
  if (event.type !== 'message') return null

  const { message } = event

  // User message → wake up character (if sleeping)
  if (message.role === 'user') {
    return { type: 'WAKE_UP' }
  }

  // Assistant message
  if (message.role === 'assistant') {
    // Check for tool calls in content
    const toolCalls = message.content.filter(
      (c): c is ToolCallContent => c.type === 'toolCall',
    )

    if (toolCalls.length > 0) {
      // Use the first tool call for room routing
      const toolName = toolCalls[0].name
      const mapping = TOOL_ROOM_MAP[toolName]
      if (mapping) {
        return {
          type: 'GOTO_ROOM',
          room: mapping.room,
          animation: mapping.animation,
          emotion: mapping.emotion,
        }
      }
      // Unknown tool → default to office
      return {
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
      }
    }

    // Turn ended → go to sleep (check FIRST after toolCalls, before any
    // content-based routing, so character always sleeps on final message)
    if (message.stopReason === 'stop') {
      return { type: 'GO_SLEEP' }
    }

    // Check for thinking content (no tool call)
    const hasThinking = message.content.some((c) => c.type === 'thinking')
    const hasText = message.content.some(
      (c) => c.type === 'text' && c.text.trim().length > 0,
    )

    if (hasThinking && !hasText) {
      // Pure thinking → thinking animation
      return {
        type: 'GOTO_ROOM',
        room: 'living-room',
        animation: 'think',
        emotion: 'thinking',
      }
    }

    if (hasText) {
      // Text reply → typing in office
      // Throttle text replies to avoid multiple triggers during streaming
      if (!shouldThrottleAssistant()) {
        return {
          type: 'GOTO_ROOM',
          room: 'office',
          animation: 'type',
          emotion: 'focused',
        }
      }
      return null
    }
  }

  // toolResult → no direct action (character stays in current position)
  // But usage info can be extracted for the dashboard
  if (message.role === 'toolResult') {
    return null
  }

  return null
}
```

#### Action Queue

When events arrive faster than the character can respond (e.g., character is walking), actions are queued with priority support:

```typescript
type ActionPriority = 'high' | 'medium' | 'low'

interface PrioritizedAction {
  action: CharacterAction
  priority: ActionPriority
  timestamp: number
}

// Priority values for sorting (lower = higher priority)
const PRIORITY_ORDER: Record<ActionPriority, number> = {
  high: 0, // lifecycle events (start, end, error)
  medium: 1, // tool events
  low: 2, // assistant streaming, idle transitions
}

class ActionQueue {
  private queue: PrioritizedAction[] = []
  private readonly MAX_SIZE = 3

  push(action: CharacterAction, priority: ActionPriority = 'medium'): void {
    const entry: PrioritizedAction = {
      action,
      priority,
      timestamp: Date.now(),
    }

    if (this.queue.length >= this.MAX_SIZE) {
      // Drop the lowest priority item (or oldest if same priority)
      const lowestIdx = this.findLowestPriorityIndex()
      if (
        PRIORITY_ORDER[priority] <=
        PRIORITY_ORDER[this.queue[lowestIdx].priority]
      ) {
        this.queue.splice(lowestIdx, 1)
      } else {
        return // New action is lower priority than everything in queue, discard it
      }
    }

    // Deduplicate: if the latest queued action targets the same room, replace it
    const lastIdx = this.queue.length - 1
    const last = lastIdx >= 0 ? this.queue[lastIdx].action : null
    if (
      last &&
      last.type === 'GOTO_ROOM' &&
      action.type === 'GOTO_ROOM' &&
      last.room === action.room
    ) {
      this.queue[lastIdx] = entry
    } else {
      this.queue.push(entry)
    }

    // Sort by priority (high first), then by timestamp (oldest first)
    this.queue.sort((a, b) => {
      const priorityDiff =
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp
    })
  }

  pop(): CharacterAction | undefined {
    const entry = this.queue.shift()
    return entry?.action
  }

  get isEmpty(): boolean {
    return this.queue.length === 0
  }

  private findLowestPriorityIndex(): number {
    let lowestIdx = 0
    for (let i = 1; i < this.queue.length; i++) {
      if (
        PRIORITY_ORDER[this.queue[i].priority] >
        PRIORITY_ORDER[this.queue[lowestIdx].priority]
      ) {
        lowestIdx = i
      } else if (
        PRIORITY_ORDER[this.queue[i].priority] ===
          PRIORITY_ORDER[this.queue[lowestIdx].priority] &&
        this.queue[i].timestamp < this.queue[lowestIdx].timestamp
      ) {
        lowestIdx = i // Same priority, older item is lower value
      }
    }
    return lowestIdx
  }
}
```

---

### 4.3 Mock Data Provider (`connection/mockProvider.ts`)

The mock provider simulates realistic OpenClaw session log activity for development and demos.

#### Behavior Simulation

```typescript
class MockProvider {
  private outerTimerId: number | null = null
  private innerTimerId: number | null = null
  private onEvent: (event: SessionLogEvent) => void
  private sessionId: string = generateId()
  private eventSeq = 0

  start(onEvent: (event: SessionLogEvent) => void): void {
    this.onEvent = onEvent

    // Emit session init event
    this.emitSessionInit()

    // Emit user message, then start tool loop
    this.emitUserMessage('Help me refactor the auth module')
    this.scheduleNextTool()
  }

  private scheduleNextTool(): void {
    const delay = randomBetween(3000, 8000) // 3-8 seconds between actions
    this.outerTimerId = window.setTimeout(() => {
      const tool = this.randomTool()

      // Emit assistant message with toolCall
      this.emitAssistantToolCall(tool)

      // Tool duration: 1-5 seconds, then emit toolResult
      const duration = randomBetween(1000, 5000)
      this.innerTimerId = window.setTimeout(() => {
        this.innerTimerId = null
        this.emitToolResult(tool)
        this.scheduleNextTool()
      }, duration)
    }, delay)
  }

  private randomTool(): string {
    const tools = [
      'write',
      'edit',
      'read',
      'exec',
      'grep',
      'glob',
      'web_search',
      'task',
    ]
    const weights = [25, 20, 20, 15, 8, 5, 5, 2] // write/edit most common
    return weightedRandom(tools, weights)
  }

  private emitSessionInit(): void {
    this.onEvent({
      type: 'session',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      version: 3,
      cwd: '/mock/project',
    })
  }

  private emitUserMessage(text: string): void {
    this.onEvent({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'user',
        content: text,
      },
    })
  }

  private emitAssistantToolCall(toolName: string): void {
    this.onEvent({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Let me use ' + toolName + '...' },
          {
            type: 'toolCall',
            id: generateId(),
            name: toolName,
            arguments: { path: '/mock/file.ts' },
          },
        ],
        provider: 'github-copilot',
        model: 'claude-opus-4.6',
        stopReason: 'toolUse',
        usage: {
          input: randomBetween(100, 500),
          output: randomBetween(50, 200),
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: randomBetween(150, 700),
          cost: {
            input: 0.01,
            output: 0.005,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0.015,
          },
        },
      },
    })
  }

  private emitToolResult(toolName: string): void {
    this.onEvent({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'toolResult',
        toolCallId: generateId(),
        toolName,
        content: [{ type: 'text', text: 'Tool completed successfully' }],
        details: {
          status: 'completed',
          exitCode: 0,
          durationMs: randomBetween(100, 3000),
        },
        isError: false,
      },
    })
  }

  private emitEndTurn(): void {
    this.onEvent({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Done! The refactoring is complete.' }],
        provider: 'github-copilot',
        model: 'claude-opus-4.6',
        stopReason: 'stop',
      },
    })
  }

  stop(): void {
    if (this.outerTimerId) {
      clearTimeout(this.outerTimerId)
      this.outerTimerId = null
    }
    if (this.innerTimerId) {
      clearTimeout(this.innerTimerId)
      this.innerTimerId = null
    }
    this.emitEndTurn()
  }

  private nextId(): string {
    return `mock-${++this.eventSeq}`
  }
}
```

#### Session Simulation Cycle

```
START → [3-8s pause] → Tool A start → [1-5s] → Tool A end →
        [3-8s pause] → Tool B start → [1-5s] → Tool B end →
        ... (repeat 10-30 times) ...
        → END → [10-30s idle] → START (new cycle)
```

---

### 4.4 Isometric Rendering Engine (`engine/renderer.ts`, `engine/isometric.ts`)

#### Isometric Coordinate System

The isometric view uses a 2:1 diamond (standard isometric projection):

```
                    ●
                   / \
                  /   \       TILE_WIDTH = 64px
                 /     \      TILE_HEIGHT = 32px
                ●       ●
                 \     /      Ratio: 2:1
                  \   /
                   \ /
                    ●
```

#### Coordinate Conversion

```typescript
// Tile size constants
const TILE_WIDTH = 64 // Diamond width in pixels
const TILE_HEIGHT = 32 // Diamond height in pixels

// Cartesian grid (col, row) → Screen pixel position
function cartesianToIso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2),
  }
}

// Screen pixel → Cartesian grid (for mouse hit-testing)
function isoToCartesian(
  screenX: number,
  screenY: number,
): { col: number; row: number } {
  return {
    col: Math.floor(
      (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2,
    ),
    row: Math.floor(
      (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2,
    ),
  }
}
```

#### Rendering Order (Painter's Algorithm)

For isometric rendering, tiles and entities must be drawn back-to-front to handle overlapping correctly.

> **Interpolation**: The `render()` callback receives an `interpolation` factor (0.0–1.0) representing progress between fixed update steps. This should be used to interpolate the character's visual position between its last-update position and current position, producing smoother movement that isn't locked to the fixed timestep. Without interpolation, movement appears to "stutter" at low update rates.

```typescript
function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  interpolation: number,
): void {
  const { camera, world, character } = state

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.save()

  // Apply camera transform
  ctx.translate(camera.offsetX, camera.offsetY)
  ctx.scale(camera.zoom, camera.zoom)

  // 1. Render floor tiles (bottom layer, row by row, col by col)
  for (let row = 0; row < world.height; row++) {
    for (let col = 0; col < world.width; col++) {
      renderFloorTile(ctx, world.tiles[row][col], col, row)
    }
  }

  // 2. Collect all entities (walls, furniture, character) for z-sorting
  const entities: Renderable[] = []

  // Add wall segments
  for (const wall of world.walls) {
    entities.push({ ...wall, sortY: wall.row + wall.col })
  }

  // Add furniture
  for (const item of world.furniture) {
    entities.push({ ...item, sortY: item.row + item.col })
  }

  // Add character (interpolated position for smooth rendering)
  const renderCol =
    character.state === 'walking' && character.prevPosition
      ? lerp(character.prevPosition.col, character.position.col, interpolation)
      : character.position.col
  const renderRow =
    character.state === 'walking' && character.prevPosition
      ? lerp(character.prevPosition.row, character.position.row, interpolation)
      : character.position.row
  entities.push({
    type: 'character',
    col: renderCol,
    row: renderRow,
    sortY: renderRow + renderCol,
    render: () => renderCharacter(ctx, character, renderCol, renderRow),
  })

  // 3. Sort by sortY (back-to-front), then by sortX for same row
  entities.sort((a, b) => a.sortY - b.sortY)

  // 4. Render entities in sorted order
  for (const entity of entities) {
    entity.render(ctx)
  }

  // 5. Render UI overlays (emotion bubble, debug grid)
  if (character.emotion !== 'none') {
    renderEmotionBubble(ctx, character)
  }

  ctx.restore()
}
```

#### DPR (Device Pixel Ratio) Handling

```typescript
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  // Set actual canvas size in device pixels
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  // Scale CSS size to CSS pixels
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  const ctx = canvas.getContext('2d')!

  // Scale context to account for DPR
  ctx.scale(dpr, dpr)

  // Pixel-perfect rendering: disable smoothing
  ctx.imageSmoothingEnabled = false

  return ctx
}
```

#### Runtime DPR Changes

DPR can change at runtime when the user drags the browser window between monitors with different pixel densities (e.g., Retina → external 1080p). We must detect this and re-setup the canvas.

```typescript
// In CanvasView.tsx — watch for DPR changes
function useDPRWatcher(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onDPRChange: () => void,
) {
  useEffect(() => {
    let currentDPR = window.devicePixelRatio

    // matchMedia approach: fires when DPR crosses the current value
    const updateDPR = () => {
      const newDPR = window.devicePixelRatio
      if (newDPR !== currentDPR) {
        currentDPR = newDPR
        onDPRChange() // Re-run setupCanvas()
      }
      // Re-register for the next change (matchMedia is one-shot for a given threshold)
      registerMediaQuery()
    }

    let mql: MediaQueryList | null = null
    const registerMediaQuery = () => {
      mql?.removeEventListener('change', updateDPR)
      mql = window.matchMedia(`(resolution: ${currentDPR}dppx)`)
      mql.addEventListener('change', updateDPR)
    }

    registerMediaQuery()
    return () => mql?.removeEventListener('change', updateDPR)
  }, [onDPRChange])
}
```

---

### 4.5 Character State Machine (`engine/character.ts`)

#### State Diagram

```
                          GOTO_ROOM
               ┌──────────────────────────────┐
               │                              │
               ▼         arrives at           │
            WALKING ──────────────→ target    │
               ▲         destination   │      │
               │                       │      │
      GOTO_ROOM│              ┌────────┴──────┴───────┐
      (new room│              │   Route to animation   │
       needed) │              │   based on action type  │
               │              └────────┬───────────────┘
               │                       │
               │         ┌─────────────┼──────────────┐
               │         ▼             ▼              ▼
               │      TYPING       SITTING        SLEEPING
               │      (office)   (living room)    (bedroom)
               │         │             │              │
               │         │        ┌────┘              │
               │         ▼        ▼                   ▼
               │      IDLE ◄── timeout (5s) ── THINKING
               │         │
               │         │ idle > 30s
               │         ▼
               │      SLEEPING (auto)
               │
               └───── GOTO_ROOM triggers new walk
```

#### State Definition

```typescript
interface CharacterState {
  // Position (can be fractional during movement)
  position: { col: number; row: number }

  // Current FSM state
  state: CharacterFSMState

  // Current emotion
  emotion: EmotionId

  // Walking path (if WALKING)
  path: TileCoord[] | null
  pathIndex: number

  // Animation
  currentAnimation: AnimationId
  animationFrame: number
  animationTimer: number

  // Direction the character is facing
  direction: Direction

  // Action queue
  pendingActions: CharacterAction[]
}

type CharacterFSMState =
  | 'idle'
  | 'walking'
  | 'typing'
  | 'sitting'
  | 'sleeping'
  | 'thinking'
  | 'celebrating'

type Direction = 'ne' | 'nw' | 'se' | 'sw'

interface TileCoord {
  col: number
  row: number
}
```

#### Update Logic

```typescript
function updateCharacter(
  character: CharacterState,
  dt: number,
  world: WorldState,
): void {
  switch (character.state) {
    case 'idle':
      // Check for pending actions
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world)
      }
      // Auto-sleep after 30s idle
      character.idleTimer += dt
      if (character.idleTimer > IDLE_SLEEP_THRESHOLD) {
        transitionTo(character, 'sleeping', 'sleepy')
      }
      break

    case 'walking':
      moveAlongPath(character, dt)
      if (hasReachedDestination(character)) {
        // Transition to target state
        transitionTo(character, character.targetState, character.targetEmotion)
      }
      break

    case 'typing':
    case 'sitting':
    case 'thinking':
    case 'sleeping':
    case 'celebrating':
      // Check for pending actions (can interrupt)
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world)
      }
      break
  }

  // Update animation frame
  updateAnimation(character, dt)
}

function processAction(
  character: CharacterState,
  action: CharacterAction,
  world: WorldState,
): void {
  switch (action.type) {
    case 'GOTO_ROOM': {
      const room = world.rooms[action.room]
      const targetTile = room.activityZone // Where to sit/stand in the room
      const path = findPath(
        character.position,
        targetTile,
        world.walkabilityGrid,
      )

      if (path && path.length > 0) {
        character.state = 'walking'
        character.path = path
        character.pathIndex = 0
        character.targetState =
          action.animation === 'type'
            ? 'typing'
            : action.animation === 'sleep'
              ? 'sleeping'
              : action.animation === 'think'
                ? 'thinking'
                : 'sitting'
        character.targetEmotion = action.emotion
      } else {
        // Already at destination or no path found
        transitionTo(
          character,
          mapAnimationToState(action.animation),
          action.emotion,
        )
      }
      break
    }

    case 'WAKE_UP':
      if (character.state === 'sleeping') {
        character.emotion = 'thinking'
        character.state = 'idle'
        character.idleTimer = 0
      }
      break

    case 'GO_SLEEP':
      processAction(
        character,
        {
          type: 'GOTO_ROOM',
          room: 'bedroom',
          animation: 'sleep',
          emotion: 'sleepy',
        },
        world,
      )
      break

    case 'CELEBRATE':
      transitionTo(character, 'celebrating', 'happy')
      break

    case 'CONFUSED':
      character.emotion = 'confused'
      break
  }
}
```

---

### 4.6 Pathfinding System (`engine/pathfinding.ts`)

#### Walkability Grid

Each tile in the world has a walkability flag:

```typescript
type WalkabilityGrid = boolean[][] // true = walkable, false = blocked

function buildWalkabilityGrid(world: WorldState): WalkabilityGrid {
  const grid: boolean[][] = []

  for (let row = 0; row < world.height; row++) {
    grid[row] = []
    for (let col = 0; col < world.width; col++) {
      const tile = world.tiles[row][col]
      const furniture = world.furnitureAt(col, row)

      grid[row][col] =
        (tile.type === TileType.FLOOR || tile.type === TileType.DOOR) &&
        (!furniture || furniture.walkable)
    }
  }

  return grid
}
```

#### BFS Implementation

```typescript
interface PathNode {
  col: number
  row: number
  parent: PathNode | null
}

function findPath(
  from: TileCoord,
  to: TileCoord,
  grid: WalkabilityGrid,
): TileCoord[] | null {
  if (!grid[to.row]?.[to.col]) return null // Destination not walkable

  const visited = new Set<string>()
  const queue: PathNode[] = [{ col: from.col, row: from.row, parent: null }]
  visited.add(`${from.col},${from.row}`)

  // 4-directional neighbors (no diagonals for isometric movement)
  const dirs = [
    { dc: 1, dr: 0 }, // east
    { dc: -1, dr: 0 }, // west
    { dc: 0, dr: 1 }, // south
    { dc: 0, dr: -1 }, // north
  ]

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current.col === to.col && current.row === to.row) {
      // Reconstruct path
      const path: TileCoord[] = []
      let node: PathNode | null = current
      while (node) {
        path.unshift({ col: node.col, row: node.row })
        node = node.parent
      }
      return path
    }

    for (const dir of dirs) {
      const nc = current.col + dir.dc
      const nr = current.row + dir.dr
      const key = `${nc},${nr}`

      if (
        nr >= 0 &&
        nr < grid.length &&
        nc >= 0 &&
        nc < grid[0].length &&
        grid[nr][nc] &&
        !visited.has(key)
      ) {
        visited.add(key)
        queue.push({ col: nc, row: nr, parent: current })
      }
    }
  }

  return null // No path found
}
```

#### Movement Interpolation

```typescript
function moveAlongPath(character: CharacterState, dt: number): void {
  if (!character.path || character.pathIndex >= character.path.length) return

  const target = character.path[character.pathIndex]
  const dx = target.col - character.position.col
  const dy = target.row - character.position.row
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < 0.05) {
    // Snap to tile
    character.position.col = target.col
    character.position.row = target.row
    character.pathIndex++

    // Update facing direction
    if (character.pathIndex < character.path.length) {
      const next = character.path[character.pathIndex]
      character.direction = getDirection(character.position, next)
    }
  } else {
    // Move toward target
    const speed = CHARACTER_SPEED * dt
    character.position.col += (dx / distance) * speed
    character.position.row += (dy / distance) * speed
  }
}
```

---

### 4.7 Game Loop (`engine/gameLoop.ts`)

#### Fixed Timestep with Variable Rendering

```typescript
const FIXED_DT = 1 / 60 // 60 updates per second
const MAX_FRAME_DT = 0.1 // Cap to prevent spiral of death

class GameLoop {
  private running = false
  private lastTime = 0
  private accumulator = 0
  private rafId = 0

  constructor(
    private update: (dt: number) => void,
    private render: (interpolation: number) => void,
  ) {}

  start(): void {
    this.running = true
    this.lastTime = performance.now()
    this.tick(this.lastTime)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private tick = (currentTime: number): void => {
    if (!this.running) return

    let frameDt = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    // Prevent spiral of death
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT

    this.accumulator += frameDt

    // Fixed timestep updates
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT)
      this.accumulator -= FIXED_DT
    }

    // Render with interpolation factor
    const interpolation = this.accumulator / FIXED_DT
    this.render(interpolation)

    this.rafId = requestAnimationFrame(this.tick)
  }
}
```

#### Tab Visibility Handling

When the browser tab is hidden, `requestAnimationFrame` pauses but Bridge WebSocket events continue arriving. We must handle this to avoid a burst of stale actions when the tab becomes visible again.

```typescript
// In the GameLoop or a dedicated VisibilityManager:
class VisibilityManager {
  private wasHidden = false
  private eventBuffer: SessionLogEvent[] = []
  private readonly MAX_BUFFER_SIZE = 50

  constructor(
    private gameLoop: GameLoop,
    private connectionManager: ConnectionManager,
  ) {
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      // Tab hidden: buffer incoming events instead of processing them
      this.wasHidden = true
      this.connectionManager.setBuffering(true)
    } else {
      // Tab visible again: process only the LATEST state, discard intermediate events
      if (this.wasHidden) {
        this.wasHidden = false
        this.connectionManager.setBuffering(false)

        // Only process the last meaningful event (latest tool or lifecycle)
        // to avoid the character replaying 30 seconds of stale activity
        this.connectionManager.flushToLatestState()

        // Reset the game loop's accumulator to avoid a massive dt spike
        this.gameLoop.resetAccumulator()
      }
    }
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }
}
```

---

## 5. Data Flow

### 5.1 Complete Data Flow Diagram

```
~/.openclaw/agents/main/sessions/<session-id>.jsonl
         │
         │  JSONL append (OpenClaw writes in real-time)
         │
         ▼
┌──────────────────────┐
│  Bridge Server       │  bridge/server.ts (Node.js, ~50-80 lines)
│                      │
│  fs.watch + readline │  Monitor file changes, parse line by line
│  sessions.json poll  │  Detect session switches
└────────┬─────────────┘
         │  WebSocket push (ws://127.0.0.1:18790)
         │  Each JSONL line → JSON object
         ▼
┌─────────────────┐
│  BridgeClient    │  connection/bridgeClient.ts
│  (or MockProvider│  connection/mockProvider.ts
│   if offline)    │
└────────┬────────┘
         │  SessionLogEvent
         ▼
┌─────────────────┐
│  EventParser     │  connection/eventParser.ts
│                  │
│  parseSession()  │
└────────┬────────┘
         │  CharacterAction
         ▼
┌─────────────────┐
│ ConnectionMgr   │  connection/connectionManager.ts
│                  │
│ emits to:        │
│ - GameState      │──────────────────┐
│ - EventBus       │──────────┐       │
└─────────────────┘          │       │
                              │       │
                   EventBus   │       │ action dispatch
                   (UI updates│       │
                    throttled)│       │
                              ▼       ▼
                     ┌──────────────────────┐
                     │     GameState         │  engine/gameState.ts
                     │                      │
                     │  character ◄─── update(dt) ◄─── GameLoop
                     │  world                │              │
                     │  camera               │              │
                     └──────────┬───────────┘              │
                                │                           │
                                │ read state                │
                                ▼                           │
                     ┌──────────────────────┐              │
                     │     Renderer          │  engine/renderer.ts
                     │                      │              │
                     │  renderFrame(ctx,     │ ◄────────────┘
                     │    gameState)         │   render(interpolation)
                     └──────────┬───────────┘
                                │
                                │ draw calls
                                ▼
                          ┌──────────┐
                          │ <canvas> │
                          └──────────┘
```

### 5.2 UI Update Flow

```
GameState mutation
       │
       │ emit('stateChange', { type, data })
       ▼
   EventBus
       │
       │  throttled (250ms max)
       ▼
  React components
  (Dashboard, ConnectionBadge)
       │
       │ setState / useReducer dispatch
       ▼
  React re-render (UI only, not canvas)
```

---

## 6. Sprite Asset Specification

### 6.1 Isometric Tile Dimensions

```
Standard tile:    64 x 32 px  (2:1 ratio diamond)
Tall tile (wall): 64 x 64 px  (diamond + 32px height)
Character:        32 x 48 px  (fits within a tile, taller for head/hat)
Furniture:        varies, typically 64 x 64 to 128 x 96 px
Emotion bubble:   16 x 16 px  (floats above character head)
```

### 6.2 Character Spritesheet Format

Each animation is a horizontal strip of frames in a single PNG:

```
┌────┬────┬────┬────┐
│ F0 │ F1 │ F2 │ F3 │   idle_sw.png (4 frames, 32x48 each)
└────┴────┴────┴────┘

Total spritesheet per animation:
  - idle:      4 frames × 4 directions = 16 frames (or single direction if symmetric)
  - walk:      6 frames × 4 directions = 24 frames
  - type:      4 frames × 1 direction  = 4 frames (always facing desk)
  - sleep:     4 frames × 1 direction  = 4 frames (always in bed)
  - sit:       2 frames × 2 directions = 4 frames
  - think:     4 frames × 1 direction  = 4 frames
  - celebrate: 6 frames × 1 direction  = 6 frames
```

### 6.3 Animation Timing

```typescript
const ANIMATION_CONFIG: Record<AnimationId, AnimationConfig> = {
  idle: { frameCount: 4, fps: 2, loop: true },
  walk: { frameCount: 6, fps: 8, loop: true },
  type: { frameCount: 4, fps: 6, loop: true },
  sleep: { frameCount: 4, fps: 1, loop: true },
  sit: { frameCount: 2, fps: 1, loop: true },
  think: { frameCount: 4, fps: 2, loop: true },
  celebrate: { frameCount: 6, fps: 4, loop: false },
}
```

### 6.4 Initial Sprite Strategy

For MVP, sprites can be **programmatically generated** (colored rectangles with minimal detail) to unblock development. High-fidelity pixel art can be swapped in later without code changes, as long as the frame dimensions match.

```typescript
// Placeholder sprite generator (for development)
function generatePlaceholderSprite(
  width: number,
  height: number,
  color: string,
  label: string,
): ImageBitmap {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!

  // Simple colored rectangle
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)

  // Label
  ctx.fillStyle = '#fff'
  ctx.font = '8px monospace'
  ctx.fillText(label, 2, height / 2)

  return canvas.transferToImageBitmap()
}
```

---

## 7. Session Log Format Reference

### 7.1 File Structure

```
~/.openclaw/agents/main/sessions/
├── sessions.json                                    # Index file for all sessions
├── e85b6d26-7bca-40bb-bfdf-5544b2616997.jsonl       # Session log (append-only)
├── 0772f97a-487c-4f72-9e07-1877e998bb05.jsonl       # Another session log
└── ...
```

**sessions.json** structure:

```json
{
  "agent:main:main": {
    "sessionId": "e85b6d26-7bca-40bb-bfdf-5544b2616997",
    "sessionFile": "/Users/.../.openclaw/agents/main/sessions/e85b6d26-....jsonl",
    "updatedAt": 1774261033176
  }
}
```

The Bridge Server reads `sessions.json`, sorts by `updatedAt` descending, and selects the most recently active session for monitoring.

### 7.2 JSONL Event Format

Each line in a `.jsonl` file is an independent JSON object. All events share these base fields:

```typescript
interface SessionLogEvent {
  type:
    | 'session'
    | 'message'
    | 'model_change'
    | 'thinking_level_change'
    | 'custom'
  id: string // Unique event ID
  parentId?: string // Parent event ID (used to correlate toolResult → assistant message)
  timestamp: string // ISO 8601 (e.g. "2026-03-22T10:15:30.123Z")
}
```

### 7.3 Event Type Details

**Session Initialization**:

```typescript
// type: "session" — first line of file, session metadata
{
  type: "session",
  id: "...",
  version: 3,
  cwd: "/Users/yao/project",
  timestamp: "..."
}
```

**Model Configuration Change**:

```typescript
// type: "model_change"
{
  type: "model_change",
  id: "...",
  provider: "github-copilot",
  modelId: "claude-opus-4.6",
  timestamp: "..."
}
```

**User Message**:

```typescript
// type: "message", role: "user"
{
  type: "message",
  id: "...",
  role: "user",
  message: {
    role: "user",
    content: "Please help me edit this file"
  },
  timestamp: "..."
}
```

**Assistant Message** (can contain multiple content types):

```typescript
// type: "message", role: "assistant"
{
  type: "message",
  id: "...",
  role: "assistant",
  message: {
    role: "assistant",
    content: [
      { type: "text", text: "Let me help you edit the file..." },
      { type: "thinking", thinking: "Analyzing file structure..." },
      {
        type: "toolCall",
        id: "toolu_vrtx_01SoDRWrP4PjH37XhzVp1TDp",
        name: "edit",     // Note: lowercase
        arguments: { filePath: "...", oldString: "...", newString: "..." }
      }
    ],
    usage: {
      input: 1234,
      output: 567,
      cacheRead: 890,
      cacheWrite: 123,
      totalTokens: 2814,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason: "toolUse",  // "toolUse" = continuing, "stop" = done
    timestamp: 1774259409091
  },
  timestamp: "..."
}
```

**Tool Execution Result**:

```typescript
// type: "message", role: "toolResult"
{
  type: "message",
  id: "...",
  parentId: "...",     // Points to the corresponding assistant message
  message: {
    role: "toolResult",
    toolCallId: "toolu_vrtx_01SoDRWrP4PjH37XhzVp1TDp",
    toolName: "edit",
    content: [
      { type: "text", text: "File successfully modified" }
    ],
    details: {
      status: "completed",
      exitCode: 0,
      durationMs: 150,
      cwd: "/Users/..."
    },
    isError: false,
    timestamp: 1774259414178
  },
  timestamp: "..."
}
```

### 7.4 Tool Name Mapping

Tool names in session logs are **lowercase**, different from Gateway's capitalized naming:

| Session Log tool name | Corresponding operation | Watch Claw room mapping         |
| --------------------- | ----------------------- | ------------------------------- |
| `exec`                | Execute shell command   | `office` (type, serious)        |
| `read`                | Read file               | `living-room` (sit, thinking)   |
| `write`               | Write new file          | `office` (type, focused)        |
| `edit`                | Edit existing file      | `office` (type, focused)        |
| `glob`                | File pattern search     | `living-room` (sit, curious)    |
| `grep`                | Content search          | `living-room` (sit, curious)    |
| `web_search`          | Web search              | `living-room` (think, curious)  |
| `memory_search`       | Memory search           | `living-room` (think, thinking) |
| `task`                | Launch subtask          | `living-room` (think, thinking) |
| `todowrite`           | Update todo list        | `office` (type, focused)        |
| Other unknown tools   | Default handling        | `office` (type, focused)        |

> **Note**: The table above shows common tools. For the complete mapping including `memory_get`, `process`, `sessions_spawn`, `sessions_send`, `sessions_list`, `sessions_history`, see the `TOOL_ROOM_MAP` in Section 4.2.

### 7.5 Key Field Reference

| Field        | Description                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `stopReason` | `"toolUse"` = agent is using tools, will continue; `"stop"` = turn ended                          |
| `usage`      | Token usage, includes input/output/cacheRead/cacheWrite                                           |
| `cost`       | Dollar cost of this request                                                                       |
| `parentId`   | `toolResult` uses this field to correlate to the `assistant` message that initiated the tool call |
| `version`    | Session format version (currently 3)                                                              |
| `content[]`  | A single assistant message can contain multiple `toolCall`s, each must be processed               |

---

## 8. Error Handling Strategy

Errors are handled at each layer with the principle: **never crash the visualization**. The character should always be visible and responsive, even when the data source has issues.

### 8.1 Error Layers

| Layer                | Error Type                       | Handling                                            | User Impact                                          |
| -------------------- | -------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| **Bridge Server**    | Session log file not found       | Wait for file to appear, retry periodically         | Badge shows "Waiting", character stays idle          |
| **Bridge Server**    | sessions.json read failure       | Use last known session, log warning                 | None — continue monitoring current session           |
| **Bridge WebSocket** | Connection refused (Bridge down) | Auto-reconnect with backoff; switch to MockProvider | Badge shows "Mock", character continues in mock mode |
| **Bridge WebSocket** | Connection dropped               | Reconnect; buffer events during reconnect           | Brief "Reconnecting..." badge, then resume           |
| **Bridge WebSocket** | Malformed message (invalid JSON) | Log warning, skip line, continue                    | None — silently ignored                              |
| **EventParser**      | Unknown event type               | Return `null`, log debug message                    | None — event ignored                                 |
| **EventParser**      | Unknown tool name                | Map to default room (office), log warning           | Character goes to office (sensible default)          |
| **ActionQueue**      | Queue overflow                   | Drop lowest-priority action                         | Character skips less important animations            |
| **Pathfinding**      | No path found                    | Character stays in current room, log warning        | Character doesn't move (safe fallback)               |
| **Character FSM**    | Invalid state transition         | Ignore transition, log error                        | Character stays in current state                     |
| **Renderer**         | Sprite load failure              | Use colored rectangle placeholder                   | Slightly degraded visuals, still functional          |
| **Renderer**         | Canvas context lost              | Re-acquire context, re-initialize                   | Brief flicker, then resume                           |
| **GameLoop**         | Excessively large dt             | Cap at MAX_FRAME_DT (100ms)                         | Prevents spiral of death                             |

### 8.2 Error Reporting

```typescript
// Centralized error logger — all layers use this
interface ErrorLogger {
  // Errors: Something broke, needs attention
  error(module: string, message: string, context?: unknown): void

  // Warnings: Something unexpected but handled gracefully
  warn(module: string, message: string, context?: unknown): void

  // Debug: Verbose info for development
  debug(module: string, message: string, context?: unknown): void
}

// Implementation: logs to console in dev, could send to telemetry in prod
const logger: ErrorLogger = {
  error: (mod, msg, ctx) => console.error(`[${mod}] ${msg}`, ctx),
  warn: (mod, msg, ctx) => console.warn(`[${mod}] ${msg}`, ctx),
  debug: (mod, msg, ctx) => {
    if (import.meta.env.DEV) console.debug(`[${mod}] ${msg}`, ctx)
  },
}
```

### 8.3 Recovery Patterns

**Bridge WebSocket Recovery**:

1. Connection lost → state transitions to `reconnecting`
2. Exponential backoff retry (1s, 2s, 4s, ..., 30s max)
3. After 5 failed retries → switch to MockProvider, keep retrying in background
4. On successful reconnect → Bridge Server continues pushing new events from current file position
5. Resume event processing from current state (no history replay)

**Bridge Server Session Switch Recovery**:

1. Bridge Server periodically checks `sessions.json` for `updatedAt` changes
2. When a new most recently active session is detected → switch to new JSONL file
3. Notify all connected clients of session switch
4. Clients reset character state, begin processing new session's events

**Renderer Recovery**:

```typescript
// Handle canvas context loss (rare but possible on mobile/GPU reset)
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()
  gameLoop.pause()
})

canvas.addEventListener('webglcontextrestored', () => {
  // Re-initialize rendering context
  setupCanvas(canvas)
  gameLoop.resume()
})
// Note: For Canvas 2D, context loss is rarer but we handle
// getContext('2d') returning null defensively.
```

**Graceful Degradation Priority**:

1. Character is always visible (even as a colored rectangle)
2. Character always responds to events (even if animations degrade)
3. Dashboard always shows connection status
4. Mock mode is always available as a fallback

---

## 9. Development Workflow

### 9.1 Local Development

```bash
# Install dependencies
pnpm install

# Start dev server (with HMR) + Bridge Server
pnpm dev
# Internally runs: concurrently "vite" "tsx bridge/server.ts"

# The app opens at http://localhost:5173
# Bridge Server runs at ws://127.0.0.1:18790
# If OpenClaw has an active session, Bridge auto-monitors the latest session log
# If Bridge is not running or no session log exists, falls back to mock mode
```

### 9.2 Build & Preview

```bash
# Production build
pnpm build

# Preview production build locally
pnpm preview

# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test
```

### 9.3 Dev Mode Features

- **Mock mode indicator**: Clear visual badge showing "MOCK" when using simulated data
- **Debug grid overlay**: Toggle isometric grid lines for tile alignment
- **FPS counter**: Shows current frame rate
- **Event log**: Console-style log of all incoming Session Log events
- **Hot reload**: Vite HMR for instant feedback on code changes
- **Bridge status**: Shows Bridge Server connection status and currently monitored session ID

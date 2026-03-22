# Watch Claw - Technical Design Document

> **Version**: 0.1.0 (Draft)
> **Date**: 2026-03-22
> **Status**: In Progress

---

## 1. Tech Stack

### 1.1 Selection Summary

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Language** | TypeScript 5.x (strict mode) | Type safety for game state, event parsing, and WebSocket protocol |
| **UI Framework** | React 18 | Only used for overlay UI (dashboard, controls); game state lives outside React |
| **Rendering** | Canvas 2D API | Pixel-perfect control, integer scaling, no WebGL complexity needed for this scale |
| **Build Tool** | Vite 6 | Fast HMR, native TS support, simple config, proven in both reference projects |
| **Communication** | Native WebSocket API | Direct connection to OpenClaw Gateway, no wrapper library needed |
| **State Management** | Imperative game state + React useReducer (UI only) | Game world state outside React avoids re-render overhead on every frame |
| **Package Manager** | pnpm | Fast, disk-efficient, strict dependency resolution |
| **Linting** | ESLint + Prettier | Consistent code style, type-aware linting |
| **Testing** | Vitest | Fast unit tests, compatible with Vite, native TS support |

### 1.2 Why Not...

| Alternative | Why we chose differently |
|-------------|------------------------|
| **Phaser / PixiJS** | Overkill for a single-character isometric scene; brings large bundle and API surface we don't need. Canvas 2D is sufficient and keeps the bundle small. |
| **WebGL / Three.js** | 2D pixel art doesn't benefit from GPU shaders. Canvas 2D with integer scaling gives pixel-perfect results more easily. |
| **Zustand / Redux** | Game state updates at 60fps. React state management would cause unnecessary re-renders. Imperative state with selective React updates is the proven pattern (used by Pixel Agents). |
| **Socket.IO** | OpenClaw Gateway uses a plain WebSocket protocol. Socket.IO adds unnecessary abstraction, reconnection logic we'd customize anyway, and bundle weight. |
| **Next.js / Remix** | No server-side rendering needed. This is a pure client-side SPA that connects to a local WebSocket. Vite is simpler and faster. |

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
│  │  │ Gateway  │  │ EventParser  │  │   MockProvider      │ │  │
│  │  │ Client   │→ │              │→ │ (fallback when GW   │ │  │
│  │  │ (WS)    │  │ GW Event →   │  │  is offline)        │ │  │
│  │  │         │  │ CharAction   │  │                     │ │  │
│  │  └──────────┘  └──────────────┘  └─────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          │ WebSocket                             │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   OpenClaw Gateway     │
              │   ws://127.0.0.1:18789 │
              │                        │
              │   - agent events       │
              │   - presence           │
              │   - health             │
              └────────────────────────┘
```

### 2.2 Layer Responsibilities

| Layer | Responsibility | React Aware? |
|-------|---------------|-------------|
| **Connection** | WebSocket lifecycle, event parsing, mock data generation | No |
| **Engine** | Game loop, rendering, character FSM, pathfinding, camera | No |
| **World** | Tile map data, room definitions, sprite data, furniture catalog | No |
| **UI** | Canvas DOM mounting, dashboard overlay, controls | Yes |

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

**Decision 3: WebSocket-first, file-tailing as fallback**

OpenClaw exposes a rich WebSocket protocol with typed events. This is superior to Pixel Agents' file-tailing approach because:
- Real-time push (no polling delay)
- Structured event types (no JSONL parsing ambiguity)
- Presence and health info included
- No file system access needed (works in browser without a bridge server)

If OpenClaw also writes JSONL session logs (like Claude Code), we may add file-tailing support in v1.0 as a secondary data source, but the WebSocket is the primary channel.

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
│   │   ├── types.ts                    # Gateway event type definitions
│   │   │                               #   - GatewayEvent (union type)
│   │   │                               #   - AgentLifecycleEvent
│   │   │                               #   - AgentToolEvent
│   │   │                               #   - AgentAssistantEvent
│   │   │                               #   - PresenceEvent, HealthEvent
│   │   │                               #   - CharacterAction (output type)
│   │   │
│   │   ├── gateway.ts                  # WebSocket client
│   │   │                               #   - connect(), disconnect()
│   │   │                               #   - Auto-reconnect with exp. backoff
│   │   │                               #   - Heartbeat (tick handling)
│   │   │                               #   - Event callback registration
│   │   │                               #   - Connection state machine:
│   │   │                               #     DISCONNECTED → CONNECTING → 
│   │   │                               #     HANDSHAKING → CONNECTED → 
│   │   │                               #     RECONNECTING
│   │   │
│   │   ├── eventParser.ts              # Event → CharacterAction mapper
│   │   │                               #   - parseAgentEvent()
│   │   │                               #   - mapToolToRoom()
│   │   │                               #   - mapToolToAnimation()
│   │   │                               #   - mapToolToEmotion()
│   │   │                               #   - Configurable mapping rules
│   │   │
│   │   ├── mockProvider.ts             # Mock event generator
│   │   │                               #   - Simulates realistic event sequences
│   │   │                               #   - Random tool calls with timing
│   │   │                               #   - Lifecycle start/end cycles
│   │   │                               #   - Auto-activates when GW offline
│   │   │
│   │   └── connectionManager.ts        # Orchestrator
│   │                                   #   - Manages gateway vs mock switching
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
│       │                               #   - WS_RECONNECT_BASE = 1000
│       │                               #   - WS_RECONNECT_MAX = 30000
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

### 4.1 WebSocket Client (`connection/gateway.ts`)

#### Connection State Machine

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
                    │ HANDSHAKING │ ──── handshake fail ──→ RECONNECTING
                    └──────┬──────┘
                           │ connect frame ACK
                           ▼
                    ┌─────────────┐
                    │  CONNECTED  │ ──── ws.onclose ──→ RECONNECTING
                    └─────────────┘
                           ▲
                           │ ws.onopen + handshake OK
                    ┌──────┴──────┐
                    │RECONNECTING │ ──── timeout (exp. backoff)
                    └─────────────┘      retries: 1s, 2s, 4s, 8s, ... 30s max
```

#### Interface

```typescript
interface GatewayClient {
  // Lifecycle
  connect(url: string): void;
  disconnect(): void;

  // State
  readonly state: ConnectionState;
  readonly isConnected: boolean;

  // Events
  onEvent(handler: (event: GatewayEvent) => void): () => void;
  onStateChange(handler: (state: ConnectionState) => void): () => void;

  // RPC (request/response)
  request(method: string, params?: unknown): Promise<unknown>;
}

type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'handshaking'
  | 'connected'
  | 'reconnecting';
```

#### Handshake Protocol

```typescript
// 1. Open WebSocket
const ws = new WebSocket('ws://127.0.0.1:18789');

// 2. Server may send connect.challenge (nonce)
// 3. Client sends connect frame
ws.send(JSON.stringify({
  type: 'req',
  id: generateId(),
  method: 'connect',
  params: {
    role: 'operator',
    clientType: 'watch-claw',
    version: '0.1.0',
  }
}));

// 4. Server responds with connect ACK
// 5. Server begins pushing events automatically
```

#### Heartbeat

OpenClaw Gateway sends periodic `tick` events. If no tick is received within `HEARTBEAT_TIMEOUT` (default: 60s), the client assumes connection is dead and triggers reconnect.

---

### 4.2 Event Parser (`connection/eventParser.ts`)

#### Input: Gateway Events

```typescript
// Raw event from WebSocket (server-push format)
interface GatewayFrame {
  type: 'event';
  event: string;        // 'agent' | 'presence' | 'health' | 'tick'
  payload: unknown;
  seq: number;
  stateVersion: number;
}

// Agent event payloads
interface AgentLifecyclePayload {
  stream: 'lifecycle';
  phase: 'start' | 'end' | 'error';
  runId: string;
  usage?: { inputTokens: number; outputTokens: number; };
  error?: string;
}

interface AgentToolPayload {
  stream: 'tool';
  toolName: string;     // 'Write' | 'Edit' | 'Read' | 'Bash' | 'Grep' | ...
  toolInput?: unknown;  // Tool parameters
  status: 'start' | 'update' | 'end';
  result?: unknown;     // Tool result (on 'end')
}

interface AgentAssistantPayload {
  stream: 'assistant';
  delta: string;        // Text chunk (streaming)
}
```

#### Output: Character Actions

```typescript
type CharacterAction =
  | { type: 'GOTO_ROOM'; room: RoomId; animation: AnimationId; emotion: EmotionId; }
  | { type: 'CHANGE_EMOTION'; emotion: EmotionId; }
  | { type: 'CHANGE_ANIMATION'; animation: AnimationId; }
  | { type: 'WAKE_UP'; }
  | { type: 'GO_SLEEP'; }
  | { type: 'CELEBRATE'; }
  | { type: 'CONFUSED'; };

type RoomId = 'office' | 'living-room' | 'bedroom';
type AnimationId = 'idle' | 'walk' | 'sit' | 'type' | 'sleep' | 'think' | 'celebrate';
type EmotionId = 'focused' | 'thinking' | 'sleepy' | 'happy' | 'confused' | 'curious' | 'serious' | 'satisfied' | 'none';
```

#### Mapping Rules

```typescript
function parseGatewayEvent(frame: GatewayFrame): CharacterAction | null {
  if (frame.event !== 'agent') return null;

  const payload = frame.payload;

  // Lifecycle events
  if (isLifecycle(payload)) {
    switch (payload.phase) {
      case 'start':
        return { type: 'WAKE_UP' };
      case 'end':
        return { type: 'GO_SLEEP' };
      case 'error':
        return { type: 'CONFUSED' };
    }
  }

  // Tool events (only react to 'start', ignore 'update'/'end')
  if (isTool(payload) && payload.status === 'start') {
    const mapping = TOOL_ROOM_MAP[payload.toolName];
    if (mapping) {
      return {
        type: 'GOTO_ROOM',
        room: mapping.room,
        animation: mapping.animation,
        emotion: mapping.emotion,
      };
    }
  }

  // Assistant streaming → typing in office
  // NOTE: LLM streaming sends 10-30 events/sec. We throttle assistant events
  // to emit at most 1 CharacterAction per second to avoid flooding the ActionQueue.
  // The throttle is applied here (not in the ActionQueue) because we want to
  // drop redundant events as early as possible in the pipeline.
  if (isAssistant(payload)) {
    if (!shouldThrottleAssistant()) {
      return {
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
      };
    }
    return null; // Throttled — skip this event
  }

  return null;
}

const TOOL_ROOM_MAP: Record<string, { room: RoomId; animation: AnimationId; emotion: EmotionId }> = {
  'Write':    { room: 'office',      animation: 'type',  emotion: 'focused'  },
  'Edit':     { room: 'office',      animation: 'type',  emotion: 'focused'  },
  'Bash':     { room: 'office',      animation: 'type',  emotion: 'serious'  },
  'Read':     { room: 'living-room', animation: 'sit',   emotion: 'thinking' },
  'Grep':     { room: 'living-room', animation: 'sit',   emotion: 'curious'  },
  'Glob':     { room: 'living-room', animation: 'sit',   emotion: 'curious'  },
  'WebFetch': { room: 'living-room', animation: 'sit',   emotion: 'curious'  },
  'Task':     { room: 'living-room', animation: 'think', emotion: 'thinking' },
};
```

#### Action Queue

When events arrive faster than the character can respond (e.g., character is walking), actions are queued with priority support:

```typescript
type ActionPriority = 'high' | 'medium' | 'low';

interface PrioritizedAction {
  action: CharacterAction;
  priority: ActionPriority;
  timestamp: number;
}

// Priority values for sorting (lower = higher priority)
const PRIORITY_ORDER: Record<ActionPriority, number> = {
  high: 0,    // lifecycle events (start, end, error)
  medium: 1,  // tool events
  low: 2,     // assistant streaming, idle transitions
};

class ActionQueue {
  private queue: PrioritizedAction[] = [];
  private readonly MAX_SIZE = 3;

  push(action: CharacterAction, priority: ActionPriority = 'medium'): void {
    const entry: PrioritizedAction = {
      action,
      priority,
      timestamp: Date.now(),
    };

    if (this.queue.length >= this.MAX_SIZE) {
      // Drop the lowest priority item (or oldest if same priority)
      const lowestIdx = this.findLowestPriorityIndex();
      if (PRIORITY_ORDER[priority] <= PRIORITY_ORDER[this.queue[lowestIdx].priority]) {
        this.queue.splice(lowestIdx, 1);
      } else {
        return; // New action is lower priority than everything in queue, discard it
      }
    }

    // Deduplicate: if the latest queued action targets the same room, replace it
    const lastIdx = this.queue.length - 1;
    const last = lastIdx >= 0 ? this.queue[lastIdx].action : null;
    if (last && last.type === 'GOTO_ROOM' && action.type === 'GOTO_ROOM' && last.room === action.room) {
      this.queue[lastIdx] = entry;
    } else {
      this.queue.push(entry);
    }

    // Sort by priority (high first), then by timestamp (oldest first)
    this.queue.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });
  }

  pop(): CharacterAction | undefined {
    const entry = this.queue.shift();
    return entry?.action;
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  private findLowestPriorityIndex(): number {
    let lowestIdx = 0;
    for (let i = 1; i < this.queue.length; i++) {
      if (PRIORITY_ORDER[this.queue[i].priority] > PRIORITY_ORDER[this.queue[lowestIdx].priority]) {
        lowestIdx = i;
      } else if (
        PRIORITY_ORDER[this.queue[i].priority] === PRIORITY_ORDER[this.queue[lowestIdx].priority] &&
        this.queue[i].timestamp < this.queue[lowestIdx].timestamp
      ) {
        lowestIdx = i; // Same priority, older item is lower value
      }
    }
    return lowestIdx;
  }
}
```

---

### 4.3 Mock Data Provider (`connection/mockProvider.ts`)

The mock provider simulates realistic OpenClaw activity for development and demos.

#### Behavior Simulation

```typescript
class MockProvider {
  private outerTimerId: number | null = null;
  private innerTimerId: number | null = null;
  private onEvent: (event: GatewayFrame) => void;

  start(onEvent: (event: GatewayFrame) => void): void {
    this.onEvent = onEvent;

    // Simulate a work session
    this.emitLifecycleStart();

    // Emit tool events at random intervals
    this.scheduleNextTool();
  }

  private scheduleNextTool(): void {
    const delay = randomBetween(3000, 8000); // 3-8 seconds between actions
    this.outerTimerId = window.setTimeout(() => {
      const tool = this.randomTool();
      this.emitToolStart(tool);

      // Tool duration: 1-5 seconds
      const duration = randomBetween(1000, 5000);
      this.innerTimerId = window.setTimeout(() => {
        this.innerTimerId = null;
        this.emitToolEnd(tool);
        this.scheduleNextTool();
      }, duration);
    }, delay);
  }

  private randomTool(): string {
    const tools = ['Write', 'Edit', 'Read', 'Bash', 'Grep', 'Glob', 'WebFetch', 'Task'];
    const weights = [25, 20, 20, 15, 8, 5, 5, 2]; // Write/Edit most common
    return weightedRandom(tools, weights);
  }

  stop(): void {
    if (this.outerTimerId) {
      clearTimeout(this.outerTimerId);
      this.outerTimerId = null;
    }
    if (this.innerTimerId) {
      clearTimeout(this.innerTimerId);
      this.innerTimerId = null;
    }
    this.emitLifecycleEnd();
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
const TILE_WIDTH = 64;   // Diamond width in pixels
const TILE_HEIGHT = 32;  // Diamond height in pixels

// Cartesian grid (col, row) → Screen pixel position
function cartesianToIso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2),
  };
}

// Screen pixel → Cartesian grid (for mouse hit-testing)
function isoToCartesian(screenX: number, screenY: number): { col: number; row: number } {
  return {
    col: Math.floor((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2),
    row: Math.floor((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2),
  };
}
```

#### Rendering Order (Painter's Algorithm)

For isometric rendering, tiles and entities must be drawn back-to-front to handle overlapping correctly.

> **Interpolation**: The `render()` callback receives an `interpolation` factor (0.0–1.0) representing progress between fixed update steps. This should be used to interpolate the character's visual position between its last-update position and current position, producing smoother movement that isn't locked to the fixed timestep. Without interpolation, movement appears to "stutter" at low update rates.

```typescript
function renderFrame(ctx: CanvasRenderingContext2D, state: GameState, interpolation: number): void {
  const { camera, world, character } = state;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();

  // Apply camera transform
  ctx.translate(camera.offsetX, camera.offsetY);
  ctx.scale(camera.zoom, camera.zoom);

  // 1. Render floor tiles (bottom layer, row by row, col by col)
  for (let row = 0; row < world.height; row++) {
    for (let col = 0; col < world.width; col++) {
      renderFloorTile(ctx, world.tiles[row][col], col, row);
    }
  }

  // 2. Collect all entities (walls, furniture, character) for z-sorting
  const entities: Renderable[] = [];

  // Add wall segments
  for (const wall of world.walls) {
    entities.push({ ...wall, sortY: wall.row + wall.col });
  }

  // Add furniture
  for (const item of world.furniture) {
    entities.push({ ...item, sortY: item.row + item.col });
  }

  // Add character (interpolated position for smooth rendering)
  const renderCol = character.state === 'walking' && character.prevPosition
    ? lerp(character.prevPosition.col, character.position.col, interpolation)
    : character.position.col;
  const renderRow = character.state === 'walking' && character.prevPosition
    ? lerp(character.prevPosition.row, character.position.row, interpolation)
    : character.position.row;
  entities.push({
    type: 'character',
    col: renderCol,
    row: renderRow,
    sortY: renderRow + renderCol,
    render: () => renderCharacter(ctx, character, renderCol, renderRow),
  });

  // 3. Sort by sortY (back-to-front), then by sortX for same row
  entities.sort((a, b) => a.sortY - b.sortY);

  // 4. Render entities in sorted order
  for (const entity of entities) {
    entity.render(ctx);
  }

  // 5. Render UI overlays (emotion bubble, debug grid)
  if (character.emotion !== 'none') {
    renderEmotionBubble(ctx, character);
  }

  ctx.restore();
}
```

#### DPR (Device Pixel Ratio) Handling

```typescript
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Set actual canvas size in device pixels
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Scale CSS size to CSS pixels
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d')!;

  // Scale context to account for DPR
  ctx.scale(dpr, dpr);

  // Pixel-perfect rendering: disable smoothing
  ctx.imageSmoothingEnabled = false;

  return ctx;
}
```

#### Runtime DPR Changes

DPR can change at runtime when the user drags the browser window between monitors with different pixel densities (e.g., Retina → external 1080p). We must detect this and re-setup the canvas.

```typescript
// In CanvasView.tsx — watch for DPR changes
function useDPRWatcher(canvasRef: React.RefObject<HTMLCanvasElement>, onDPRChange: () => void) {
  useEffect(() => {
    let currentDPR = window.devicePixelRatio;

    // matchMedia approach: fires when DPR crosses the current value
    const updateDPR = () => {
      const newDPR = window.devicePixelRatio;
      if (newDPR !== currentDPR) {
        currentDPR = newDPR;
        onDPRChange(); // Re-run setupCanvas()
      }
      // Re-register for the next change (matchMedia is one-shot for a given threshold)
      registerMediaQuery();
    };

    let mql: MediaQueryList | null = null;
    const registerMediaQuery = () => {
      mql?.removeEventListener('change', updateDPR);
      mql = window.matchMedia(`(resolution: ${currentDPR}dppx)`);
      mql.addEventListener('change', updateDPR);
    };

    registerMediaQuery();
    return () => mql?.removeEventListener('change', updateDPR);
  }, [onDPRChange]);
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
  position: { col: number; row: number };

  // Current FSM state
  state: CharacterFSMState;

  // Current emotion
  emotion: EmotionId;

  // Walking path (if WALKING)
  path: TileCoord[] | null;
  pathIndex: number;

  // Animation
  currentAnimation: AnimationId;
  animationFrame: number;
  animationTimer: number;

  // Direction the character is facing
  direction: Direction;

  // Action queue
  pendingActions: CharacterAction[];
}

type CharacterFSMState =
  | 'idle'
  | 'walking'
  | 'typing'
  | 'sitting'
  | 'sleeping'
  | 'thinking'
  | 'celebrating';

type Direction = 'ne' | 'nw' | 'se' | 'sw';

interface TileCoord {
  col: number;
  row: number;
}
```

#### Update Logic

```typescript
function updateCharacter(character: CharacterState, dt: number, world: WorldState): void {
  switch (character.state) {
    case 'idle':
      // Check for pending actions
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world);
      }
      // Auto-sleep after 30s idle
      character.idleTimer += dt;
      if (character.idleTimer > IDLE_SLEEP_THRESHOLD) {
        transitionTo(character, 'sleeping', 'sleepy');
      }
      break;

    case 'walking':
      moveAlongPath(character, dt);
      if (hasReachedDestination(character)) {
        // Transition to target state
        transitionTo(character, character.targetState, character.targetEmotion);
      }
      break;

    case 'typing':
    case 'sitting':
    case 'thinking':
    case 'sleeping':
    case 'celebrating':
      // Check for pending actions (can interrupt)
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world);
      }
      break;
  }

  // Update animation frame
  updateAnimation(character, dt);
}

function processAction(character: CharacterState, action: CharacterAction, world: WorldState): void {
  switch (action.type) {
    case 'GOTO_ROOM': {
      const room = world.rooms[action.room];
      const targetTile = room.activityZone; // Where to sit/stand in the room
      const path = findPath(character.position, targetTile, world.walkabilityGrid);

      if (path && path.length > 0) {
        character.state = 'walking';
        character.path = path;
        character.pathIndex = 0;
        character.targetState = action.animation === 'type' ? 'typing'
          : action.animation === 'sleep' ? 'sleeping'
          : action.animation === 'think' ? 'thinking'
          : 'sitting';
        character.targetEmotion = action.emotion;
      } else {
        // Already at destination or no path found
        transitionTo(character, mapAnimationToState(action.animation), action.emotion);
      }
      break;
    }

    case 'WAKE_UP':
      if (character.state === 'sleeping') {
        character.emotion = 'thinking';
        character.state = 'idle';
        character.idleTimer = 0;
      }
      break;

    case 'GO_SLEEP':
      processAction(character, {
        type: 'GOTO_ROOM', room: 'bedroom', animation: 'sleep', emotion: 'sleepy',
      }, world);
      break;

    case 'CELEBRATE':
      transitionTo(character, 'celebrating', 'happy');
      break;

    case 'CONFUSED':
      character.emotion = 'confused';
      break;
  }
}
```

---

### 4.6 Pathfinding System (`engine/pathfinding.ts`)

#### Walkability Grid

Each tile in the world has a walkability flag:

```typescript
type WalkabilityGrid = boolean[][];  // true = walkable, false = blocked

function buildWalkabilityGrid(world: WorldState): WalkabilityGrid {
  const grid: boolean[][] = [];

  for (let row = 0; row < world.height; row++) {
    grid[row] = [];
    for (let col = 0; col < world.width; col++) {
      const tile = world.tiles[row][col];
      const furniture = world.furnitureAt(col, row);

      grid[row][col] =
        (tile.type === TileType.FLOOR || tile.type === TileType.DOOR) &&
        (!furniture || furniture.walkable);
    }
  }

  return grid;
}
```

#### BFS Implementation

```typescript
interface PathNode {
  col: number;
  row: number;
  parent: PathNode | null;
}

function findPath(
  from: TileCoord,
  to: TileCoord,
  grid: WalkabilityGrid,
): TileCoord[] | null {
  if (!grid[to.row]?.[to.col]) return null; // Destination not walkable

  const visited = new Set<string>();
  const queue: PathNode[] = [{ col: from.col, row: from.row, parent: null }];
  visited.add(`${from.col},${from.row}`);

  // 4-directional neighbors (no diagonals for isometric movement)
  const dirs = [
    { dc: 1, dr: 0 },  // east
    { dc: -1, dr: 0 }, // west
    { dc: 0, dr: 1 },  // south
    { dc: 0, dr: -1 }, // north
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.col === to.col && current.row === to.row) {
      // Reconstruct path
      const path: TileCoord[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ col: node.col, row: node.row });
        node = node.parent;
      }
      return path;
    }

    for (const dir of dirs) {
      const nc = current.col + dir.dc;
      const nr = current.row + dir.dr;
      const key = `${nc},${nr}`;

      if (
        nr >= 0 && nr < grid.length &&
        nc >= 0 && nc < grid[0].length &&
        grid[nr][nc] &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push({ col: nc, row: nr, parent: current });
      }
    }
  }

  return null; // No path found
}
```

#### Movement Interpolation

```typescript
function moveAlongPath(character: CharacterState, dt: number): void {
  if (!character.path || character.pathIndex >= character.path.length) return;

  const target = character.path[character.pathIndex];
  const dx = target.col - character.position.col;
  const dy = target.row - character.position.row;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 0.05) {
    // Snap to tile
    character.position.col = target.col;
    character.position.row = target.row;
    character.pathIndex++;

    // Update facing direction
    if (character.pathIndex < character.path.length) {
      const next = character.path[character.pathIndex];
      character.direction = getDirection(character.position, next);
    }
  } else {
    // Move toward target
    const speed = CHARACTER_SPEED * dt;
    character.position.col += (dx / distance) * speed;
    character.position.row += (dy / distance) * speed;
  }
}
```

---

### 4.7 Game Loop (`engine/gameLoop.ts`)

#### Fixed Timestep with Variable Rendering

```typescript
const FIXED_DT = 1 / 60; // 60 updates per second
const MAX_FRAME_DT = 0.1; // Cap to prevent spiral of death

class GameLoop {
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private rafId = 0;

  constructor(
    private update: (dt: number) => void,
    private render: (interpolation: number) => void,
  ) {}

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (currentTime: number): void => {
    if (!this.running) return;

    let frameDt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Prevent spiral of death
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;

    this.accumulator += frameDt;

    // Fixed timestep updates
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    // Render with interpolation factor
    const interpolation = this.accumulator / FIXED_DT;
    this.render(interpolation);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
```

#### Tab Visibility Handling

When the browser tab is hidden, `requestAnimationFrame` pauses but WebSocket events continue arriving. We must handle this to avoid a burst of stale actions when the tab becomes visible again.

```typescript
// In the GameLoop or a dedicated VisibilityManager:
class VisibilityManager {
  private wasHidden = false;
  private eventBuffer: GatewayFrame[] = [];
  private readonly MAX_BUFFER_SIZE = 50;

  constructor(
    private gameLoop: GameLoop,
    private connectionManager: ConnectionManager,
  ) {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      // Tab hidden: buffer incoming events instead of processing them
      this.wasHidden = true;
      this.connectionManager.setBuffering(true);
    } else {
      // Tab visible again: process only the LATEST state, discard intermediate events
      if (this.wasHidden) {
        this.wasHidden = false;
        this.connectionManager.setBuffering(false);

        // Only process the last meaningful event (latest tool or lifecycle)
        // to avoid the character replaying 30 seconds of stale activity
        this.connectionManager.flushToLatestState();

        // Reset the game loop's accumulator to avoid a massive dt spike
        this.gameLoop.resetAccumulator();
      }
    }
  };

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
```

---

## 5. Data Flow

### 5.1 Complete Data Flow Diagram

```
OpenClaw Gateway (ws://127.0.0.1:18789)
         │
         │  WebSocket frames: { type: "event", event: "agent", payload: {...} }
         │
         ▼
┌─────────────────┐
│  GatewayClient   │  connection/gateway.ts
│  (or MockProvider│  connection/mockProvider.ts
│   if offline)    │
└────────┬────────┘
         │  GatewayFrame
         ▼
┌─────────────────┐
│  EventParser     │  connection/eventParser.ts
│                  │
│  parseGateway()  │
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
  idle:      { frameCount: 4, fps: 2,  loop: true  },
  walk:      { frameCount: 6, fps: 8,  loop: true  },
  type:      { frameCount: 4, fps: 6,  loop: true  },
  sleep:     { frameCount: 4, fps: 1,  loop: true  },
  sit:       { frameCount: 2, fps: 1,  loop: true  },
  think:     { frameCount: 4, fps: 2,  loop: true  },
  celebrate: { frameCount: 6, fps: 4,  loop: false },
};
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
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  // Simple colored rectangle
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Label
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.fillText(label, 2, height / 2);

  return canvas.transferToImageBitmap();
}
```

---

## 7. OpenClaw Gateway Protocol Reference

### 7.1 WebSocket Connection Flow

```
Client                                    Gateway
  │                                          │
  │──── WebSocket open ─────────────────────>│
  │                                          │
  │<──── connect.challenge (nonce) ──────────│  (optional, if auth required)
  │                                          │
  │──── req { method: "connect", params } ──>│
  │                                          │
  │<──── res { ok: true, payload } ──────────│
  │                                          │
  │<──── event { event: "presence" } ────────│  (initial state push)
  │<──── event { event: "health" } ──────────│
  │                                          │
  │      ... live event stream ...           │
  │<──── event { event: "agent", ... } ──────│
  │<──── event { event: "tick" } ────────────│  (periodic heartbeat)
  │<──── event { event: "agent", ... } ──────│
  │                                          │
  │──── req { method: "health" } ──────────> │  (on-demand polling)
  │<──── res { ok: true, payload } ──────────│
  │                                          │
```

### 7.2 Wire Format

```typescript
// Server → Client: Events (pushed)
interface ServerEvent {
  type: 'event';
  event: string;        // 'agent' | 'presence' | 'health' | 'tick' | ...
  payload: unknown;
  seq: number;          // Monotonic sequence number
  stateVersion: number;
}

// Client → Server: Request
interface ClientRequest {
  type: 'req';
  id: string;           // Unique request ID
  method: string;       // 'connect' | 'health' | 'system-presence' | ...
  params?: unknown;
}

// Server → Client: Response
interface ServerResponse {
  type: 'res';
  id: string;           // Matches request ID
  ok: boolean;
  payload?: unknown;
  error?: string;
}
```

### 7.3 Key Event Types for Watch Claw

| Event | Usage in Watch Claw |
|-------|-------------------|
| `agent` (lifecycle/start) | Wake up character, start activity cycle |
| `agent` (lifecycle/end) | Send character to bed, show completion stats |
| `agent` (lifecycle/error) | Show confused emotion, flash error in dashboard |
| `agent` (tool/*) | Route character to appropriate room based on tool name |
| `agent` (assistant) | Show typing animation in office |
| `presence` | Update connected devices count in dashboard |
| `health` | Update system health indicator in dashboard |
| `tick` | Heartbeat -- reset connection timeout |

### 7.4 Available RPC Methods (polling)

| Method | Response | Usage |
|--------|----------|-------|
| `health` | Gateway health snapshot | Dashboard system status |
| `system-presence` | All connected clients/nodes | Dashboard device list |
| `status` | Session status (model, tokens, cost) | Dashboard token counter |

---

## 8. Error Handling Strategy

Errors are handled at each layer with the principle: **never crash the visualization**. The character should always be visible and responsive, even when the data source has issues.

### 8.1 Error Layers

| Layer | Error Type | Handling | User Impact |
|-------|-----------|----------|-------------|
| **WebSocket** | Connection refused | Auto-reconnect with backoff; switch to MockProvider | Badge shows "Mock", character continues in mock mode |
| **WebSocket** | Connection dropped | Reconnect; buffer events during reconnect | Brief "Reconnecting..." badge, then resume |
| **WebSocket** | Malformed frame (invalid JSON) | Log warning, skip frame, continue | None — silently ignored |
| **EventParser** | Unknown event type | Return `null`, log debug message | None — event ignored |
| **EventParser** | Unknown tool name | Map to default room (office), log warning | Character goes to office (sensible default) |
| **ActionQueue** | Queue overflow | Drop lowest-priority action | Character skips less important animations |
| **Pathfinding** | No path found | Character stays in current room, log warning | Character doesn't move (safe fallback) |
| **Character FSM** | Invalid state transition | Ignore transition, log error | Character stays in current state |
| **Renderer** | Sprite load failure | Use colored rectangle placeholder | Slightly degraded visuals, still functional |
| **Renderer** | Canvas context lost | Re-acquire context, re-initialize | Brief flicker, then resume |
| **GameLoop** | Excessively large dt | Cap at MAX_FRAME_DT (100ms) | Prevents spiral of death |

### 8.2 Error Reporting

```typescript
// Centralized error logger — all layers use this
interface ErrorLogger {
  // Errors: Something broke, needs attention
  error(module: string, message: string, context?: unknown): void;

  // Warnings: Something unexpected but handled gracefully
  warn(module: string, message: string, context?: unknown): void;

  // Debug: Verbose info for development
  debug(module: string, message: string, context?: unknown): void;
}

// Implementation: logs to console in dev, could send to telemetry in prod
const logger: ErrorLogger = {
  error: (mod, msg, ctx) => console.error(`[${mod}] ${msg}`, ctx),
  warn:  (mod, msg, ctx) => console.warn(`[${mod}] ${msg}`, ctx),
  debug: (mod, msg, ctx) => {
    if (import.meta.env.DEV) console.debug(`[${mod}] ${msg}`, ctx);
  },
};
```

### 8.3 Recovery Patterns

**WebSocket Recovery**:
1. Connection lost → state transitions to `reconnecting`
2. Exponential backoff retry (1s, 2s, 4s, ..., 30s max)
3. After 5 failed retries → switch to MockProvider, keep retrying in background
4. On successful reconnect → fetch latest state via RPC `health` + `status`
5. Resume event processing from current state (no replay)

**Renderer Recovery**:
```typescript
// Handle canvas context loss (rare but possible on mobile/GPU reset)
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  gameLoop.pause();
});

canvas.addEventListener('webglcontextrestored', () => {
  // Re-initialize rendering context
  setupCanvas(canvas);
  gameLoop.resume();
});
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

# Start dev server (with HMR)
pnpm dev

# The app opens at http://localhost:5173
# If OpenClaw Gateway is running, it connects automatically
# Otherwise, it falls back to mock mode
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
- **Event log**: Console-style log of all incoming Gateway events
- **Hot reload**: Vite HMR for instant feedback on code changes

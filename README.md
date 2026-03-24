# Watch Claw

[中文](./README_CN.md)

> A pixel-art house where your OpenClaw AI lives -- watch it code, think, rest, and celebrate in real time.

![Watch Claw v0.2 Screenshot](./docs/assets/V0.2-demo.jpg)
_v0.2 running with programmatic placeholder art -- new front-end and pixel art assets are under active development._

**Watch Claw** is a real-time pixel-art visualization of the [OpenClaw](https://github.com/openclaw/openclaw) AI agent's working state. A lobster-hat character -- representing the OpenClaw agent -- lives in a cozy house, moving between rooms, performing activities, and expressing emotions based on the agent's actual runtime events.

The current version (v0.2) renders a single-floor house with three rooms using Canvas 2D. The project is actively migrating to **Phaser 3** with a side-view platformer style, expanding to a three-floor, nine-room house (v1.0).

## How It Works

```
OpenClaw runs a tool
       |
       v
Session JSONL file appended
       |
       v
Bridge Server (fs.watch) detects change, broadcasts via WebSocket
       |
       v
Watch Claw receives event, maps it to a CharacterAction
       |
       v
Character walks to the corresponding room, plays animation, shows emotion
```

A lightweight **Bridge Server** (Node.js) monitors OpenClaw's session log files (`~/.openclaw/agents/main/sessions/<session-id>.jsonl`), detects new entries via `fs.watch`, and pushes them to the browser over WebSocket (`ws://127.0.0.1:18790`). The front-end parses these events and translates them into character behaviors.

## Current State (v0.2)

v0.2 is fully working with a single-floor, three-room layout:

| Room         | Agent Activity                            | Character Behavior      | Emotion  |
| ------------ | ----------------------------------------- | ----------------------- | -------- |
| **Workshop** | `write`, `edit`, `exec`, assistant stream | Sitting at desk, typing | Focused  |
| **Study**    | `read`, `grep`, `glob`, `web_search`      | Browsing bookshelf      | Thinking |
| **Bedroom**  | Idle > 30s, session end                   | Sleeping in bed         | Sleepy   |

### What's Working

- **Bridge Server** -- watches the most recently active session JSONL, auto-detects session switches (polls every 2s), pushes events via WebSocket with auto-reconnect
- **Event parsing** -- maps tool calls (`write`, `edit`, `exec`, `read`, `grep`, `glob`, `web_search`, `task`) and lifecycle events to `CharacterAction` objects with priority-based queueing
- **Canvas 2D rendering** -- 3/4 top-down isometric view with painter's algorithm z-sorting, programmatic pixel-art furniture
- **Character state machine** -- idle, walk, sit, type, sleep, think, celebrate states with BFS tile-based pathfinding
- **Emotion bubbles** -- focused, thinking, sleepy, happy, confused, curious, serious, satisfied
- **Status dashboard** -- connection status, current agent state, session info, event log, FPS counter
- **Electron desktop app** -- standalone window with system tray, always-on-top option, macOS/Windows/Linux builds

## v1.0 Roadmap (Phaser 3 Migration)

v1.0 replaces the hand-written Canvas 2D renderer with **Phaser 3**, switching from a 3/4 top-down view to a **side-view platformer** style with physics-based movement (gravity, jumping, ladder climbing).

### Three-Floor House (9 Rooms)

```
         +-------------------------------------------------+
  3F     |  Warehouse       Study          Balcony          |
  Attic  |  (glob/files)    (read/grep)    (web_search)     |
         |      |--|            |--|                        |
         +------+  +------------+  +------------------------+
  2F     |  Toolbox         Office         Bedroom          |
  Main   |  (exec)          (write/edit)   (idle/sleep)     |
         |      |--|            |--|                        |
         +------+  +------------+  +------------------------+
  1F     |  Basement        Server Room    Trash            |
  Base   |  (task/agents)   (code)         (cleanup)        |
         +-------------------------------------------------+
              ^ ladders/stairs connect floors ^
```

### Migration Phases

| Phase | Scope                                      | Status  |
| ----- | ------------------------------------------ | ------- |
| P0    | Phaser bootstrap, React mount, loading bar | Pending |
| P1    | Tiled tilemap, collision, room detection   | Pending |
| P2    | Character sprite, FSM, physics, navigation | Pending |
| P3    | Event bridge, emotions, particle effects   | Pending |
| P4    | Dashboard update, sound, Electron polish   | Pending |
| P5    | Three-floor expansion, full event mapping  | Pending |

### Key Changes in v1.0

- **Phaser 3 Arcade Physics** -- gravity, velocity, platform colliders, ladder climbing zones
- **Tiled tilemap** -- visual map editing with collision layers and object layers (room zones, spawn points, activity spots)
- **Side-view platformer movement** -- walk, jump, climb (replaces BFS pathfinding)
- **9 rooms across 3 floors** -- each tool maps to a specific room
- **Sound effects** -- footsteps, typing, snoring, celebration chimes
- **Particle effects** -- confetti for celebration, sparks for errors, floating Z's for sleeping

## Tech Stack

| Layer           | Technology                        | Purpose                                                 |
| --------------- | --------------------------------- | ------------------------------------------------------- |
| Language        | TypeScript 5.x (strict)           | Type safety for game state, events, and protocol        |
| Game Engine     | Canvas 2D (v0.2), Phaser 3 (v1.0) | Rendering and physics                                   |
| UI Framework    | React 19                          | Overlay UI only (dashboard, controls)                   |
| Build Tool      | Vite 8                            | Fast HMR, native TS                                     |
| Desktop         | Electron                          | Standalone desktop app with system tray                 |
| Communication   | WebSocket (Bridge Server)         | Session log monitoring + real-time push                 |
| Map Editor      | Tiled (v1.0)                      | Visual tilemap editing with collision and object layers |
| Package Manager | pnpm                              | Fast, disk-efficient, strict dependencies               |
| Testing         | Vitest                            | Fast unit tests, Vite-compatible                        |
| Linting         | ESLint + Prettier                 | Consistent code style with Husky pre-commit hooks       |

## Architecture

```
+------------------------------------------------------------------+
|                     Electron Desktop App                          |
|                                                                   |
|  React Shell                                                      |
|  +---------------------------+  +------------------------------+  |
|  | PhaserContainer (v1.0)    |  | Dashboard.tsx                |  |
|  | or CanvasView (v0.2)      |  | (status, tokens, event log)  |  |
|  +------------+--------------+  +------------------------------+  |
|               |                                                   |
|               v                                                   |
|  Game Engine                                                      |
|  [Phaser Scene / Canvas 2D] <-- [Character FSM]                   |
|               ^                                                   |
|               | dispatch(CharacterAction)                         |
|  Connection Layer (stable, shared between v0.2 and v1.0)          |
|  [BridgeClient] --> [EventParser] --> [ActionQueue]               |
|  [ConnectionManager orchestrates all]                             |
+------------------------------------------------------------------+
                          |
                          | WebSocket (ws://127.0.0.1:18790)
                          v
                   Bridge Server (Node.js)
                          |
                          | fs.watch
                          v
              OpenClaw Session Log (JSONL)
              ~/.openclaw/agents/main/sessions/
```

### Connection Layer (stable across versions)

The connection layer is fully working and shared between v0.2 and v1.0:

- **BridgeClient** -- WebSocket client with exponential backoff reconnect (1s to 30s)
- **EventParser** -- maps session log events (tool calls, lifecycle, model changes) to `CharacterAction` objects
- **ActionQueue** -- priority queue (High > Medium > Low) that drops lowest-priority actions when full
- **ConnectionManager** -- orchestrates BridgeClient + EventParser, provides `onAction()`, `onStatusChange()`, `onEventLog()` subscriptions

## Event Mapping

| OpenClaw Event                  | Tool / Phase | Target Room | Animation  | Emotion  | Priority |
| ------------------------------- | ------------ | ----------- | ---------- | -------- | -------- |
| Session start (`type: session`) | --           | Study       | Wake up    | Thinking | High     |
| Session end (`stopReason`)      | --           | Bedroom     | Lie down   | Sleepy   | High     |
| Tool failure (exitCode != 0)    | --           | (current)   | Hold head  | Confused | High     |
| `tool: write`                   | write        | Workshop    | Typing     | Focused  | Medium   |
| `tool: edit`                    | edit         | Workshop    | Typing     | Focused  | Medium   |
| `tool: exec`                    | exec         | Workshop    | Typing     | Serious  | Medium   |
| `tool: read`                    | read         | Study       | Reading    | Curious  | Medium   |
| `tool: grep`                    | grep         | Study       | Searching  | Curious  | Medium   |
| `tool: glob`                    | glob         | Study       | Browsing   | Busy     | Medium   |
| `tool: web_search`              | web_search   | Study       | Browsing   | Curious  | Medium   |
| `tool: task`                    | task         | Study       | Whiteboard | Excited  | Medium   |
| Assistant streaming             | --           | Workshop    | Typing     | Focused  | Low      |
| Idle > 30s                      | --           | Bedroom     | Sleeping   | Sleepy   | Low      |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured

### Run

```bash
git clone https://github.com/luyao618/watch-claw-working.git
cd watch-claw-working
pnpm install
pnpm dev
```

This starts both the Vite dev server and the Bridge Server concurrently. Open `http://localhost:5173` in your browser.

The Bridge Server automatically locates the most recently active OpenClaw session at `~/.openclaw/agents/main/sessions/` and pushes events in real time. Start an OpenClaw session in another terminal to see the character react.

### Other Commands

```bash
pnpm build          # Production build
pnpm preview        # Preview production build
pnpm typecheck      # Type check
pnpm lint           # Lint
pnpm test           # Run tests
pnpm dev:electron   # Run as Electron desktop app
pnpm build:electron # Build Electron distributable
```

## Project Structure

```
watch-claw/
├── bridge/              # Bridge Server (Node.js, WebSocket relay)
│   └── server.ts        #   watches session JSONL -> WS push
├── electron/            # Electron desktop shell
│   ├── main.cjs
│   └── preload.cjs
├── src/
│   ├── connection/      # Connection layer (stable, DO NOT MODIFY)
│   │   ├── bridgeClient.ts       # WebSocket client with reconnect
│   │   ├── eventParser.ts        # Session log -> CharacterAction
│   │   ├── actionQueue.ts        # Priority queue
│   │   ├── connectionManager.ts  # Orchestrates connection
│   │   └── types.ts              # All shared types
│   ├── engine/          # Canvas 2D game engine (v0.2, to be replaced)
│   ├── world/           # Tilemap and room definitions (v0.2, to be replaced)
│   ├── ui/              # React overlay components
│   │   ├── CanvasView.tsx        # Game canvas mount
│   │   └── Dashboard.tsx         # Status panel
│   ├── utils/           # Shared utilities (eventBus, constants, helpers)
│   ├── App.tsx
│   └── main.tsx
├── public/assets/       # Game assets (sprites, tilesets, tilemaps)
├── docs/                # Documentation (PRD, Technical, Tasks)
└── scripts/             # Dev helper scripts
```

## Inspiration

| Project                                                           | What we borrow                     | What we do differently                                                                             |
| ----------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Pixel Agents](https://github.com/pablodelucca/pixel-agents)      | JSONL file watching, character FSM | Bridge Server push (not file tailing), side-view platformer (v1.0), single character, Electron app |
| [PixelHQ ULTRA](https://github.com/RemyLoveLogicAI/pixelhq-ultra) | Event-driven architecture          | Cozy home (not corporate office), physics-based movement (v1.0), high-fidelity pixel art           |

## Documentation

- [Product Requirements Document](./docs/PRD.md) ([中文](./docs/PRD_CN.md))
- [Technical Design Document](./docs/TECHNICAL.md) ([中文](./docs/TECHNICAL_CN.md))
- [Task Breakdown (v1.0)](./docs/TASKS.md) ([中文](./docs/TASKS_CN.md))
- [Archived Tasks (v0.2)](./docs/TASKS_v0.2_ARCHIVED.md) ([中文](./docs/TASKS_v0.2_ARCHIVED_CN.md))

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](./LICENSE) -- Copyright 2026 luyao618

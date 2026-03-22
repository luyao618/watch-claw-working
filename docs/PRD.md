# Watch Claw - Product Requirements Document

> **Version**: 0.1.0 (Draft)
> **Author**: luyao618
> **Date**: 2026-03-22
> **Status**: In Progress

---

## 1. Overview

**Watch Claw** is a real-time pixel-art visualization of the [OpenClaw](https://github.com/openclaw/openclaw) AI agent's working state. It renders an isometric, cross-section view of a cozy three-story house where a lobster-hat character -- representing the OpenClaw agent -- moves between rooms, performs activities, and expresses emotions based on the agent's actual runtime status.

The project connects directly to the OpenClaw Gateway via WebSocket (`ws://127.0.0.1:18789`), parses real-time agent events (tool calls, lifecycle phases, presence), and translates them into character behaviors: walking to the office to code, sitting on the couch to think, sleeping in bed when idle.

### One-liner

> A pixel-art house where your OpenClaw AI lives -- watch it code, think, rest, and celebrate in real time.

### Target Users

- OpenClaw users who want a fun, ambient visualization of their AI agent's activity
- Developers who enjoy pixel-art aesthetics and "digital pet" style companions

### Inspiration

This project draws inspiration from two existing projects:

| Project | What we borrow | What we do differently |
|---------|---------------|----------------------|
| [Pixel Agents](https://github.com/pablodelucca/pixel-agents) | JSONL file watching, character FSM, Canvas 2D rendering | We use WebSocket (not file tailing), isometric view (not top-down), single character (not multi-agent) |
| [PixelHQ ULTRA](https://github.com/RemyLoveLogicAI/pixelhq-ultra) | Event-driven architecture, personality engine | We focus on a cozy home (not corporate office), high-fidelity pixel art (not DOM tiles) |

---

## 2. Design Reference

### 2.1 Visual Style Reference

![Isometric House Reference](./assets/reference-isometric-house.png)

> **Note**: Please place the reference image at `docs/assets/reference-isometric-house.png`. This is the isometric pixel-art cross-section house image shared during brainstorming.

The reference image is a high-fidelity isometric pixel-art illustration of a three-story house where each room represents a computer system function (Documents, Cinema, Music, etc.). It features:

- **Isometric cross-section view** -- walls are "cut open" to reveal all rooms simultaneously
- **Warm wood-tone palette** -- cozy, lived-in feeling with rich details
- **Functional metaphors** -- each room maps to a system concept (file storage = bookshelves, trash = garbage bin, etc.)
- **Characters in context** -- a person sits at a computer desk, pets rest in the living room, a robot stands in the bedroom
- **Three distinct floors** connected by staircases:
  - **Ground floor (basement)**: Library/tools, trash, tool room (.bun), key vault (.ssh)
  - **Main floor**: Workspace with dual monitors, living room with fireplace + pets, application shelf, .claude memory room, .npm warehouse
  - **Attic**: Documents/AIGC projects, cinema, music room, MOSS (cozy robot room), photo gallery

### 2.2 How We Adapt This Style

| Reference image | Watch Claw |
|----------------|------------|
| Computer system metaphor (Documents, Cinema, .ssh vault) | AI agent activity metaphor (coding, thinking, resting) |
| Static illustration | Real-time animated characters driven by live data |
| Multiple characters (person, robot, pets) | Single protagonist: lobster-hat character |
| Generic pixel-art style | Same high-fidelity isometric style, warm tones |
| Detailed furniture and props | Same level of detail -- desks, computers, beds, bookshelves |

---

## 3. Core Concept

### 3.1 The Lobster-Hat Character

The protagonist is a small pixel character wearing a distinctive **lobster-shaped hat** (referencing OpenClaw's lobster mascot). This character is the visual embodiment of the OpenClaw agent.

- **Unique identity**: The lobster hat makes the character instantly recognizable
- **Emotional range**: The character displays emotions via expression bubbles above its head
- **Activity animations**: Different animations for different activities (typing, reading, sleeping, celebrating)

### 3.2 The House = Agent's Home

The three-story house is the agent's personal space. Each room is designed to visually represent a category of agent activity:

```
              ATTIC (3F)
    ┌────────┬────────┬────────┐
    │ Reading│  Lab   │Balcony │
    │  Room  │        │        │
    └────────┴────────┴────────┘
             MAIN FLOOR (2F)
    ┌────────┬────────┬────────┐
    │ Office │ Living │Bedroom │
    │        │  Room  │        │
    └────────┴────────┴────────┘
             BASEMENT (1F)
    ┌────────┬────────┬────────┐
    │  Tool  │Storage │Kitchen │
    │  Room  │        │        │
    └────────┴────────┴────────┘
```

### 3.3 Rooms Drive Behavior, Not the Other Way Around

The key design principle: **the agent's activity determines which room the character goes to**. The character doesn't choose a room -- the room is a visual consequence of what OpenClaw is currently doing.

---

## 4. MVP Version (v0.1)

### 4.1 Scope

The MVP focuses on **one floor (main floor) with 3 rooms** to validate the core experience loop:

```
OpenClaw does something → Event arrives via WebSocket → Character moves to room → Animation plays
```

### 4.2 MVP Floor Layout: Main Floor

| Room | Agent Activity | Character Animation | Emotion |
|------|---------------|--------------------|---------| 
| **Office** | `Write`, `Edit`, `Bash`, assistant text streaming | Sitting at desk, typing on keyboard | Focused |
| **Living Room** | `Read`, `Grep`, `Glob`, `WebFetch`, thinking (no tool call) | Sitting on couch, looking at fireplace | Thinking |
| **Bedroom** | Idle (no activity), waiting for user input, session end | Lying in bed, sleeping | Sleepy |

### 4.3 MVP Feature List

#### Must Have (P0)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **WebSocket connection** | Connect to OpenClaw Gateway at `ws://127.0.0.1:18789`, handle handshake, auto-reconnect |
| 2 | **Event parsing** | Parse `agent` events (lifecycle/tool/assistant streams), `presence`, `health` |
| 3 | **Event-to-behavior mapping** | Map parsed events to character actions (go to room, play animation, show emotion) |
| 4 | **Mock mode** | When Gateway is unavailable, generate simulated events for development and demo |
| 5 | **Isometric renderer** | Canvas 2D isometric tile rendering with proper draw order (painter's algorithm) |
| 6 | **One-floor layout** | Main floor with 3 rooms: office, living room, bedroom |
| 7 | **Lobster-hat character** | Animated pixel character with states: idle, walk, sit, type, sleep |
| 8 | **Pathfinding** | BFS pathfinding on tile grid, smooth character movement between rooms |
| 9 | **Emotion bubbles** | Display emotion above character head: focused, thinking, sleepy, happy, confused |
| 10 | **Status dashboard** | Side panel showing: connection status, current agent state, token usage, session info |

#### Nice to Have (P1)

| # | Feature | Description |
|---|---------|-------------|
| 11 | Zoom controls | Mouse wheel or +/- buttons for viewport zoom |
| 12 | Viewport panning | Click-drag to pan the camera |
| 13 | Character click interaction | Click the character to see detailed agent info |
| 14 | Day/night ambient lighting | Subtle lighting changes based on time of day |

### 4.4 What MVP Does NOT Include

- Second and third floors (attic, basement)
- Staircase navigation between floors
- Sound effects / music
- Electron desktop app packaging
- Custom layout editing
- Multiple characters / sub-agent visualization
- Persistent settings

---

## 5. Full Version (v1.0)

### 5.1 Three-Floor Complete Layout

#### Attic (3F)

| Room | Agent Activity | Character Animation | Emotion |
|------|---------------|--------------------|---------| 
| **Reading Room** | `Read`, `Grep`, `Glob` (file browsing / search) | Sitting in armchair, flipping through books | Curious |
| **Lab / Workshop** | `Task` (sub-agent spawning), complex multi-tool chains | Standing at whiteboard, drawing diagrams | Excited |
| **Balcony** | Task completed successfully | Sitting in lounge chair, sunbathing | Satisfied |

#### Main Floor (2F) -- same as MVP

| Room | Agent Activity | Character Animation | Emotion |
|------|---------------|--------------------|---------| 
| **Office** | `Write`, `Edit`, `Bash`, assistant streaming | Typing at desk | Focused |
| **Living Room** | `WebFetch`, thinking, light browsing | Sitting on couch | Thinking |
| **Bedroom** | Idle, waiting, session end | Sleeping in bed | Sleepy |

#### Basement (1F)

| Room | Agent Activity | Character Animation | Emotion |
|------|---------------|--------------------|---------| 
| **Tool Room** | `Bash` (system commands, scripts) | Using wrench/hammer on workbench | Serious |
| **Storage Room** | `Glob` (file system scanning), large file operations | Sorting boxes and filing cabinets | Busy |
| **Kitchen** | Build / compile tasks, data processing pipelines | Cooking at stove, stirring pots | Happy |

### 5.2 Additional v1.0 Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Staircase navigation** | Character walks up/down stairs between floors with animation |
| 2 | **Sound effects** | Footsteps, typing sounds, snoring, cooking sounds, notification chimes |
| 3 | **Electron desktop app** | Standalone desktop window, system tray, always-on-top option |
| 4 | **Sub-agent visualization** | When OpenClaw spawns sub-agents, a smaller companion character appears |
| 5 | **Activity history** | Timeline showing recent agent activities with timestamps |
| 6 | **Custom themes** | Light/dark mode, seasonal themes (holiday decorations, etc.) |
| 7 | **Notification system** | Desktop notifications when agent completes tasks or encounters errors |
| 8 | **Statistics view** | Token usage charts, session duration, tool frequency heatmap |
| 9 | **Pet companion** | A small pixel pet (cat/dog) that reacts to the agent's mood |

---

## 6. Agent State to Room/Behavior Mapping (Complete)

This is the definitive mapping table that drives the entire visualization.

### 6.1 OpenClaw Gateway Events

| Gateway Event | `event` field | `stream` / key field | Data available |
|--------------|--------------|---------------------|----------------|
| Agent lifecycle start | `agent` | `stream: "lifecycle"`, `phase: "start"` | `runId` |
| Agent lifecycle end | `agent` | `stream: "lifecycle"`, `phase: "end"` | `runId`, usage stats |
| Agent lifecycle error | `agent` | `stream: "lifecycle"`, `phase: "error"` | Error details |
| Tool call | `agent` | `stream: "tool"` | Tool name, params, result |
| Assistant text | `agent` | `stream: "assistant"` | Text delta (streaming) |
| Presence update | `presence` | Device entries | Connected clients, last input |
| Health check | `health` | Health snapshot | System status |

### 6.2 Complete Mapping Table

| OpenClaw Event | Tool / Phase | Target Room | Animation | Emotion | Priority |
|---------------|-------------|-------------|-----------|---------|----------|
| `lifecycle.start` | -- | Living Room | Wake up, walk to couch | Thinking | High |
| `lifecycle.end` | -- | Bedroom | Walk to bed, lie down | Sleepy | High |
| `lifecycle.error` | -- | (current room) | Sit down, hold head | Confused | High |
| `tool: Write` | Write | Office | Typing at keyboard | Focused | Medium |
| `tool: Edit` | Edit | Office | Typing at keyboard | Focused | Medium |
| `tool: Bash` | Bash | Office (MVP) / Tool Room (v1.0) | Typing / using tools | Serious | Medium |
| `tool: Read` | Read | Living Room (MVP) / Reading Room (v1.0) | Reading, flipping pages | Curious | Medium |
| `tool: Grep` | Grep | Living Room (MVP) / Reading Room (v1.0) | Searching through books | Curious | Medium |
| `tool: Glob` | Glob | Living Room (MVP) / Storage Room (v1.0) | Browsing shelves | Busy | Medium |
| `tool: WebFetch` | WebFetch | Living Room | Browsing on tablet/phone | Curious | Medium |
| `tool: Task` | Task (sub-agent) | Living Room (MVP) / Lab (v1.0) | Drawing on whiteboard | Excited | Medium |
| `assistant` streaming | -- | Office | Typing at keyboard | Focused | Low |
| No event (idle > 30s) | -- | Bedroom | Sleeping | Sleepy | Low |
| Task completed | -- | Living Room (MVP) / Balcony (v1.0) | Celebrating, stretching | Satisfied | Medium |

### 6.3 Priority Resolution

When multiple events arrive in quick succession, the higher-priority event takes precedence. Priority levels are:

- **High**: Lifecycle events (`start`, `end`, `error`) — these override everything
- **Medium**: Tool call events — normal activity routing
- **Low**: Assistant streaming, idle transitions — throttled and deprioritized

The character finishes its current walk animation before responding to new events (unless a High-priority event arrives, which interrupts immediately). Events during walking are queued (max queue size: 3, lowest-priority dropped first when full).

---

## 7. User Interaction

### 7.1 Viewport Controls

| Interaction | Action |
|------------|--------|
| Mouse wheel / pinch | Zoom in/out (float steps ±0.25, range 0.5x-5x) |
| Click + drag on empty area | Pan the camera |
| Click on character | Show detailed agent status popup |
| Click on room | Highlight room and show its activity mapping |

### 7.2 Status Dashboard

A compact side panel (right side or bottom) displaying:

```
┌──────────────────────────┐
│  Watch Claw  v0.1        │
├──────────────────────────┤
│  Connection: Connected   │
│  Mode: Live / Mock       │
├──────────────────────────┤
│  Agent State: Working    │
│  Current Tool: Write     │
│  Room: Office            │
│  Emotion: Focused        │
├──────────────────────────┤
│  Session: abc-123        │
│  Tokens: 12,450 / 200k  │
│  Duration: 4m 32s        │
├──────────────────────────┤
│  Last Activity:          │
│  14:32:05 Write App.tsx  │
│  14:31:58 Read utils.ts  │
│  14:31:42 Bash npm test  │
└──────────────────────────┘
```

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Frame rate** | 60fps Canvas rendering (requestAnimationFrame) |
| **Bundle size** | < 500KB gzipped (excluding sprite assets) |
| **Browser support** | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| **Responsive** | Minimum viewport: 800x600; scales up to 4K |
| **Startup time** | < 2s to first meaningful paint |
| **WebSocket reconnect** | Auto-reconnect with exponential backoff (1s, 2s, 4s, ... max 30s) |
| **Mock mode fallback** | < 100ms to switch to mock when Gateway is unreachable |
| **Memory usage** | < 100MB browser memory footprint |
| **Accessibility** | Reduced motion support (disable animations via prefers-reduced-motion) |

---

## 9. Future Considerations (Post v1.0)

- **Multi-agent view**: Support multiple OpenClaw agents in the same house (roommates!)
- **Mobile companion app**: React Native / PWA version
- **Shareable replays**: Record and share agent activity as animated GIFs
- **Community sprites**: Allow users to contribute furniture and character skins
- **Integration with other AI agents**: Support Claude Code, Codex CLI, Gemini CLI alongside OpenClaw
- **Twitch/streaming overlay**: OBS-compatible overlay for streaming coding sessions

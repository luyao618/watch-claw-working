# Watch Claw - Product Requirements Document

> **Version**: 0.2.0
> **Author**: luyao618
> **Date**: 2026-03-23
> **Status**: In Progress
>
> ⚠️ **Note**: This PRD was written for v0.2 (Canvas 2D, 3/4 top-down view). The project has since migrated to **Phaser 3 side-view platformer** (v1.0). Room names and architecture have changed. See [TECHNICAL.md](./TECHNICAL.md) for the current architecture and [TASKS.md](./TASKS.md) for the current task plan.

---

## 1. Overview

**Watch Claw** is a real-time pixel-art visualization of the [OpenClaw](https://github.com/openclaw/openclaw) AI agent's working state. It renders a 3/4 top-down view (Stardew Valley style) of a cozy house where a lobster-hat character -- representing the OpenClaw agent -- moves between rooms, performs activities, and expresses emotions based on the agent's actual runtime status. v0.2 ships as an Electron desktop application.

The project uses a lightweight Bridge Server to monitor OpenClaw's Session Log files (`~/.openclaw/agents/main/sessions/<session-id>.jsonl`), parses real-time agent events (tool calls, assistant messages, session lifecycle), and pushes them to the browser via WebSocket (`ws://127.0.0.1:18790`), translating them into character behaviors: walking to the office to code, sitting on the couch to think, sleeping in bed when idle.

### One-liner

> A pixel-art house where your OpenClaw AI lives -- watch it code, think, rest, and celebrate in real time.

### Target Users

- OpenClaw users who want a fun, ambient visualization of their AI agent's activity
- Developers who enjoy pixel-art aesthetics and "digital pet" style companions

### Inspiration

This project draws inspiration from two existing projects:

| Project                                                           | What we borrow                                          | What we do differently                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [Pixel Agents](https://github.com/pablodelucca/pixel-agents)      | JSONL file watching, character FSM, Canvas 2D rendering | We use Bridge Server push (not direct file tailing), 3/4 top-down view (not top-down), single character (not multi-agent), Electron app |
| [PixelHQ ULTRA](https://github.com/RemyLoveLogicAI/pixelhq-ultra) | Event-driven architecture, personality engine           | We focus on a cozy home (not corporate office), high-fidelity pixel art (not DOM tiles), Electron desktop app                           |

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

| Reference image                                          | Watch Claw                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| Computer system metaphor (Documents, Cinema, .ssh vault) | AI agent activity metaphor (coding, thinking, resting)      |
| Static illustration                                      | Real-time animated characters driven by live data           |
| Multiple characters (person, robot, pets)                | Single protagonist: lobster-hat character                   |
| Generic pixel-art style                                  | Same high-fidelity isometric style, warm tones              |
| Detailed furniture and props                             | Same level of detail -- desks, computers, beds, bookshelves |

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
OpenClaw does something → Bridge Server pushes event → Character moves to room → Animation plays
```

### 4.2 MVP Floor Layout: Main Floor (3 rooms in a row, 3/4 top-down view)

```
┌─────────────┬─────────────┬─────────────┐
│             │             │             │
│  Workshop   │   Study     │  Bedroom    │
│  (工作室)    │   (书房)    │  (卧室)     │
│             │             │             │
└─────────────┴─────────────┴─────────────┘
```

| Room         | Agent Activity                                                | Character Animation                    | Emotion  |
| ------------ | ------------------------------------------------------------- | -------------------------------------- | -------- |
| **Workshop** | `write`, `edit`, `exec`, assistant text streaming             | Sitting at desk, typing on keyboard    | Focused  |
| **Study**    | `read`, `grep`, `glob`, `web_search`, thinking (no tool call) | Sitting on couch, looking at bookshelf | Thinking |
| **Bedroom**  | Idle (no activity), waiting for user input, session end       | Lying in bed, sleeping                 | Sleepy   |

### 4.3 MVP Feature List

#### Must Have (P0)

| #   | Feature                       | Description                                                                                                |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | **Bridge Server connection**  | Connect to Bridge Server at `ws://127.0.0.1:18790`, monitor most recent Session Log, auto-reconnect        |
| 2   | **Event parsing**             | Parse Session Log events (`session`, `message`, `model_change`), extract tool calls and assistant messages |
| 3   | **Event-to-behavior mapping** | Map parsed events to character actions (go to room, play animation, show emotion)                          |
| 4   | **3/4 top-down renderer**     | Canvas 2D 3/4 top-down (Stardew Valley style) sprite-based rendering with y-sort depth ordering            |
| 5   | **Three-room layout**         | Workshop, Study, Bedroom in a horizontal row                                                               |
| 6   | **Lobster-hat character**     | Animated pixel character with states: idle, walk, sit, type, sleep                                         |
| 7   | **Pathfinding**               | BFS pathfinding on tile grid, smooth character movement between rooms                                      |
| 8   | **Emotion bubbles**           | Display emotion above character head: focused, thinking, sleepy, happy, confused                           |
| 9   | **Status dashboard**          | Side panel showing: connection status, current agent state, token usage, session info                      |
| 10  | **Electron desktop app**      | Standalone desktop window, system tray, always-on-top option                                               |

#### Nice to Have (P1)

| #   | Feature                     | Description                                    |
| --- | --------------------------- | ---------------------------------------------- |
| 11  | Zoom controls               | Mouse wheel or +/- buttons for viewport zoom   |
| 12  | Viewport panning            | Click-drag to pan the camera                   |
| 13  | Character click interaction | Click the character to see detailed agent info |
| 14  | Day/night ambient lighting  | Subtle lighting changes based on time of day   |

### 4.4 What MVP Does NOT Include

- Second and third floors (attic, basement)
- Staircase navigation between floors
- Sound effects / music
- Custom layout editing
- Multiple characters / sub-agent visualization
- Persistent settings
- Mock mode (fully removed in v0.2, only real Bridge Server data supported)

---

## 5. Full Version (v1.0)

### 5.1 Three-Floor Complete Layout

#### Attic (3F)

| Room               | Agent Activity                                         | Character Animation                         | Emotion   |
| ------------------ | ------------------------------------------------------ | ------------------------------------------- | --------- |
| **Reading Room**   | `read`, `grep`, `glob` (file browsing / search)        | Sitting in armchair, flipping through books | Curious   |
| **Lab / Workshop** | `task` (sub-agent spawning), complex multi-tool chains | Standing at whiteboard, drawing diagrams    | Excited   |
| **Balcony**        | Task completed successfully                            | Sitting in lounge chair, sunbathing         | Satisfied |

#### Main Floor (2F) -- same as MVP

| Room            | Agent Activity                               | Character Animation | Emotion  |
| --------------- | -------------------------------------------- | ------------------- | -------- |
| **Office**      | `write`, `edit`, `exec`, assistant streaming | Typing at desk      | Focused  |
| **Living Room** | `web_search`, thinking, light browsing       | Sitting on couch    | Thinking |
| **Bedroom**     | Idle, waiting, session end                   | Sleeping in bed     | Sleepy   |

#### Basement (1F)

| Room             | Agent Activity                                       | Character Animation               | Emotion |
| ---------------- | ---------------------------------------------------- | --------------------------------- | ------- |
| **Tool Room**    | `exec` (system commands, scripts)                    | Using wrench/hammer on workbench  | Serious |
| **Storage Room** | `glob` (file system scanning), large file operations | Sorting boxes and filing cabinets | Busy    |
| **Kitchen**      | Build / compile tasks, data processing pipelines     | Cooking at stove, stirring pots   | Happy   |

### 5.2 Additional v1.0 Features

| #   | Feature                     | Description                                                            |
| --- | --------------------------- | ---------------------------------------------------------------------- |
| 1   | **Staircase navigation**    | Character walks up/down stairs between floors with animation           |
| 2   | **Sound effects**           | Footsteps, typing sounds, snoring, cooking sounds, notification chimes |
| 3   | **Electron desktop app**    | Standalone desktop window, system tray, always-on-top option           |
| 4   | **Sub-agent visualization** | When OpenClaw spawns sub-agents, a smaller companion character appears |
| 5   | **Activity history**        | Timeline showing recent agent activities with timestamps               |
| 6   | **Custom themes**           | Light/dark mode, seasonal themes (holiday decorations, etc.)           |
| 7   | **Notification system**     | Desktop notifications when agent completes tasks or encounters errors  |
| 8   | **Statistics view**         | Token usage charts, session duration, tool frequency heatmap           |
| 9   | **Pet companion**           | A small pixel pet (cat/dog) that reacts to the agent's mood            |

---

## 6. Agent State to Room/Behavior Mapping (Complete)

This is the definitive mapping table that drives the entire visualization.

### 6.1 OpenClaw Session Log Events

| Session Log Event                   | `type` field            | Key fields                                   | Data available                    |
| ----------------------------------- | ----------------------- | -------------------------------------------- | --------------------------------- |
| Session initialization              | `session`               | `sessionId`, `version`, `cwd`                | Session ID, working directory     |
| User message                        | `message`               | `role: "user"`                               | User input text                   |
| Assistant message (with tool calls) | `message`               | `role: "assistant"`, `content: [{toolCall}]` | Tool name, params, text, thinking |
| Tool execution result               | `message`               | `role: "toolResult"`, `details`              | exitCode, durationMs, output      |
| Model change                        | `model_change`          | `provider`, `modelId`                        | Current model info                |
| Thinking level change               | `thinking_level_change` | `thinkingLevel`                              | Thinking level setting            |
| Custom event (e.g. model-snapshot)  | `custom`                | `customType`                                 | Custom data                       |

### 6.2 Complete Mapping Table

| OpenClaw Event                         | Tool / Phase     | Target Room                       | Animation                | Emotion   | Priority |
| -------------------------------------- | ---------------- | --------------------------------- | ------------------------ | --------- | -------- |
| `type: "session"` (session start)      | --               | Study                             | Wake up, walk to couch   | Thinking  | High     |
| `stopReason: "stop"` (session end)     | --               | Bedroom                           | Walk to bed, lie down    | Sleepy    | High     |
| Tool execution failure (exitCode != 0) | --               | (current room)                    | Sit down, hold head      | Confused  | High     |
| `tool: write`                          | write            | Workshop                          | Typing at keyboard       | Focused   | Medium   |
| `tool: edit`                           | edit             | Workshop                          | Typing at keyboard       | Focused   | Medium   |
| `tool: exec`                           | exec             | Workshop (MVP) / Tool Room (v1.0) | Typing / using tools     | Serious   | Medium   |
| `tool: read`                           | read             | Study (MVP) / Reading Room (v1.0) | Reading, flipping pages  | Curious   | Medium   |
| `tool: grep`                           | grep             | Study (MVP) / Reading Room (v1.0) | Searching through books  | Curious   | Medium   |
| `tool: glob`                           | glob             | Study (MVP) / Storage Room (v1.0) | Browsing shelves         | Busy      | Medium   |
| `tool: web_search`                     | web_search       | Study                             | Browsing on tablet/phone | Curious   | Medium   |
| `tool: task`                           | task (sub-agent) | Study (MVP) / Lab (v1.0)          | Drawing on whiteboard    | Excited   | Medium   |
| `assistant` streaming                  | --               | Workshop                          | Typing at keyboard       | Focused   | Low      |
| No event (idle > 30s)                  | --               | Bedroom                           | Sleeping                 | Sleepy    | Low      |
| Task completed                         | --               | Study (MVP) / Balcony (v1.0)      | Celebrating, stretching  | Satisfied | Medium   |

### 6.3 Priority Resolution

When multiple events arrive in quick succession, the higher-priority event takes precedence. Priority levels are:

- **High**: Session lifecycle events (`type: "session"` start, `stopReason: "stop"` end, tool execution failure) — these override everything
- **Medium**: Tool call events — normal activity routing
- **Low**: Assistant streaming, idle transitions — throttled and deprioritized

The character finishes its current walk animation before responding to new events (unless a High-priority event arrives, which interrupts immediately). Events during walking are queued (max queue size: 3, lowest-priority dropped first when full).

---

## 7. User Interaction

### 7.1 Viewport Controls

| Interaction                | Action                                         |
| -------------------------- | ---------------------------------------------- |
| Mouse wheel / pinch        | Zoom in/out (float steps ±0.25, range 0.5x-5x) |
| Click + drag on empty area | Pan the camera                                 |
| Click on character         | Show detailed agent status popup               |
| Click on room              | Highlight room and show its activity mapping   |

### 7.2 Status Dashboard

A compact side panel (right side or bottom) displaying:

```
┌──────────────────────────┐
│  Watch Claw  v0.2        │
├──────────────────────────┤
│  Connection: Connected   │
├──────────────────────────┤
│  Agent State: Working    │
│  Current Tool: write    │
│  Room: Office            │
│  Emotion: Focused        │
├──────────────────────────┤
│  Session: abc-123        │
│  Tokens: 12,450 / 200k  │
│  Duration: 4m 32s        │
├──────────────────────────┤
│  Last Activity:          │
│  14:32:05 write App.tsx  │
│  14:31:58 read utils.ts  │
│  14:31:42 exec npm test  │
└──────────────────────────┘
```

---

## 8. Non-Functional Requirements

| Requirement          | Target                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| **Frame rate**       | 60fps Canvas rendering (requestAnimationFrame)                         |
| **Bundle size**      | < 500KB gzipped (excluding sprite assets)                              |
| **Platform**         | Electron desktop app (macOS first, Windows/Linux later)                |
| **Responsive**       | Minimum viewport: 800x600; scales up to 4K                             |
| **Startup time**     | < 2s to first meaningful paint                                         |
| **Bridge reconnect** | Auto-reconnect with exponential backoff (1s, 2s, 4s, ... max 30s)      |
| **Memory usage**     | < 100MB memory footprint                                               |
| **Accessibility**    | Reduced motion support (disable animations via prefers-reduced-motion) |

---

## 9. Future Considerations (Post v1.0)

- **Multi-agent view**: Support multiple OpenClaw agents in the same house (roommates!)
- **Mobile companion app**: React Native / PWA version
- **Shareable replays**: Record and share agent activity as animated GIFs
- **Community sprites**: Allow users to contribute furniture and character skins
- **Integration with other AI agents**: Support Claude Code, Codex CLI, Gemini CLI alongside OpenClaw
- **Twitch/streaming overlay**: OBS-compatible overlay for streaming coding sessions

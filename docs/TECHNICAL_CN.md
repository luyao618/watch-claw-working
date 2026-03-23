# Watch Claw - 技术设计文档

> **Version**: 0.1.0 (Draft)
> **Date**: 2026-03-22
> **Status**: In Progress

---

## 1. 技术栈

### 1.1 选型总结

| 层           | 选择                                              | 理由                                                                   |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------------- |
| **语言**     | TypeScript 5.x（strict mode）                     | 为 game state、event parsing 和 WebSocket 协议提供类型安全             |
| **UI 框架**  | React 18                                          | 仅用于 overlay UI（dashboard、controls）；game state 在 React 之外     |
| **渲染**     | Canvas 2D API                                     | Pixel-perfect 控制、integer scaling、这个规模不需要 WebGL 的复杂度     |
| **构建工具** | Vite 6                                            | 快速 HMR、原生 TS 支持、配置简单、两个参考项目都已验证                 |
| **通信**     | Session Log 文件监控 + WebSocket Bridge           | 监控 OpenClaw JSONL session logs，通过轻量 Node.js bridge 推送到浏览器 |
| **状态管理** | Imperative game state + React useReducer（仅 UI） | Game world state 在 React 外部，避免每帧 re-render 开销                |
| **包管理器** | pnpm                                              | 快速、磁盘高效、严格的依赖解析                                         |
| **Linting**  | ESLint + Prettier                                 | 一致的代码风格、类型感知的 linting                                     |
| **测试**     | Vitest                                            | 快速单元测试、兼容 Vite、原生 TS 支持                                  |

### 1.2 为什么不用...

| 替代方案              | 我们为什么选择不同的                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phaser / PixiJS**   | 对于单角色 isometric 场景来说过于重量级；带来了大的 bundle 和我们不需要的 API surface。Canvas 2D 足够且保持 bundle 小巧。                                |
| **WebGL / Three.js**  | 2D pixel art 不受益于 GPU shaders。Canvas 2D 的 integer scaling 更容易实现 pixel-perfect 效果。                                                          |
| **Zustand / Redux**   | Game state 以 60fps 更新。React 状态管理会导致不必要的 re-renders。Imperative state + 选择性 React 更新是经验证的模式（Pixel Agents 使用）。             |
| **Socket.IO**         | 我们的 WebSocket 仅用于 bridge → browser 的简单推送通道。Socket.IO 添加了不必要的抽象和 bundle 体积。                                                    |
| **Next.js / Remix**   | 不需要服务端渲染。这是一个连接本地 WebSocket bridge 的纯客户端 SPA。Vite 更简单更快。                                                                    |
| **Gateway WebSocket** | OpenClaw Gateway 的 WebSocket 协议不稳定，且 event 格式与 session log 不一致。Session log 是 append-only JSONL，格式已验证且实时写入，是更可靠的数据源。 |

---

## 2. 架构

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Web App)                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     React Shell                           │  │
│  │  ┌─────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │   CanvasView.tsx    │  │    Dashboard.tsx            │  │  │
│  │  │   (挂载 <canvas>)   │  │    (状态、tokens、日志)     │  │  │
│  │  └────────┬────────────┘  └────────────┬───────────────┘  │  │
│  └───────────┼────────────────────────────┼──────────────────┘  │
│              │ ref                         │ subscribe           │
│  ┌───────────▼────────────────────────────▼──────────────────┐  │
│  │                   Game Engine（imperative）                │  │
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
│  │  │ Client   │→ │              │→ │（Bridge 离线时的     │ │  │
│  │  │ (WS)    │  │ SessionLog   │  │  fallback）          │ │  │
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
              │   - 解析 + 推送新 events    │
              │   - session 发现/切换       │
              └──────────────┬─────────────┘
                             │ fs.watch
                             ▼
              ┌────────────────────────────┐
              │   OpenClaw Session Logs    │
              │   ~/.openclaw/agents/main/ │
              │   sessions/<id>.jsonl      │
              │                            │
              │   - JSONL append-only      │
              │   - 实时写入               │
              │   - 结构化 event 类型      │
              └────────────────────────────┘
```

### 2.2 层职责

| 层             | 职责                                                             | 是否感知 React？ |
| -------------- | ---------------------------------------------------------------- | ---------------- |
| **Connection** | Bridge WebSocket 生命周期、session log event 解析、mock 数据生成 | 否               |
| **Engine**     | Game loop、rendering、character FSM、pathfinding、camera         | 否               |
| **World**      | Tile map 数据、room 定义、sprite 数据、furniture 目录            | 否               |
| **UI**         | Canvas DOM 挂载、dashboard overlay、controls                     | 是               |

### 2.3 关键设计决策

**决策 1：Game state 在 React 之外**

Game world 以 60fps 更新。如果 game state 在 React state 中，每帧都会触发 re-render 级联。取而代之：

- `GameState` 是一个纯 TypeScript 对象，以 imperative 方式修改
- Game loop 直接读写 `GameState`
- React 组件通过轻量 pub/sub（`EventEmitter`）订阅特定切片
- Dashboard 最多每秒更新 4 次（节流）

**决策 2：单 Canvas，无 DOM tiles**

不像 PixelHQ ULTRA 使用 DOM 元素做 tiles，我们使用单个 `<canvas>` 元素。这给我们：

- 对 isometric rendering 的 pixel-perfect 控制
- 处理许多重叠 sprites 的复杂场景时更好的性能
- 更容易的 z-ordering（在单次绘制 pass 中使用 painter's algorithm）
- 原生支持 pixel-art scaling，无 CSS 亚像素问题

**决策 3：Session Log 文件监控 + Bridge Server**

OpenClaw 将所有 session 活动实时写入 JSONL 文件（`~/.openclaw/agents/main/sessions/<session-id>.jsonl`）。我们选择监控这些文件而非直接连接 Gateway WebSocket，原因如下：

- Session log 是 append-only JSONL，格式稳定且已验证
- 包含完整的 tool call 信息：工具名、参数、返回结果、耗时
- 包含 token usage 和费用数据
- 包含 model/provider 信息
- 无需依赖 Gateway 的 WebSocket 协议（协议不够稳定）
- `sessions.json` 索引文件提供活跃 session 发现能力

由于浏览器无法直接访问本地文件系统，我们使用一个轻量的 Node.js Bridge Server：

- Bridge 用 `fs.watch` 监控 JSONL 文件变化
- 解析新增行，通过 WebSocket 推送给浏览器客户端
- 自动发现最新活跃 session（读 `sessions.json`，按 `updatedAt` 排序）
- Bridge 代码量约 50-80 行，随 `pnpm dev` 一起启动

---

## 3. 项目结构

```
watch-claw-working/
│
├── docs/                               # 文档
│   ├── PRD.md                          # 产品需求
│   ├── TECHNICAL.md                    # 本文档
│   ├── TASKS.md                        # 任务分解
│   └── assets/                         # 文档资源（参考图片）
│       └── reference-isometric-house.png
│
├── public/                             # 静态资源（原样提供）
│   └── assets/
│       ├── character/                  # 龙虾帽角色 spritesheets
│       │   ├── idle.png               # Idle 动画帧
│       │   ├── walk.png               # Walk 动画帧（4 方向）
│       │   ├── sit.png                # 坐在桌前帧
│       │   ├── type.png               # 打字动画帧
│       │   └── sleep.png             # 睡觉动画帧
│       ├── tiles/                     # Isometric 地板和墙壁 tiles
│       │   ├── floor-wood.png         # 木地板 tile
│       │   ├── floor-carpet.png       # 地毯地板 tile
│       │   ├── wall-front.png         # 正面墙壁
│       │   ├── wall-side.png          # 侧面墙壁
│       │   └── stairs.png            # 楼梯 tile
│       ├── furniture/                 # 家具 sprites
│       │   ├── desk-computer.png      # 带显示器的电脑桌
│       │   ├── chair-office.png       # 办公椅
│       │   ├── sofa.png              # 客厅沙发
│       │   ├── fireplace.png         # 壁炉
│       │   ├── bed.png               # 床
│       │   ├── lamp.png              # 台灯
│       │   └── bookshelf.png         # 书架
│       └── ui/                        # UI sprites
│           ├── emotions/              # 情绪气泡 sprites
│           │   ├── focused.png
│           │   ├── thinking.png
│           │   ├── sleepy.png
│           │   ├── happy.png
│           │   └── confused.png
│           └── connection-indicator.png
│
├── src/
│   ├── main.tsx                        # 应用入口，React root 挂载
│   ├── App.tsx                         # Root 组件，布局 shell
│   │
│   ├── connection/                     # === Connection Layer ===
│   │   ├── types.ts                    # Session log event 类型定义
│   │   │                               #   - SessionLogEvent（union type）
│   │   │                               #   - SessionEvent、ModelChangeEvent
│   │   │                               #   - MessageEvent（user/assistant/toolResult）
│   │   │                               #   - ToolCallContent、ToolResultContent
│   │   │                               #   - CharacterAction（输出类型）
│   │   │
│   │   ├── bridgeClient.ts             # Bridge WebSocket client
│   │   │                               #   - connect()、disconnect()
│   │   │                               #   - 自动重连
│   │   │                               #   - 接收 bridge 推送的 session log events
│   │   │                               #   - 连接状态：
│   │   │                               #     DISCONNECTED → CONNECTING →
│   │   │                               #     CONNECTED → RECONNECTING
│   │   │
│   │   ├── eventParser.ts              # Event → CharacterAction 映射器
│   │   │                               #   - parseSessionLogEvent()
│   │   │                               #   - mapToolToRoom()
│   │   │                               #   - mapToolToAnimation()
│   │   │                               #   - mapToolToEmotion()
│   │   │                               #   - 可配置映射规则
│   │   │
│   │   ├── mockProvider.ts             # Mock event 生成器
│   │   │                               #   - 模拟 realistic session log event 序列
│   │   │                               #   - 随机 tool calls + 时间控制
│   │   │                               #   - Session 模拟循环
│   │   │                               #   - Bridge 离线时自动激活
│   │   │
│   │   └── connectionManager.ts        # 协调器
│   │                                   #   - 管理 bridge vs mock 切换
│   │                                   #   - 发出标准化 CharacterActions
│   │                                   #   - 暴露连接状态
│   │
│   ├── engine/                         # === Game Engine Layer ===
│   │   ├── gameState.ts                # 中央 game state 对象
│   │   │                               #   - character: CharacterState
│   │   │                               #   - world: WorldState
│   │   │                               #   - camera: CameraState
│   │   │                               #   - ui: UIState
│   │   │                               #   - 用于 UI 订阅的 EventEmitter
│   │   │
│   │   ├── gameLoop.ts                 # requestAnimationFrame loop
│   │   │                               #   - Fixed timestep 累加器
│   │   │                               #   - update(dt) → render() 循环
│   │   │                               #   - FPS 追踪
│   │   │                               #   - Pause/resume 支持
│   │   │
│   │   ├── renderer.ts                 # Canvas 2D isometric renderer
│   │   │                               #   - clearFrame()
│   │   │                               #   - renderFloor()
│   │   │                               #   - renderWalls()
│   │   │                               #   - renderFurniture()
│   │   │                               #   - renderCharacter()
│   │   │                               #   - renderEmotionBubble()
│   │   │                               #   - renderDebugGrid()（仅开发）
│   │   │                               #   - 绘制前 Z-sort 所有 entities
│   │   │
│   │   ├── character.ts                # 角色有限状态机
│   │   │                               #   - 状态：IDLE、WALKING、SITTING、
│   │   │                               #     TYPING、SLEEPING、THINKING、
│   │   │                               #     CELEBRATING
│   │   │                               #   - 带 animation blending 的过渡
│   │   │                               #   - 每个动画的帧计数器
│   │   │                               #   - 方向：NE、NW、SE、SW
│   │   │
│   │   ├── pathfinding.ts              # 基于 Tile 的 pathfinding
│   │   │                               #   - 在 walkability grid 上的 BFS
│   │   │                               #   - Path smoothing（移除冗余节点）
│   │   │                               #   - getPath(from, to): TileCoord[]
│   │   │                               #   - Door/transition tile 处理
│   │   │
│   │   ├── camera.ts                   # 视口和缩放
│   │   │                               #   - pan(dx, dy)
│   │   │                               #   - zoom(level: 0.5-5.0, step ±0.25)
│   │   │                               #   - worldToScreen(x, y)
│   │   │                               #   - screenToWorld(sx, sy)
│   │   │                               #   - centerOn(tileX, tileY)
│   │   │                               #   - 跟随角色（可选）
│   │   │
│   │   └── isometric.ts               # Isometric 数学工具
│   │                                   #   - cartesianToIso(x, y)
│   │                                   #   - isoToCartesian(isoX, isoY)
│   │                                   #   - getTileAtScreen(sx, sy)
│   │                                   #   - TILE_WIDTH、TILE_HEIGHT 常量
│   │
│   ├── world/                          # === World Data Layer ===
│   │   ├── tileMap.ts                  # Tile map 定义
│   │   │                               #   - TileType 枚举（FLOOR、WALL、DOOR、
│   │   │                               #     STAIRS、EMPTY）
│   │   │                               #   - Floor layout 为 2D 数组
│   │   │                               #   - Walkability grid 生成
│   │   │
│   │   ├── rooms.ts                    # Room 定义
│   │   │                               #   - Room 接口：name、bounds、
│   │   │                               #     furniture list、entry tile、
│   │   │                               #     activity zone tile
│   │   │                               #   - MAIN_FLOOR_ROOMS 常量
│   │   │                               #   - getRoomForAction(action): Room
│   │   │
│   │   ├── furniture.ts                # 家具目录
│   │   │                               #   - FurnitureType 枚举
│   │   │                               #   - Placement 数据：tile position、
│   │   │                               #     sprite key、z-offset、walkable
│   │   │
│   │   └── sprites.ts                  # Sprite 定义和加载
│   │                                   #   - SpriteSheet 接口
│   │                                   #   - loadSprite(key): Promise<ImageBitmap>
│   │                                   #   - Sprite 动画帧数据
│   │                                   #   - Sprite cache（Map<string, ImageBitmap>）
│   │
│   ├── ui/                             # === React UI Layer ===
│   │   ├── CanvasView.tsx              # Canvas 容器组件
│   │   │                               #   - 挂载 <canvas>，传 ref 给 engine
│   │   │                               #   - 处理 resize + DPR
│   │   │                               #   - 鼠标事件委托给 engine
│   │   │
│   │   ├── Dashboard.tsx               # 状态面板
│   │   │                               #   - 连接状态指示器
│   │   │                               #   - Agent 状态显示
│   │   │                               #   - Token 使用量进度条
│   │   │                               #   - Session 信息
│   │   │                               #   - 活动日志（最近 N 个 events）
│   │   │
│   │   ├── ConnectionBadge.tsx         # 连接状态 badge
│   │   │                               #   - Connected / Disconnected / Mock
│   │   │                               #   - 动画指示器
│   │   │
│   │   └── ZoomControls.tsx            # +/- 缩放按钮
│   │
│   └── utils/
│       ├── constants.ts                # 所有魔法数字集中管理
│       │                               #   - TILE_WIDTH = 64
│       │                               #   - TILE_HEIGHT = 32
│       │                               #   - CHARACTER_SPEED = 2
│       │                               #   - ANIMATION_FPS = 8
│       │                               #   - BRIDGE_WS_URL = ws://127.0.0.1:18790
│       │                               #   - SESSION_LOG_DIR (bridge 端)
│       │                               #   - DASHBOARD_UPDATE_RATE = 250
│       │                               #   - 等
│       │
│       ├── eventBus.ts                 # 轻量 pub/sub
│       │                               #   - on(event, callback)
│       │                               #   - off(event, callback)
│       │                               #   - emit(event, data)
│       │                               #   - 用于 Engine → UI 通信
│       │
│       └── helpers.ts                  # 通用工具函数
│                                       #   - clamp()、lerp()
│                                       #   - throttle()、debounce()
│                                       #   - generateId()
│
├── bridge/                             # Bridge Server（Node.js）
│   └── server.ts                       # Session log 文件监控 + WebSocket 推送
│                                       #   - fs.watch 监控 JSONL 文件
│                                       #   - 解析新增行
│                                       #   - WebSocket server（端口 18790）
│                                       #   - 自动发现最新活跃 session
│                                       #   - sessions.json 索引读取
│
├── index.html                          # Vite 入口 HTML
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

## 4. 核心模块设计

### 4.1 Bridge Server（`bridge/server.ts`）+ Bridge Client（`connection/bridgeClient.ts`）

#### 架构概述

浏览器无法直接读取本地文件系统，因此我们使用一个轻量的 Node.js Bridge Server 作为中间层：

```
浏览器（BridgeClient）◄──WebSocket──► Bridge Server ◄──fs.watch──► Session JSONL 文件
```

#### Bridge Server

Bridge Server 是一个约 60-80 行的 Node.js 脚本，职责：

1. 读取 `~/.openclaw/agents/main/sessions/sessions.json` 发现活跃 session
2. 按 `updatedAt` 排序，选择最新活跃 session 的 JSONL 文件
3. 用 `fs.watch` 监控该文件的变化
4. 文件有新行追加时，解析新增的 JSON 行
5. 通过 WebSocket（端口 18790）推送给所有已连接的浏览器客户端
6. 定期检查 `sessions.json` 的变化，发现新 session 时自动切换监控目标

```typescript
// Bridge Server 核心逻辑（简化）
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
  // 清理之前的 watcher，避免 session 切换时泄漏
  if (currentWatcher) {
    currentWatcher.close()
    currentWatcher = null
  }

  currentFile = filePath
  fileSize = 0

  // 读取已有内容，发送初始状态
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)
  fileSize = content.length

  // 向新客户端发送最近 N 个事件作为初始状态
  // ...

  currentWatcher = watch(filePath, (eventType) => {
    if (eventType !== 'change') return
    const newContent = readFileSync(filePath, 'utf-8')
    const newSize = newContent.length
    if (newSize <= fileSize) return

    // 提取新增部分
    const added = newContent.slice(fileSize)
    fileSize = newSize

    const newLines = added.trim().split('\n').filter(Boolean)
    for (const line of newLines) {
      try {
        const event = JSON.parse(line)
        // 广播给所有连接的客户端
        const msg = JSON.stringify(event)
        wss.clients.forEach((client) => {
          if (client.readyState === 1) client.send(msg)
        })
      } catch {
        /* 忽略格式错误的行 */
      }
    }
  })
}

// 启动
const sessionFile = findLatestSession()
if (sessionFile) watchSession(sessionFile)
console.log(`Bridge server listening on ws://127.0.0.1:${PORT}`)
```

#### Bridge Client 连接状态机

```
                    ┌─────────────┐
         connect()  │DISCONNECTED │ ◄──── disconnect() / 最大重试次数
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
                    │RECONNECTING │ ──── timeout（指数退避）
                    └─────────────┘      重试间隔：1s、2s、4s、... 最大 30s
```

注意：相比原 Gateway Client，Bridge Client 更简单——无需 handshake 步骤，连接即可直接接收事件。

#### 接口

```typescript
interface BridgeClient {
  // 生命周期
  connect(url: string): void
  disconnect(): void

  // 状态
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

### 4.2 Event Parser（`connection/eventParser.ts`）

#### 输入：Session Log Events

OpenClaw 的 session log 是 JSONL 格式，每行一个 JSON 对象。以下是实际观察到的事件类型：

```typescript
// Session Log 基础事件
interface SessionLogEventBase {
  type: string
  id: string
  parentId: string | null
  timestamp: string // ISO 8601
}

// Session 初始化事件
interface SessionInitEvent extends SessionLogEventBase {
  type: 'session'
  version: number // 目前为 3
  cwd: string
}

// Model 变更事件
interface ModelChangeEvent extends SessionLogEventBase {
  type: 'model_change'
  provider: string // 'github-copilot'
  modelId: string // 'claude-opus-4.6'
}

// Thinking level 变更
interface ThinkingLevelChangeEvent extends SessionLogEventBase {
  type: 'thinking_level_change'
  thinkingLevel: string // 'low' | 'medium' | 'high'
}

// 消息事件（核心事件类型）
interface MessageEvent extends SessionLogEventBase {
  type: 'message'
  message: {
    role: 'user' | 'assistant' | 'toolResult'
    content: string | MessageContent[] // 用户消息为 string，assistant/toolResult 为数组
    // assistant 消息额外字段
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

// 消息内容类型
type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | {
      type: 'toolCall'
      id: string
      name: string
      arguments: Record<string, unknown>
    }

// toolResult 消息的额外字段（MessageEvent.message 中 role === 'toolResult' 时的扩展字段）
// 这些字段扩展了上面的基础 message 结构
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

// 所有 session log 事件的 union type
// 注意：toolResult 是 role 为 'toolResult' 且包含 ToolResultFields 的 MessageEvent
type SessionLogEvent =
  | SessionInitEvent
  | ModelChangeEvent
  | ThinkingLevelChangeEvent
  | MessageEvent
```

#### 关键事件识别

Session log 中与角色行为相关的核心事件模式：

| 事件模式             | 识别方式                                       | 含义                                        |
| -------------------- | ---------------------------------------------- | ------------------------------------------- |
| Session 开始         | `type: 'session'`                              | Agent 会话启动 → 角色醒来                   |
| 用户消息             | `role: 'user'`                                 | 用户发起请求 → 角色醒来                     |
| AI 调用工具          | `role: 'assistant'`, `content` 包含 `toolCall` | Agent 正在工作 → 根据工具类型移动到对应房间 |
| 工具返回结果         | `role: 'toolResult'`                           | 工具执行完成 → 短暂停留                     |
| AI 纯文本回复        | `role: 'assistant'`, `content` 只有 `text`     | Agent 回复用户 → 在 office 打字             |
| AI 思考中            | `role: 'assistant'`, `content` 包含 `thinking` | Agent 正在思考 → thinking 动画              |
| `stopReason: 'stop'` | assistant 消息的 `stopReason`                  | 回合结束 → 进入睡眠                         |

#### 工具名映射

Session log 中的工具名与 Gateway 不同，以下是实际观察到的映射：

```typescript
const TOOL_ROOM_MAP: Record<
  string,
  { room: RoomId; animation: AnimationId; emotion: EmotionId }
> = {
  // 写入类工具 → Office（打字动画）
  write: { room: 'office', animation: 'type', emotion: 'focused' },
  edit: { room: 'office', animation: 'type', emotion: 'focused' },

  // 执行类工具 → Office（打字动画，serious 情绪）
  exec: { room: 'office', animation: 'type', emotion: 'serious' },

  // 阅读/搜索类工具 → Living Room（坐着阅读）
  read: { room: 'living-room', animation: 'sit', emotion: 'thinking' },
  grep: { room: 'living-room', animation: 'sit', emotion: 'curious' },
  glob: { room: 'living-room', animation: 'sit', emotion: 'curious' },

  // 网络/搜索类工具 → Living Room（思考）
  web_search: { room: 'living-room', animation: 'think', emotion: 'curious' },

  // 记忆相关 → Living Room
  memory_search: {
    room: 'living-room',
    animation: 'think',
    emotion: 'thinking',
  },
  memory_get: { room: 'living-room', animation: 'sit', emotion: 'thinking' },

  // 进程管理 → Office
  process: { room: 'office', animation: 'type', emotion: 'serious' },

  // Session/子任务相关 → Living Room（思考规划）
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

#### 输出：Character Actions

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

#### 解析逻辑

```typescript
function parseSessionLogEvent(event: SessionLogEvent): CharacterAction | null {
  // Session 初始化 → 角色醒来
  if (event.type === 'session') {
    return { type: 'WAKE_UP' }
  }

  // 只处理 message 类型的事件
  if (event.type !== 'message') return null

  const { message } = event

  // 用户消息 → 角色醒来（如果在睡觉）
  if (message.role === 'user') {
    return { type: 'WAKE_UP' }
  }

  // Assistant 消息
  if (message.role === 'assistant') {
    const contents = message.content

    // 检查是否包含 toolCall
    const toolCalls = contents.filter((c) => c.type === 'toolCall')
    if (toolCalls.length > 0) {
      // 使用第一个 toolCall 确定目标（多个 toolCall 时取首个）
      const toolCall = toolCalls[0]
      const mapping = TOOL_ROOM_MAP[toolCall.name]
      if (mapping) {
        return {
          type: 'GOTO_ROOM',
          room: mapping.room,
          animation: mapping.animation,
          emotion: mapping.emotion,
        }
      }
      // 未知工具 → 默认到 office
      return {
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
      }
    }

    // 回合结束 → 进入睡眠（在 toolCalls 之后、所有内容类型判断之前检查，
    // 确保无论最终消息包含什么内容，角色都会进入睡眠）
    if (message.stopReason === 'stop') {
      return { type: 'GO_SLEEP' }
    }

    // 检查是否包含 thinking（无 toolCall）
    const hasThinking = contents.some((c) => c.type === 'thinking')
    const hasText = contents.some(
      (c) => c.type === 'text' && c.text.trim().length > 0,
    )

    if (hasThinking && !hasText) {
      // 纯思考 → thinking 动画
      return {
        type: 'GOTO_ROOM',
        room: 'living-room',
        animation: 'think',
        emotion: 'thinking',
      }
    }

    if (hasText) {
      // AI 回复文本 → 在 office 打字
      // 对文本回复进行节流，避免 streaming 多次触发
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

  // toolResult → 不直接产生 action（角色保持在当前位置）
  // 但可以提取 usage 信息给 dashboard
  if (message.role === 'toolResult') {
    return null
  }

  return null
}
```

#### Action Queue

当 events 到达速度快于角色响应速度时（例如角色正在行走），actions 会被排队并支持优先级：

```typescript
type ActionPriority = 'high' | 'medium' | 'low'

interface PrioritizedAction {
  action: CharacterAction
  priority: ActionPriority
  timestamp: number
}

// 用于排序的优先级值（越小优先级越高）
const PRIORITY_ORDER: Record<ActionPriority, number> = {
  high: 0, // lifecycle events（start、end、error）
  medium: 1, // tool events
  low: 2, // assistant streaming、idle 过渡
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
      // 丢弃最低优先级的项目（同优先级则丢弃最旧的）
      const lowestIdx = this.findLowestPriorityIndex()
      if (
        PRIORITY_ORDER[priority] <=
        PRIORITY_ORDER[this.queue[lowestIdx].priority]
      ) {
        this.queue.splice(lowestIdx, 1)
      } else {
        return // 新 action 优先级低于队列中所有项目，丢弃它
      }
    }

    // 去重：如果最新排队的 action 目标相同房间，替换它
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

    // 按优先级排序（high 优先），然后按时间戳（oldest 优先）
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
        lowestIdx = i // 同优先级，更旧的价值更低
      }
    }
    return lowestIdx
  }
}
```

---

### 4.3 Mock Data Provider（`connection/mockProvider.ts`）

Mock provider 为开发和演示模拟 realistic OpenClaw 活动。它生成与真实 session log 格式一致的 `SessionLogEvent` 事件。

#### 行为模拟

```typescript
class MockProvider {
  private outerTimerId: number | null = null
  private innerTimerId: number | null = null
  private onEvent: (event: SessionLogEvent) => void
  private sessionId: string = generateId()
  private eventSeq = 0

  start(onEvent: (event: SessionLogEvent) => void): void {
    this.onEvent = onEvent

    // 模拟 session 初始化
    this.emitSessionInit()

    // 模拟用户消息，然后开始 tool 循环
    this.emitUserMessage('Help me refactor the auth module')
    this.scheduleNextTool()
  }

  private scheduleNextTool(): void {
    const delay = randomBetween(3000, 8000) // 动作间隔 3-8 秒
    this.outerTimerId = window.setTimeout(() => {
      const tool = this.randomTool()

      // 发出包含 toolCall 的 assistant 消息
      this.emitAssistantToolCall(tool)

      // Tool 持续时间：1-5 秒后发出 toolResult
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
    const weights = [25, 20, 20, 15, 8, 5, 5, 2] // write/edit 最常见
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

#### Session 模拟循环

```
SESSION_INIT → USER_MSG → [3-8s] → ASSISTANT(toolCall: A) → [1-5s] → TOOL_RESULT(A) →
              [3-8s] → ASSISTANT(toolCall: B) → [1-5s] → TOOL_RESULT(B) →
              ...（重复 10-30 次）...
              → ASSISTANT(stop) → [10-30s idle] → USER_MSG（新循环）
```

---

### 4.4 Isometric Rendering Engine（`engine/renderer.ts`、`engine/isometric.ts`）

#### Isometric 坐标系统

Isometric 视图使用 2:1 菱形（标准 isometric 投影）：

```
                    ●
                   / \
                  /   \       TILE_WIDTH = 64px
                 /     \      TILE_HEIGHT = 32px
                ●       ●
                 \     /      比例：2:1
                  \   /
                   \ /
                    ●
```

#### 坐标转换

```typescript
// Tile 大小常量
const TILE_WIDTH = 64 // 菱形宽度（像素）
const TILE_HEIGHT = 32 // 菱形高度（像素）

// 笛卡尔 grid（col, row）→ 屏幕像素位置
function cartesianToIso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2),
  }
}

// 屏幕像素 → 笛卡尔 grid（用于鼠标命中测试）
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

#### 渲染顺序（Painter's Algorithm）

对于 isometric rendering，tiles 和 entities 必须从后到前绘制以正确处理重叠。

> **插值**：`render()` callback 接收一个 `interpolation` 因子（0.0–1.0），表示 fixed update 步之间的进度。这应该用于在角色的上次更新位置和当前位置之间插值其视觉位置，产生更平滑的运动（不受限于 fixed timestep）。没有插值的话，运动在低更新率时会出现"卡顿"。

```typescript
function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  interpolation: number,
): void {
  const { camera, world, character } = state

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.save()

  // 应用 camera 变换
  ctx.translate(camera.offsetX, camera.offsetY)
  ctx.scale(camera.zoom, camera.zoom)

  // 1. 渲染地板 tiles（底层，逐行逐列）
  for (let row = 0; row < world.height; row++) {
    for (let col = 0; col < world.width; col++) {
      renderFloorTile(ctx, world.tiles[row][col], col, row)
    }
  }

  // 2. 收集所有 entities（墙壁、家具、角色）用于 z-sorting
  const entities: Renderable[] = []

  // 添加墙壁段
  for (const wall of world.walls) {
    entities.push({ ...wall, sortY: wall.row + wall.col })
  }

  // 添加家具
  for (const item of world.furniture) {
    entities.push({ ...item, sortY: item.row + item.col })
  }

  // 添加角色（插值位置实现平滑渲染）
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

  // 3. 按 sortY 排序（从后到前），同行则按 sortX
  entities.sort((a, b) => a.sortY - b.sortY)

  // 4. 按排序顺序渲染 entities
  for (const entity of entities) {
    entity.render(ctx)
  }

  // 5. 渲染 UI overlays（情绪气泡、debug grid）
  if (character.emotion !== 'none') {
    renderEmotionBubble(ctx, character)
  }

  ctx.restore()
}
```

#### DPR（Device Pixel Ratio）处理

```typescript
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  // 以设备像素设置实际 canvas 大小
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  // 将 CSS 大小缩放到 CSS 像素
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  const ctx = canvas.getContext('2d')!

  // 缩放 context 以考虑 DPR
  ctx.scale(dpr, dpr)

  // Pixel-perfect rendering：禁用平滑
  ctx.imageSmoothingEnabled = false

  return ctx
}
```

#### 运行时 DPR 变化

当用户在不同像素密度的显示器之间拖拽浏览器窗口（例如 Retina → 外接 1080p）时，DPR 可以在运行时改变。我们必须检测这一点并重新设置 canvas。

```typescript
// 在 CanvasView.tsx 中——监视 DPR 变化
function useDPRWatcher(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onDPRChange: () => void,
) {
  useEffect(() => {
    let currentDPR = window.devicePixelRatio

    // matchMedia 方式：当 DPR 跨越当前值时触发
    const updateDPR = () => {
      const newDPR = window.devicePixelRatio
      if (newDPR !== currentDPR) {
        currentDPR = newDPR
        onDPRChange() // 重新运行 setupCanvas()
      }
      // 为下一次变化重新注册（matchMedia 对于给定阈值是一次性的）
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

### 4.5 角色状态机（`engine/character.ts`）

#### 状态图

```
                          GOTO_ROOM
               ┌──────────────────────────────┐
               │                              │
               ▼         到达                 │
            WALKING ──────────────→ 目标     │
               ▲         目的地        │      │
               │                       │      │
      GOTO_ROOM│              ┌────────┴──────┴───────┐
      （需要新 │              │   根据 action 类型      │
       房间）  │              │   路由到对应动画         │
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
               │      SLEEPING（自动）
               │
               └───── GOTO_ROOM 触发新的行走
```

#### 状态定义

```typescript
interface CharacterState {
  // 位置（移动中可以是小数）
  position: { col: number; row: number }

  // 当前 FSM 状态
  state: CharacterFSMState

  // 当前情绪
  emotion: EmotionId

  // 行走路径（WALKING 时）
  path: TileCoord[] | null
  pathIndex: number

  // 动画
  currentAnimation: AnimationId
  animationFrame: number
  animationTimer: number

  // 角色面向的方向
  direction: Direction

  // Action 队列
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

#### 更新逻辑

```typescript
function updateCharacter(
  character: CharacterState,
  dt: number,
  world: WorldState,
): void {
  switch (character.state) {
    case 'idle':
      // 检查待处理 actions
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world)
      }
      // 30s idle 后自动睡觉
      character.idleTimer += dt
      if (character.idleTimer > IDLE_SLEEP_THRESHOLD) {
        transitionTo(character, 'sleeping', 'sleepy')
      }
      break

    case 'walking':
      moveAlongPath(character, dt)
      if (hasReachedDestination(character)) {
        // 过渡到目标状态
        transitionTo(character, character.targetState, character.targetEmotion)
      }
      break

    case 'typing':
    case 'sitting':
    case 'thinking':
    case 'sleeping':
    case 'celebrating':
      // 检查待处理 actions（可中断）
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world)
      }
      break
  }

  // 更新动画帧
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
      const targetTile = room.activityZone // 在房间中坐/站的位置
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
        // 已在目的地或找不到路径
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

### 4.6 Pathfinding 系统（`engine/pathfinding.ts`）

#### Walkability Grid

世界中每个 tile 有一个可行走标志：

```typescript
type WalkabilityGrid = boolean[][] // true = 可行走，false = 阻塞

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

#### BFS 实现

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
  if (!grid[to.row]?.[to.col]) return null // 目标不可行走

  const visited = new Set<string>()
  const queue: PathNode[] = [{ col: from.col, row: from.row, parent: null }]
  visited.add(`${from.col},${from.row}`)

  // 4 方向邻居（isometric 移动无对角线）
  const dirs = [
    { dc: 1, dr: 0 }, // 东
    { dc: -1, dr: 0 }, // 西
    { dc: 0, dr: 1 }, // 南
    { dc: 0, dr: -1 }, // 北
  ]

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current.col === to.col && current.row === to.row) {
      // 重建路径
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

  return null // 找不到路径
}
```

#### 移动插值

```typescript
function moveAlongPath(character: CharacterState, dt: number): void {
  if (!character.path || character.pathIndex >= character.path.length) return

  const target = character.path[character.pathIndex]
  const dx = target.col - character.position.col
  const dy = target.row - character.position.row
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < 0.05) {
    // 吸附到 tile
    character.position.col = target.col
    character.position.row = target.row
    character.pathIndex++

    // 更新面向方向
    if (character.pathIndex < character.path.length) {
      const next = character.path[character.pathIndex]
      character.direction = getDirection(character.position, next)
    }
  } else {
    // 向目标移动
    const speed = CHARACTER_SPEED * dt
    character.position.col += (dx / distance) * speed
    character.position.row += (dy / distance) * speed
  }
}
```

---

### 4.7 Game Loop（`engine/gameLoop.ts`）

#### Fixed Timestep + 可变渲染

```typescript
const FIXED_DT = 1 / 60 // 每秒 60 次更新
const MAX_FRAME_DT = 0.1 // 上限，防止 spiral of death

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

    // 防止 spiral of death
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT

    this.accumulator += frameDt

    // Fixed timestep 更新
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT)
      this.accumulator -= FIXED_DT
    }

    // 带插值因子渲染
    const interpolation = this.accumulator / FIXED_DT
    this.render(interpolation)

    this.rafId = requestAnimationFrame(this.tick)
  }
}
```

#### Tab 可见性处理

当浏览器 tab 被隐藏时，`requestAnimationFrame` 暂停但 Bridge WebSocket events 继续到达。我们必须处理这种情况以避免 tab 重新可见时爆发大量过期 actions。

```typescript
// 在 GameLoop 或专用 VisibilityManager 中：
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
      // Tab 隐藏：缓冲传入 events 而非处理它们
      this.wasHidden = true
      this.connectionManager.setBuffering(true)
    } else {
      // Tab 重新可见：只处理最新状态，丢弃中间 events
      if (this.wasHidden) {
        this.wasHidden = false
        this.connectionManager.setBuffering(false)

        // 只处理最后一个有意义的 event（最新的 tool 或 lifecycle）
        // 以避免角色回放 30 秒的过期活动
        this.connectionManager.flushToLatestState()

        // 重置 game loop 的累加器以避免巨大的 dt 尖峰
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

## 5. 数据流

### 5.1 完整数据流图

```
~/.openclaw/agents/main/sessions/<session-id>.jsonl
         │
         │  JSONL append（OpenClaw 实时写入）
         │
         ▼
┌──────────────────────┐
│  Bridge Server       │  bridge/server.ts（Node.js，~50-80 行）
│                      │
│  fs.watch + readline │  监控文件变化，逐行解析
│  sessions.json 轮询  │  检测 session 切换
└────────┬─────────────┘
         │  WebSocket push（ws://127.0.0.1:18790）
         │  每行 JSONL → JSON 对象
         ▼
┌─────────────────┐
│  BridgeClient    │  connection/bridgeClient.ts
│（或 MockProvider │  connection/mockProvider.ts
│   如果离线）     │
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
│ 发送到：         │
│ - GameState      │──────────────────┐
│ - EventBus       │──────────┐       │
└─────────────────┘          │       │
                              │       │
                   EventBus   │       │ action dispatch
                  （UI 更新   │       │
                   节流）     │       │
                              ▼       ▼
                     ┌──────────────────────┐
                     │     GameState         │  engine/gameState.ts
                     │                      │
                     │  character ◄─── update(dt) ◄─── GameLoop
                     │  world                │              │
                     │  camera               │              │
                     └──────────┬───────────┘              │
                                │                           │
                                │ 读取 state                │
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

### 5.2 UI 更新流

```
GameState 修改
       │
       │ emit('stateChange', { type, data })
       ▼
   EventBus
       │
       │  节流（最多 250ms）
       ▼
  React 组件
  （Dashboard、ConnectionBadge）
       │
       │ setState / useReducer dispatch
       ▼
  React re-render（仅 UI，非 canvas）
```

---

## 6. Sprite 资源规格

### 6.1 Isometric Tile 尺寸

```
标准 tile：     64 x 32 px （2:1 比例菱形）
高 tile（墙）：  64 x 64 px （菱形 + 32px 高度）
角色：          32 x 48 px （适合一个 tile，头/帽子更高）
家具：          各不相同，通常 64 x 64 到 128 x 96 px
情绪气泡：      16 x 16 px （浮在角色头上方）
```

### 6.2 角色 Spritesheet 格式

每个动画是单个 PNG 中的水平帧条：

```
┌────┬────┬────┬────┐
│ F0 │ F1 │ F2 │ F3 │   idle_sw.png（4 帧，每帧 32x48）
└────┴────┴────┴────┘

每个动画的总 spritesheet：
  - idle:      4 帧 × 4 方向 = 16 帧（或单方向如果对称）
  - walk:      6 帧 × 4 方向 = 24 帧
  - type:      4 帧 × 1 方向  = 4 帧（始终面向桌子）
  - sleep:     4 帧 × 1 方向  = 4 帧（始终在床上）
  - sit:       2 帧 × 2 方向 = 4 帧
  - think:     4 帧 × 1 方向  = 4 帧
  - celebrate: 6 帧 × 1 方向  = 6 帧
```

### 6.3 动画时序

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

### 6.4 初始 Sprite 策略

MVP 阶段，sprites 可以**程序化生成**（彩色矩形 + 最少细节）以不阻塞开发。高精度 pixel art 可以稍后替换而无需更改代码，只要帧尺寸匹配即可。

```typescript
// 占位 sprite 生成器（用于开发）
function generatePlaceholderSprite(
  width: number,
  height: number,
  color: string,
  label: string,
): ImageBitmap {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!

  // 简单彩色矩形
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)

  // 标签
  ctx.fillStyle = '#fff'
  ctx.font = '8px monospace'
  ctx.fillText(label, 2, height / 2)

  return canvas.transferToImageBitmap()
}
```

---

## 7. Session Log 格式参考

### 7.1 文件结构

```
~/.openclaw/agents/main/sessions/
├── sessions.json                                    # 所有 session 的索引文件
├── e85b6d26-7bca-40bb-bfdf-5544b2616997.jsonl       # Session log（append-only）
├── 0772f97a-487c-4f72-9e07-1877e998bb05.jsonl       # 另一个 session log
└── ...
```

**sessions.json** 结构：

```json
{
  "agent:main:main": {
    "sessionId": "e85b6d26-7bca-40bb-bfdf-5544b2616997",
    "sessionFile": "/Users/.../.openclaw/agents/main/sessions/e85b6d26-....jsonl",
    "updatedAt": 1774261033176
  }
}
```

Bridge Server 读取 `sessions.json`，按 `updatedAt` 降序排列，选择最近活跃的 session 进行监控。

### 7.2 JSONL 事件格式

每个 `.jsonl` 文件的每一行都是一个独立的 JSON 对象。所有事件共享以下基础字段：

```typescript
interface SessionLogEvent {
  type:
    | 'session'
    | 'message'
    | 'model_change'
    | 'thinking_level_change'
    | 'custom'
  id: string // 唯一事件 ID
  parentId?: string // 父事件 ID（用于关联 toolResult → assistant message）
  timestamp: string // ISO 8601（如 "2026-03-22T10:15:30.123Z"）
}
```

### 7.3 事件类型详解

**Session 初始化**：

```typescript
// type: "session" — 文件第一行，session 元数据
{
  type: "session",
  id: "...",
  version: 3,
  cwd: "/Users/yao/project",
  timestamp: "..."
}
```

**Model 配置变更**：

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

**用户消息**：

```typescript
// type: "message", role: "user"
{
  type: "message",
  id: "...",
  role: "user",
  message: {
    role: "user",
    content: "请帮我修改这个文件"
  },
  timestamp: "..."
}
```

**Assistant 消息**（可包含多种内容）：

```typescript
// type: "message", role: "assistant"
{
  type: "message",
  id: "...",
  role: "assistant",
  message: {
    role: "assistant",
    content: [
      { type: "text", text: "我来帮你修改文件..." },
      { type: "thinking", thinking: "分析文件结构..." },
      {
        type: "toolCall",
        id: "toolu_vrtx_01SoDRWrP4PjH37XhzVp1TDp",
        name: "edit",     // 注意：小写
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
    stopReason: "toolUse",  // "toolUse" = 继续执行, "stop" = 完成
    timestamp: 1774259409091
  },
  timestamp: "..."
}
```

**Tool 执行结果**：

```typescript
// type: "message", role: "toolResult"
{
  type: "message",
  id: "...",
  parentId: "...",     // 指向对应的 assistant message
  message: {
    role: "toolResult",
    toolCallId: "toolu_vrtx_01SoDRWrP4PjH37XhzVp1TDp",
    toolName: "edit",
    content: [
      { type: "text", text: "文件已成功修改" }
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

### 7.4 Tool 名称映射

Session log 中的 tool 名称是**小写**的，与 Gateway 的大写命名不同：

| Session Log tool 名称 | 对应操作        | Watch Claw 映射房间              |
| --------------------- | --------------- | -------------------------------- |
| `exec`                | 执行 shell 命令 | `office`（type, serious）        |
| `read`                | 读取文件        | `living-room`（sit, thinking）   |
| `write`               | 写入新文件      | `office`（type, focused）        |
| `edit`                | 编辑现有文件    | `office`（type, focused）        |
| `glob`                | 文件模式搜索    | `living-room`（sit, curious）    |
| `grep`                | 内容搜索        | `living-room`（sit, curious）    |
| `web_search`          | 网络搜索        | `living-room`（think, curious）  |
| `memory_search`       | 记忆搜索        | `living-room`（think, thinking） |
| `task`                | 启动子任务      | `living-room`（think, thinking） |
| `todowrite`           | 更新待办列表    | `office`（type, focused）        |
| 其他未知 tool         | 默认处理        | `office`（type, focused）        |

> **注意**：上表列出了常用工具。完整映射（包括 `memory_get`、`process`、`sessions_spawn`、`sessions_send`、`sessions_list`、`sessions_history`）请参见第 4.2 节的 `TOOL_ROOM_MAP`。

### 7.5 关键字段说明

| 字段         | 说明                                                               |
| ------------ | ------------------------------------------------------------------ |
| `stopReason` | `"toolUse"` = agent 正在使用工具，将继续；`"stop"` = 回合结束      |
| `usage`      | Token 使用量，包含 input/output/cacheRead/cacheWrite               |
| `cost`       | 本次请求的美元成本                                                 |
| `parentId`   | `toolResult` 通过此字段关联到发起 tool call 的 `assistant` message |
| `version`    | Session 格式版本（当前为 3）                                       |
| `content[]`  | 单个 assistant message 可包含多个 `toolCall`，需逐一处理           |

---

## 8. 错误处理策略

错误在每一层处理，遵循原则：**永不崩溃可视化**。角色应始终可见且响应，即使数据源出了问题。

### 8.1 错误层级

| 层                   | 错误类型                    | 处理方式                               | 用户影响                                     |
| -------------------- | --------------------------- | -------------------------------------- | -------------------------------------------- |
| **Bridge Server**    | Session log 文件不存在      | 等待文件出现，定期重试                 | Badge 显示 "Waiting"，角色在 idle 状态       |
| **Bridge Server**    | sessions.json 读取失败      | 使用上一个已知 session，记录 warning   | 无——继续监控当前 session                     |
| **Bridge WebSocket** | 连接被拒绝（Bridge 未启动） | 指数退避自动重连；切换到 MockProvider  | Badge 显示 "Mock"，角色在 mock mode 继续运行 |
| **Bridge WebSocket** | 连接断开                    | 重连；重连期间缓冲 events              | 短暂 "Reconnecting..." badge，然后恢复       |
| **Bridge WebSocket** | 格式错误的消息（无效 JSON） | 记录 warning，跳过该行，继续           | 无——静默忽略                                 |
| **EventParser**      | 未知 event 类型             | 返回 `null`，记录 debug 信息           | 无——event 被忽略                             |
| **EventParser**      | 未知 tool name              | 映射到默认房间（office），记录 warning | 角色去 office（合理的默认值）                |
| **ActionQueue**      | 队列溢出                    | 丢弃最低优先级 action                  | 角色跳过不太重要的动画                       |
| **Pathfinding**      | 找不到路径                  | 角色留在当前房间，记录 warning         | 角色不移动（安全回退）                       |
| **Character FSM**    | 无效状态转换                | 忽略转换，记录 error                   | 角色保持当前状态                             |
| **Renderer**         | Sprite 加载失败             | 使用彩色矩形占位                       | 视觉略有降级，仍然功能正常                   |
| **Renderer**         | Canvas context 丢失         | 重新获取 context，重新初始化           | 短暂闪烁，然后恢复                           |
| **GameLoop**         | 过大的 dt                   | 限制在 MAX_FRAME_DT（100ms）           | 防止 spiral of death                         |

### 8.2 错误报告

```typescript
// 集中式错误 logger——所有层使用此接口
interface ErrorLogger {
  // Errors：出了问题，需要关注
  error(module: string, message: string, context?: unknown): void

  // Warnings：意外但已优雅处理
  warn(module: string, message: string, context?: unknown): void

  // Debug：开发用的详细信息
  debug(module: string, message: string, context?: unknown): void
}

// 实现：开发环境记录到控制台，生产环境可发送到 telemetry
const logger: ErrorLogger = {
  error: (mod, msg, ctx) => console.error(`[${mod}] ${msg}`, ctx),
  warn: (mod, msg, ctx) => console.warn(`[${mod}] ${msg}`, ctx),
  debug: (mod, msg, ctx) => {
    if (import.meta.env.DEV) console.debug(`[${mod}] ${msg}`, ctx)
  },
}
```

### 8.3 恢复模式

**Bridge WebSocket 恢复**：

1. 连接丢失 → 状态过渡到 `reconnecting`
2. 指数退避重试（1s、2s、4s、...、30s 最大）
3. 5 次失败重试后 → 切换到 MockProvider，后台继续重试
4. 成功重连后 → Bridge Server 从当前文件位置继续推送新事件
5. 从当前状态恢复 event 处理（不回放历史行）

**Bridge Server Session 切换恢复**：

1. Bridge Server 定期检查 `sessions.json` 的 `updatedAt`
2. 检测到新的最近活跃 session → 切换到新 JSONL 文件
3. 通知所有连接的客户端 session 已切换
4. 客户端重置角色状态，开始处理新 session 的事件

**Renderer 恢复**：

```typescript
// 处理 canvas context 丢失（罕见但在移动端/GPU 重置时可能发生）
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()
  gameLoop.pause()
})

canvas.addEventListener('webglcontextrestored', () => {
  // 重新初始化 rendering context
  setupCanvas(canvas)
  gameLoop.resume()
})
// 注意：对于 Canvas 2D，context 丢失更罕见，但我们防御性地
// 处理 getContext('2d') 返回 null 的情况。
```

**优雅降级优先级**：

1. 角色始终可见（即使只是彩色矩形）
2. 角色始终响应 events（即使动画降级）
3. Dashboard 始终显示连接状态
4. Mock mode 始终可用作为 fallback

---

## 9. 开发工作流

### 9.1 本地开发

```bash
# 安装依赖
pnpm install

# 启动 dev server（带 HMR）+ Bridge Server
pnpm dev
# 内部执行：concurrently "vite" "tsx bridge/server.ts"

# 应用在 http://localhost:5173 打开
# Bridge Server 在 ws://127.0.0.1:18790 运行
# 如果 OpenClaw 有活跃 session，Bridge 自动监控最新 session log
# 如果 Bridge 未运行或无 session log，回退到 mock mode
```

### 9.2 构建 & 预览

```bash
# 生产构建
pnpm build

# 本地预览生产构建
pnpm preview

# 类型检查
pnpm typecheck

# Lint
pnpm lint

# 测试
pnpm test
```

### 9.3 开发模式功能

- **Mock mode 指示器**：使用模拟数据时清晰的视觉 "MOCK" badge
- **Debug grid overlay**：切换 isometric grid 线条用于 tile 对齐
- **FPS 计数器**：显示当前帧率
- **Event log**：所有传入 Session Log events 的 console 风格日志
- **Hot reload**：Vite HMR 实现代码修改的即时反馈
- **Bridge status**：显示 Bridge Server 连接状态和当前监控的 session ID

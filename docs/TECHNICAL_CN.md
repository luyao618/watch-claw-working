# Watch Claw - 技术设计文档

> **Version**: 1.0.0
> **Date**: 2026-03-24
> **Status**: In Progress
> **上版**: v0.2 使用手写 Canvas 2D 渲染器，3/4 俯视角。v1.0 迁移到 Phaser 3，改为横版平台跳跃风格。
>
> **注意**：本中文版为精简版，涵盖核心架构设计。完整技术细节（Scene Graph、Tilemap 图层设计、Tileset 规格、Camera 参数、迁移风险评估等）请参见英文版 [TECHNICAL.md](./TECHNICAL.md)。

---

## 1. 技术栈

### 1.1 选型总结

| 层             | 选择                                          | 理由                                                                                  |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| **语言**       | TypeScript 5.x（strict mode）                 | 为 game state、events 和协议提供类型安全                                              |
| **游戏引擎**   | Phaser 3.80+                                  | 内置 Arcade Physics、Tilemap、Sprite 动画、Camera — 非常适合 2D 横版平台跳跃风格      |
| **UI 框架**    | React 18                                      | 仅用于 overlay UI（dashboard、controls）；game state 在 Phaser Scene 内部             |
| **构建工具**   | Vite 8                                        | 快速 HMR、原生 TS 支持、兼容 Phaser                                                  |
| **地图编辑器** | Tiled（导出 JSON）                            | 可视化 tilemap 编辑，碰撞层，对象层（出生点）— Phaser 原生支持                        |
| **通信**       | Session Log 文件监控 + WebSocket Bridge       | 监控 OpenClaw JSONL session logs，通过 Node.js bridge 推送到浏览器（与 v0.2 相同）    |
| **渲染**       | Phaser WebGL / Canvas 2D（自动检测）          | GPU 加速 sprites、粒子、光照效果；Canvas 2D 作为 fallback                             |
| **包管理器**   | pnpm                                          | 快速、磁盘高效、严格的依赖解析                                                        |
| **Linting**    | ESLint + Prettier                             | 一致的代码风格、类型感知的 linting                                                    |
| **测试**       | Vitest                                        | 快速单元测试、兼容 Vite                                                               |
| **桌面端**     | Electron                                      | 独立桌面窗口、系统托盘、置顶选项                                                      |

### 1.2 为什么选 Phaser（而不是 Canvas 2D / PixiJS）

| 替代方案            | 我们为什么选择不同的                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Canvas 2D (v0.2)**| v0.2 的手写渲染器功能可用但视觉效果差（彩色矩形）。没有物理引擎、没有 tilemap、没有粒子系统。从零添加横版平台物理和特效需要巨大的工作量。                              |
| **PixiJS**          | 优秀的渲染器，但**没有物理引擎**。我们的横版平台跳跃需要重力、跳跃、平台碰撞 — 需要手动集成 matter.js/planck.js，胶水代码很多。                                      |
| **Phaser 3**        | **最适合横版平台跳跃**：Arcade Physics（重力、速度、弹跳、碰撞器）、原生 Tiled tilemap 支持、sprite 动画系统、相机跟随、粒子发射器 — 全部内置。~1MB 的 bundle 对于 Electron 桌面应用是可接受的。 |

### 1.3 为什么选横版平台跳跃（而不是 3/4 俯视角）

| 3/4 俯视角 (v0.2)                        | 横版平台跳跃 (v1.0)                           |
| ----------------------------------------- | ---------------------------------------------- |
| 单层楼，房间水平排列                      | **三层楼垂直堆叠** — 更自然的房屋感            |
| 没有垂直感，房间感觉平面                  | 重力 + 跳跃 → 令人满足的移动体验              |
| BFS 寻路在 tile grid 上                   | 基于物理的移动：行走、跳跃、爬楼梯/梯子       |
| Y-sort 深度排序（复杂）                   | 简单的左右 sprite 分层                         |
| 与 Star Office UI（竞品）类似             | **独特的视觉身份** — 没有竞品这样做            |

---

## 2. 架构

### 2.1 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                       Electron 桌面应用                           │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     React Shell                               │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │   PhaserContainer    │  │      Dashboard.tsx            │  │  │
│  │  │   (挂载 Phaser)      │  │      (状态、tokens、日志)     │  │  │
│  │  └──────────┬───────────┘  └──────────────────────────────┘  │  │
│  └─────────────│────────────────────────────────────────────────┘  │
│                │                                                    │
│                ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Phaser 游戏实例                                   │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ BootScene   │→│  HouseScene   │  │  UIScene (overlay)  │  │  │
│  │  │ (预加载)    │  │  (主游戏)     │  │  (HUD, 气泡)        │  │  │
│  │  └─────────────┘  └──────┬───────┘  └─────────────────────┘  │  │
│  │                          │                                    │  │
│  │           ┌──────────────┼──────────────────┐                 │  │
│  │           ▼              ▼                  ▼                 │  │
│  │    ┌────────────┐ ┌────────────┐ ┌──────────────────┐        │  │
│  │    │  Tilemap   │ │  角色      │ │  Arcade Physics  │        │  │
│  │    │  (Tiled)   │ │  控制器    │ │  (重力, 跳跃,    │        │  │
│  │    │            │ │  (FSM)     │ │   碰撞器)        │        │  │
│  │    └────────────┘ └────────────┘ └──────────────────┘        │  │
│  │           ▲                                                   │  │
│  │           │ dispatch(CharacterAction)                         │  │
│  │    ┌──────┴──────────────────────────────────────────┐        │  │
│  │    │          Event Bridge（适配器）                   │        │  │
│  │    │  ConnectionManager → EventParser → CharacterAction│       │  │
│  │    └─────────────────────────────────────────────────┘        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          │                                         │
│                          │ WebSocket                               │
│                          ▼                                         │
│              Bridge Server (Node.js)                               │
│              ws://127.0.0.1:18790                                  │
│                          │                                         │
│                          │ fs.watch                                │
│                          ▼                                         │
│            OpenClaw Session Log (JSONL)                             │
│            ~/.openclaw/agents/main/sessions/                       │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 关键设计决策

1. **Phaser 接管游戏循环和渲染** — 不再需要手写 `GameLoop`、`renderer.ts`、`coordinates.ts`。Phaser 的 `update()` 以 60fps 运行，内置 delta-time 处理。

2. **Connection 层保持不变** — `BridgeClient`、`EventParser`、`ConnectionManager`、`ActionQueue` 完全不动。它们产生 `CharacterAction` 对象，Phaser scene 通过 Event Bridge 适配器消费。

3. **React 仅用于 overlay** — `Dashboard.tsx` 订阅 ConnectionManager 获取状态/token/日志更新。Phaser 渲染游戏世界。游戏逻辑不需要 React ↔ Phaser 状态同步。

4. **Tiled 地图用于关卡设计** — 房间布局、碰撞层、家具放置、出生点全部在 Tiled JSON 文件中定义。不再需要硬编码的 `FLOOR_LAYOUT` 数组或 `pixelFurniture.ts` 矩形绘制。

5. **Arcade Physics 提供横版平台跳跃体验** — 重力把角色拉下来，跳跃设置负 Y 速度，平台碰撞器防止穿过地板。楼梯/梯子使用 overlap 区域配合自定义物理切换。

---

## 3. 目录结构

```
watch-claw/
├── bridge/                          # Bridge Server（不变）
│   └── server.ts                    #   监控 session JSONL → WS 推送
├── electron/                        # Electron 外壳（不变）
│   ├── main.cjs
│   └── preload.cjs
├── src/
│   ├── connection/                  # Connection 层（不变）
│   │   ├── types.ts                 #   事件类型、CharacterAction 等
│   │   ├── bridgeClient.ts          #   带重连的 WebSocket 客户端
│   │   ├── eventParser.ts           #   session log → CharacterAction
│   │   ├── actionQueue.ts           #   优先级操作队列
│   │   ├── connectionManager.ts     #   协调连接和事件分发
│   │   └── index.ts
│   ├── game/                        # Phaser 游戏层（新 — 替换 engine/）
│   │   ├── config.ts                #   Phaser.Types.Core.GameConfig
│   │   ├── scenes/
│   │   │   ├── BootScene.ts         #   资源预加载，加载进度条
│   │   │   ├── HouseScene.ts        #   主游戏场景（tilemap、角色、物理）
│   │   │   └── UIScene.ts           #   HUD 覆盖层场景（情绪气泡、房间标签）
│   │   ├── characters/
│   │   │   ├── LobsterCharacter.ts  #   玩家角色 sprite + FSM + 物理
│   │   │   └── PetCompanion.ts      #   可选的跟随角色的宠物
│   │   ├── systems/
│   │   │   ├── EventBridge.ts       #   适配器：ConnectionManager → Phaser 事件
│   │   │   ├── RoomManager.ts       #   房间检测、活动区域、房间标签
│   │   │   ├── EmotionSystem.ts     #   角色头顶的情绪气泡 sprites
│   │   │   └── ParticleEffects.ts   #   庆祝纸屑、错误火花等
│   │   └── index.ts
│   ├── ui/                          # React Overlay（更新）
│   │   ├── PhaserContainer.tsx      #   将 Phaser 游戏挂载到 React DOM（新）
│   │   ├── Dashboard.tsx            #   状态面板（更新）
│   │   ├── ConnectionBadge.tsx      #   连接状态指示器（不变）
│   │   └── index.ts
│   ├── utils/                       # 工具函数（不变）
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   ├── eventBus.ts
│   │   └── index.ts
│   ├── App.tsx                      #   根组件（为 Phaser 更新）
│   ├── main.tsx                     #   入口
│   └── index.css
├── public/
│   └── assets/
│       ├── tilemaps/                #   Tiled JSON 导出（新）
│       ├── tilesets/                #   tileset 图片（新）
│       ├── character/               #   角色 spritesheets（更新）
│       ├── effects/                 #   粒子和特效 sprites（新）
│       └── ui/                      #   UI 资源
└── ...
```

### 3.1 移除的文件（v0.2 → v1.0）

| 移除的文件/目录                     | 原因                                             |
| ----------------------------------- | ------------------------------------------------ |
| `src/engine/gameLoop.ts`            | Phaser 提供自己的游戏循环                        |
| `src/engine/renderer.ts`            | Phaser 通过 WebGL/Canvas 自动渲染                |
| `src/engine/coordinates.ts`         | 不再需要等距坐标转换（正视图是 1:1 的）          |
| `src/engine/camera.ts`              | Phaser 相机系统替代                               |
| `src/engine/gameState.ts`           | Game state 现在在 Phaser Scene 中；connection 类型保留 |
| `src/engine/pathfinding.ts`         | 被基于物理的移动替代（行走 + 跳跃）              |
| `src/engine/pixelFurniture.ts`      | 被 Tiled tilemap + spritesheet 资源替代          |
| `src/world/tileMap.ts`              | 被 Tiled JSON 导入替代                           |
| `src/world/rooms.ts`               | 被 RoomManager 从 Tiled 对象层读取替代           |
| `src/ui/CanvasView.tsx`             | 被 PhaserContainer.tsx 替代                      |
| `src/ui/ZoomControls.tsx`           | Phaser 相机原生处理缩放                          |

### 3.2 保留的文件（与 v0.2 完全相同）

| 保留的文件/目录                         | 原因                                      |
| --------------------------------------- | ----------------------------------------- |
| `bridge/server.ts`                      | Session log 监控 → WS 推送（工作完美）    |
| `src/connection/bridgeClient.ts`        | 带重连逻辑的 WebSocket 客户端            |
| `src/connection/eventParser.ts`         | Session log 事件 → CharacterAction 映射  |
| `src/connection/actionQueue.ts`         | 操作优先级队列                            |
| `src/connection/connectionManager.ts`   | 协调连接和事件分发                        |
| `src/connection/types.ts`              | 所有类型定义（扩展，不替换）              |
| `src/utils/*`                           | 工具函数和常量                            |
| `electron/*`                            | Electron 外壳                             |

---

## 4. Phaser Scene 设计

### 4.1 三层楼房屋布局（正视图）

```
         ┌──────────────────────────────────────────────┐
  3F     │     📦           📚           🌙             │
  阁楼   │   仓库          书房          阳台            │
         │  （下载）       （文档）      （搜索）        │
         │    ┌──┐         ┌──┐                         │
         ├────┤  ├─────────┤  ├─────────────────────────┤
  2F     │     🔧           🛋           🛏              │
  主楼   │    工具         办公          卧室             │
         │  （执行）       （对话）      （休息）        │
         │    ┌──┐         ┌──┐                         │
         ├────┤  ├─────────┤  ├─────────────────────────┤
  1F     │     📱           💻           🗑              │
  地下   │   地下室        机房          垃圾桶           │
         │  （应用）       （code）      （清理）        │
         └──────────────────────────────────────────────┘
              ▲ 楼梯/梯子连接各楼层 ▲
```

### 4.2 角色控制器状态机

```
                              ┌──────────┐
                   跳跃 ┌─────│  JUMPING  │
                        │     └────┬─────┘
                        │          │ 落地
  ┌────────┐     移动  ┌▼─────────▼┐     停止    ┌────────┐
  │SLEEPING│◄─────────│   IDLE     │────────────►│ WALKING│
  └───┬────┘  wake_up  └─────┬─────┘              └────────┘
      │                      │ 到达活动区域
      │         ┌────────────┼────────────┐
      │         ▼            ▼            ▼
      │   ┌──────────┐ ┌──────────┐ ┌────────────┐
      │   │  TYPING  │ │ THINKING │ │CELEBRATING │
      │   └──────────┘ └──────────┘ └────────────┘
      │              新 action 到达
      └──────────────────────────────┘
              GO_SLEEP (idle > 30s)
```

### 4.3 自动导航

当 `CharacterAction(GOTO_ROOM)` 到达时：
1. 确定目标房间的楼层和活动区域
2. 如果在同一楼层 → 水平行走到目标 X
3. 如果在不同楼层 → 走到最近的楼梯 → 上/下楼 → 走到目标 X
4. 到达活动区域 → 切换到目标动画状态

---

## 5. 事件流（端到端）

```
OpenClaw 执行 tool "write"
       │
       ▼
Session JSONL 追加一行
       │
       ▼
Bridge Server (fs.watch) 检测到变化 → WebSocket 广播
       │
       ▼
BridgeClient (浏览器) 接收 → ConnectionManager → EventParser
       │
       ▼
返回 CharacterAction: { type: "GOTO_ROOM", room: "office", animation: "type", emotion: "focused" }
       │
       ▼
EventBridge 分发到 HouseScene → LobsterCharacter 接收
       │
       ▼
角色走到办公室桌前 → 切换到 TYPING 状态 → 播放打字动画 → 显示 "focused" 情绪气泡
```

---

## 6. 非功能性需求

| 需求            | 目标                                                          |
| --------------- | ------------------------------------------------------------- |
| **帧率**        | 60fps（Phaser requestAnimationFrame）                         |
| **Bundle 大小** | < 1.5MB gzipped（Phaser ~1MB + 应用代码 ~200KB + 资源懒加载）|
| **平台**        | Electron 桌面应用（macOS 优先，Windows/Linux 后续）           |
| **响应式**      | 最小 800×600，支持 4K，整数像素缩放                           |
| **启动时间**    | < 3s 到首次有意义渲染（预加载期间显示加载条）                 |
| **Bridge 重连** | 带指数退避的自动重连（1s–30s）— 不变                          |
| **内存使用**    | < 150MB（Phaser + 纹理）                                     |

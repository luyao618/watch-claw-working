# Watch Claw

[English](./README.md)

> 一个像素风小屋，你的 OpenClaw AI 就住在里面 -- 实时观看它写代码、思考、休息和庆祝。

![Watch Claw V1 截图](./docs/assets/V1-demo.jpg)

**Watch Claw** 是 [OpenClaw](https://github.com/openclaw/openclaw) AI 代理工作状态的实时像素风可视化工具。一个戴着龙虾帽的角色 -- 代表 OpenClaw 代理 -- 住在一栋三层小屋里，根据代理的实际运行事件在九个房间之间移动、执行活动并表达情感。

基于 **Phaser 3 Arcade Physics** 构建，支持重力、楼层间跳跃、单向平台穿越和智能自动导航 -- 全部以手绘像素风横版风格呈现。

## 工作原理

```
OpenClaw 执行工具
       |
       v
Session JSONL 文件追加新行
       |
       v
Bridge Server (fs.watch) 检测变化，通过 WebSocket 广播
       |
       v
Watch Claw 接收事件，映射为 CharacterAction
       |
       v
角色走到对应房间，播放动画，显示情绪
```

轻量级 **Bridge Server**（Node.js）监控 OpenClaw 的会话日志文件（`~/.openclaw/agents/main/sessions/<session-id>.jsonl`），通过 `fs.watch` 检测新条目，并通过 WebSocket（`ws://127.0.0.1:18790`）推送到浏览器。前端解析这些事件并转化为角色行为。

## 房间映射

角色根据 OpenClaw 代理的当前操作在房间之间移动。`exec` 工具会通过检查命令内容进一步分类。

```
         +-------------------------------------------------+
  3F     |  📦 仓库           📚 书房         🌙 阳台       |
  阁楼   |  (下载)            (文档)          (搜索)        |
         +-------------------------------------------------+
  2F     |  🔧 工具间         🛋 办公室       🛏 卧室       |
  主楼层 |  (执行)            (对话)          (休息)        |
         +-------------------------------------------------+
  1F     |  🏚 地下室         🖥 机房          🗑 垃圾桶     |
  底层   |  (子代理)          (编程)          (删除)        |
         +-------------------------------------------------+
```

| 房间          | 楼层 | 触发条件                                                                                         | 动画      | 情绪      |
| ------------- | ---- | ------------------------------------------------------------------------------------------------ | --------- | --------- |
| 🌙 **阳台**   | 3F   | `web_search`、`web_fetch`                                                                        | 思考      | 好奇      |
| 📚 **书房**   | 3F   | `read`、`write`、`edit`、`grep`、`glob`、`memory_search`、`memory_get`、`todowrite`              | 打字/思考 | 专注/好奇 |
| 📦 **仓库**   | 3F   | `exec` + `curl`、`wget`、`pip install`、`npm install`、`brew install`                            | 打字      | 好奇      |
| 🔧 **工具间** | 2F   | `exec` + 通用命令（`ls`、`echo` 等）、`cron`                                                     | 打字      | 严肃      |
| 🛋 **办公室** | 2F   | 助手文本回复、思考、用户消息、未知工具                                                           | 打字/思考 | 专注/思考 |
| 🛏 **卧室**   | 2F   | 空闲 > 30 秒、`stopReason: stop`（会话结束）                                                     | 睡觉      | 困倦      |
| 🏚 **地下室** | 1F   | `task`、`sessions_spawn`、`sessions_send`、`sessions_list`、`sessions_history`、`sessions_yield` | 思考      | 思考      |
| 🖥 **机房**   | 1F   | `exec` + `git`、`python`、`node`、`npm run`、`make`、`cargo`、`docker`、`tsc`、`vitest` 等       | 打字      | 专注      |
| 🗑 **垃圾桶** | 1F   | `exec` + `rm`、`trash`、`delete`、`unlink`                                                       | 打字      | 严肃      |

## 功能特性

- **Phaser 3 Arcade Physics** -- 重力、楼层间跳跃、单向平台穿越
- **像素风背景** -- 手绘 512x512 小屋画作，附碰撞层叠加
- **角色状态机** -- idle、walking、jumping、typing、thinking、sleeping、celebrating 状态
- **智能自动导航** -- 走到通道口，跳上或落下楼层，再走到目标房间
- **情绪气泡** -- 角色头顶的语音气泡图标（专注、思考、困倦、开心、困惑、好奇、严肃、满足）
- **粒子效果** -- 庆祝彩纸、错误火花、睡眠浮动 Z 字符
- **音效** -- 脚步声、打字声、鼾声、跳跃声、庆祝声、错误提示音
- **状态面板** -- 连接状态、角色状态/房间/情绪、会话信息、Token 使用量、活动日志
- **Electron 桌面应用** -- 独立窗口，系统托盘，置顶选项，Bridge Server 自动启动
- **键盘控制** -- 方向键移动，Z 全屋视图，F 跟随角色，D 切换面板，M 静音，+/- 或滚轮缩放

## 技术栈

| 层级       | 技术选型                   | 用途                                 |
| ---------- | -------------------------- | ------------------------------------ |
| 语言       | TypeScript 5.x（严格模式） | 为游戏状态、事件和协议提供类型安全   |
| 游戏引擎   | Phaser 3.80+               | Arcade Physics、瓦片地图、精灵、相机 |
| UI 框架    | React 19                   | 仅用于覆盖层 UI（面板、控件）        |
| 构建工具   | Vite 8                     | 快速 HMR，原生 TS 支持               |
| 桌面应用   | Electron                   | 独立桌面应用，系统托盘               |
| 通信       | WebSocket（Bridge Server） | 会话日志监控 + 实时推送              |
| 地图编辑器 | Tiled                      | 可视化瓦片地图编辑，碰撞层和对象层   |
| 包管理器   | pnpm                       | 快速、节省磁盘、严格依赖解析         |
| 测试       | Vitest                     | 快速单元测试，兼容 Vite              |
| 代码规范   | ESLint + Prettier          | 统一代码风格，Husky 预提交钩子       |

## 架构设计

```
+------------------------------------------------------------------+
|                     Electron 桌面应用                              |
|                                                                   |
|  React Shell                                                      |
|  +---------------------------+  +------------------------------+  |
|  | PhaserContainer           |  | Dashboard.tsx                |  |
|  | (Phaser 3 游戏画布)        |  | (状态、Token、事件日志)      |  |
|  +------------+--------------+  +------------------------------+  |
|               |                                                   |
|               v                                                   |
|  游戏引擎                                                         |
|  [Phaser Scene] <------------ [角色状态机]                        |
|               ^                                                   |
|               | dispatch(CharacterAction)                         |
|  连接层                                                           |
|  [BridgeClient] --> [EventParser] --> [ActionQueue]               |
|  [ConnectionManager 统一调度]                                     |
+------------------------------------------------------------------+
                          |
                          | WebSocket (ws://127.0.0.1:18790)
                          v
                   Bridge Server (Node.js)
                          |
                          | fs.watch
                          v
              OpenClaw 会话日志 (JSONL)
              ~/.openclaw/agents/main/sessions/
```

### 连接层

- **BridgeClient** -- WebSocket 客户端，支持指数退避自动重连（1s 至 30s）
- **EventParser** -- 将会话日志事件（工具调用、生命周期、模型切换）映射为 `CharacterAction` 对象
- **ActionQueue** -- 优先级队列（高 > 中 > 低），队列满时丢弃最低优先级动作
- **ConnectionManager** -- 统一调度 BridgeClient + EventParser，提供 `onAction()`、`onStatusChange()`、`onEventLog()` 订阅接口

## 事件映射

完整映射见上方[房间映射](#房间映射)表。`exec` 工具通过检查命令字符串进行分类：

| 命令模式  | 目标房间       | 示例                                                          |
| --------- | -------------- | ------------------------------------------------------------- |
| 下载/安装 | 📦 仓库 (3F)   | `curl`、`wget`、`pip install`、`npm install`、`brew install`  |
| 开发/编程 | 🖥 机房 (1F)   | `git`、`python`、`node`、`npm run`、`make`、`cargo`、`docker` |
| 删除/清理 | 🗑 垃圾桶 (1F) | `rm`、`trash`、`delete`、`unlink`                             |
| 通用命令  | 🔧 工具间 (2F) | `ls`、`echo`、`cat`、其他                                     |

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [OpenClaw](https://github.com/openclaw/openclaw) 已安装并配置

### 运行

```bash
git clone https://github.com/luyao618/watch-claw-working.git
cd watch-claw-working
pnpm install
pnpm dev
```

这会同时启动 Vite 开发服务器和 Bridge Server。在浏览器中打开 `http://localhost:5173`。

Bridge Server 会自动定位 `~/.openclaw/agents/main/sessions/` 中最近活跃的 OpenClaw 会话并实时推送事件。在另一个终端启动 OpenClaw 会话即可看到角色反应。

### 其他命令

```bash
pnpm build          # 生产构建
pnpm preview        # 预览生产构建
pnpm typecheck      # 类型检查
pnpm lint           # 代码检查
pnpm test           # 运行测试
pnpm dev:electron   # 以 Electron 桌面应用运行
pnpm build:electron:mac # 构建 macOS 发布 zip 包（本地验证）
pnpm build:electron:mac:dmg # 构建 macOS DMG 安装包
```

## 项目结构

```
watch-claw/
├── bridge/              # Bridge Server (Node.js, WebSocket 中继)
│   └── server.ts        #   监控会话 JSONL -> WS 推送
├── electron/            # Electron 桌面外壳
│   ├── main.cjs
│   └── preload.cjs
├── src/
│   ├── connection/      # 连接层
│   │   ├── bridgeClient.ts       # WebSocket 客户端，自动重连
│   │   ├── eventParser.ts        # 会话日志 -> CharacterAction（含 exec 命令分类）
│   │   ├── actionQueue.ts        # 优先级队列
│   │   ├── connectionManager.ts  # 统一调度连接
│   │   └── types.ts              # 所有共享类型
│   ├── game/            # Phaser 3 游戏引擎
│   │   ├── config.ts             # Phaser 游戏配置（512x512, Arcade Physics）
│   │   ├── scenes/
│   │   │   ├── BootScene.ts      # 资源预加载与进度条
│   │   │   ├── HouseScene.ts     # 主游戏场景（瓦片地图、角色、物理、单向平台）
│   │   │   └── UIScene.ts        # HUD 覆盖层
│   │   ├── characters/
│   │   │   └── LobsterCharacter.ts  # 玩家角色，含状态机和智能自动导航
│   │   └── systems/
│   │       ├── EventBridge.ts       # ConnectionManager -> Phaser 事件分发
│   │       ├── RoomManager.ts       # 从 Tiled 对象层检测房间
│   │       ├── EmotionSystem.ts     # 角色头顶情绪气泡精灵
│   │       ├── ParticleEffects.ts   # 彩纸、火花、睡眠 Z 字符
│   │       └── SoundManager.ts      # 基于状态的音频播放
│   ├── ui/              # React 覆盖层组件
│   │   ├── PhaserContainer.tsx     # 挂载 Phaser 游戏 + EventBridge
│   │   ├── Dashboard.tsx           # 状态面板（状态、房间、情绪、Token、日志）
│   │   └── ConnectionBadge.tsx     # 连接状态指示器
│   ├── utils/           # 共享工具（eventBus、constants、helpers）
│   ├── App.tsx
│   └── main.tsx
├── public/assets/       # 游戏资源
│   ├── house-bg.png              # 512x512 像素风小屋背景
│   ├── tilemaps/house.json       # Tiled JSON（碰撞层 + 对象层）
│   ├── tilesets/                 # 瓦片集图片
│   ├── character/lobster.png     # 角色精灵表（32x32 帧）
│   ├── ui/emotions.png           # 情绪气泡精灵表
│   ├── effects/                  # 粒子精灵（彩纸、火花、zzz）
│   └── audio/                    # 音效（脚步、打字、鼾声等）
├── docs/                # 文档（PRD、技术设计、任务分解）
└── scripts/             # 开发辅助脚本
```

## 灵感来源

| 项目                                                              | 借鉴之处                 | 差异之处                                                              |
| ----------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| [Pixel Agents](https://github.com/pablodelucca/pixel-agents)      | JSONL 文件监听、角色 FSM | Bridge Server 推送（非文件尾随）、横版平台跳跃、单角色、Electron 应用 |
| [PixelHQ ULTRA](https://github.com/RemyLoveLogicAI/pixelhq-ultra) | 事件驱动架构             | 温馨小屋（非办公室）、基于物理的移动、高保真像素风                    |

## 文档

- [产品需求文档 (PRD)](./docs/PRD.md)（[中文](./docs/PRD_CN.md)）
- [技术设计文档](./docs/TECHNICAL.md)（[中文](./docs/TECHNICAL_CN.md)）
- [任务分解](./docs/TASKS.md)（[中文](./docs/TASKS_CN.md)）
- [已归档任务 (v0.2)](./docs/TASKS_v0.2_ARCHIVED.md)（[中文](./docs/TASKS_v0.2_ARCHIVED_CN.md)）

## 贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

## 开源协议

[MIT](./LICENSE) -- Copyright 2026 luyao618

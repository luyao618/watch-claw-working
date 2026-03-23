# Watch Claw

[English](./README.md)

> 一个像素风小屋，你的 OpenClaw AI 就住在里面 -- 实时观看它写代码、思考、休息和庆祝。

> **状态**：正在积极开发中 -- 目前处于 MVP (v0.1) 规划阶段。

![Watch Claw 演示](./docs/assets/ClawHomeDemo.jpg)

**Watch Claw** 是 [OpenClaw](https://github.com/openclaw/openclaw) AI 代理工作状态的实时像素风可视化工具。它以等距视角渲染一个温馨的三层小屋剖面图，一个戴着龙虾帽的角色 -- 代表 OpenClaw 代理 -- 会根据代理的实际运行状态在房间之间移动、执行活动并表达情感。

### 目标用户

- 希望以趣味方式观察 AI 代理活动的 OpenClaw 用户
- 喜欢像素风美学和"电子宠物"风格伴侣的开发者

## 工作原理

```
OpenClaw 执行操作 --> 事件通过 WebSocket 传入 --> 角色移动到对应房间 --> 播放动画
```

Watch Claw 通过 WebSocket (`ws://127.0.0.1:18789`) 连接到 OpenClaw Gateway，解析实时代理事件（工具调用、生命周期阶段、在线状态），并将它们转化为角色行为：走到办公室写代码、坐在沙发上思考、闲置时躺在床上睡觉。

## 功能特性

### MVP (v0.1) -- 一层楼，三个房间

| 房间       | 代理活动                                 | 角色行为     | 情绪 |
| ---------- | ---------------------------------------- | ------------ | ---- |
| **办公室** | `Write`、`Edit`、`Bash`、助手文本流      | 坐在桌前打字 | 专注 |
| **客厅**   | `Read`、`Grep`、`Glob`、`WebFetch`、思考 | 坐在沙发上   | 思考 |
| **卧室**   | 空闲、等待输入、会话结束                 | 躺在床上睡觉 | 困倦 |

### 核心能力

- **实时 WebSocket 连接** -- 连接 OpenClaw Gateway，处理握手，指数退避自动重连
- **智能事件解析** -- 将代理工具调用和生命周期事件映射为角色动作，支持优先级队列
- **模拟模式** -- Gateway 不可用时，生成模拟事件用于开发和演示
- **等距 Canvas 2D 渲染** -- 像素级精确的等距视图，画家算法处理 Z 轴排序
- **角色状态机** -- MVP 5 种状态（空闲、行走、坐下、打字、睡觉），v1.0 扩展至 7 种（+ 思考、庆祝）
- **BFS 寻路** -- 基于瓦片的寻路算法，角色在房间之间自然移动
- **情绪气泡** -- 角色头顶的视觉反馈：专注、思考、困倦、开心、困惑
- **状态面板** -- 连接状态与模式（实时 / 模拟）、当前代理状态、Token 用量、会话信息、活动日志

### 完整版 (v1.0) -- 三层楼，九个房间

```
              阁楼 (3F)
    +--------+--------+--------+
    | 阅览室  |  实验室 |  阳台  |
    +--------+--------+--------+
              主楼层 (2F)
    +--------+--------+--------+
    | 办公室  |  客厅  |  卧室  |
    +--------+--------+--------+
              地下室 (1F)
    +--------+--------+--------+
    | 工具间  |  储藏室 |  厨房  |
    +--------+--------+--------+
```

v1.0 关键新增功能：

- **楼梯导航** -- 角色在楼层之间行走，带有过渡动画
- **音效** -- 脚步声、打字声、鼾声、烹饪声、通知提示音
- **Electron 桌面应用** -- 独立窗口、系统托盘、置顶选项
- **子代理可视化** -- OpenClaw 生成子代理时，出现伴随角色
- **活动历史** -- 带时间戳的近期代理活动时间线
- **自定义主题** -- 明暗模式、季节性主题
- **宠物伴侣** -- 会对代理情绪做出反应的像素小宠物

### 路线图

MVP 之后的计划功能 (P1)：

- 缩放控制（鼠标滚轮 / +/- 按钮）
- 视口平移（点击拖拽）
- 角色点击交互（详细代理信息弹窗）
- 基于时间的日夜环境光照

## 技术栈

| 层级     | 技术选型                                | 选型理由                                |
| -------- | --------------------------------------- | --------------------------------------- |
| 语言     | TypeScript 5.x（严格模式）              | 为游戏状态、事件和协议提供类型安全      |
| UI 框架  | React 18                                | 仅用于覆盖层 UI；游戏状态独立于 React   |
| 渲染     | Canvas 2D API                           | 像素级精确控制，整数缩放，打包体积小    |
| 构建工具 | Vite 6                                  | 快速 HMR，原生 TS 支持，配置简单        |
| 通信     | 原生 WebSocket                          | 直连 OpenClaw Gateway                   |
| 状态管理 | 命令式游戏状态 + React useReducer（UI） | 60fps 游戏世界更新，无 React 重渲染开销 |
| 包管理器 | pnpm                                    | 快速、节省磁盘、严格依赖解析            |
| 代码规范 | ESLint + Prettier                       | 统一代码风格，类型感知的 Lint           |
| 测试     | Vitest                                  | 快速单元测试，兼容 Vite                 |

## 架构设计

```
+----------------------------------------------------------------+
|                        Browser (Web App)                        |
|                                                                 |
|   React Shell (CanvasView + Dashboard)                          |
|       |                          |                              |
|       | ref                      | subscribe (EventBus, 4Hz)    |
|       v                          v                              |
|   Game Engine (imperative, 60fps)                               |
|   [GameLoop] -> [Renderer] [Character FSM] [Pathfinding BFS]   |
|       |                                                         |
|       v                                                         |
|   GameState (plain TS object, mutated imperatively)             |
|       ^                                                         |
|       | dispatch(action)                                        |
|   Connection Layer                                              |
|   [GatewayClient (WS)] -> [EventParser] -> [MockProvider]      |
+----------------------------------------------------------------+
                          |
                          | WebSocket
                          v
               OpenClaw Gateway
               ws://127.0.0.1:18789
```

> 架构图中组件名保留英文原名以保持代码一致性，描述性文字见下方说明。

**四层架构**：

| 层级                    | 职责                                       | 是否感知 React |
| ----------------------- | ------------------------------------------ | -------------- |
| **连接层 (Connection)** | WebSocket 生命周期、事件解析、模拟数据生成 | 否             |
| **引擎层 (Engine)**     | 游戏循环、渲染、角色 FSM、寻路、相机       | 否             |
| **世界层 (World)**      | 瓦片地图数据、房间定义、精灵数据、家具目录 | 否             |
| **UI 层**               | Canvas DOM 挂载、仪表盘覆盖层、控件        | 是             |

### 关键设计决策

1. **游戏状态独立于 React** -- 60fps 更新不会触发重渲染。React 组件通过 EventBus 订阅特定切片，限流至 4Hz。
2. **单一 Canvas，无 DOM 瓦片** -- 像素级精确的等距渲染，通过画家算法实现正确的 Z 轴排序。
3. **WebSocket 优先** -- 实时推送，结构化事件类型，无轮询延迟。

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [OpenClaw](https://github.com/openclaw/openclaw)（可选 -- 不可用时自动切换到模拟模式）

### 安装

```bash
# 克隆仓库
git clone https://github.com/luyao618/watch-claw-working.git
cd watch-claw-working

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

应用在 `http://localhost:5173` 打开。如果 OpenClaw Gateway 在 `ws://127.0.0.1:18789` 运行，将自动连接。否则，将切换到模拟模式生成模拟事件。

### 构建

```bash
# 生产构建
pnpm build

# 预览生产构建
pnpm preview

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 运行测试
pnpm test
```

## 事件映射

Watch Claw 将 OpenClaw 事件转化为角色动作：

| OpenClaw 事件          | 目标房间     | 动画 | 情绪 | 优先级 |
| ---------------------- | ------------ | ---- | ---- | ------ |
| `lifecycle.start`      | 客厅         | 起床 | 思考 | 高     |
| `lifecycle.end`        | 卧室         | 躺下 | 困倦 | 高     |
| `lifecycle.error`      | （当前房间） | 抱头 | 困惑 | 高     |
| `tool: Write/Edit`     | 办公室       | 打字 | 专注 | 中     |
| `tool: Bash`           | 办公室       | 打字 | 严肃 | 中     |
| `tool: Read/Grep/Glob` | 客厅         | 坐着 | 好奇 | 中     |
| `tool: WebFetch`       | 客厅         | 浏览 | 好奇 | 中     |
| `tool: Task`           | 客厅         | 思考 | 思考 | 中     |
| 任务完成               | 客厅         | 庆祝 | 满足 | 中     |
| 助手文本流             | 办公室       | 打字 | 专注 | 低     |
| 空闲 > 30 秒           | 卧室         | 睡觉 | 困倦 | 低     |

## 非功能性需求

| 需求           | 目标                                          |
| -------------- | --------------------------------------------- |
| 帧率           | 60fps (requestAnimationFrame)                 |
| 包体积         | < 500KB (gzip 后)                             |
| 浏览器支持     | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| 响应式         | 最小 800x600，支持 4K                         |
| 启动时间       | < 2 秒 First Meaningful Paint                 |
| WebSocket 重连 | 指数退避 (1s-30s)                             |
| 模拟模式切换   | < 100ms                                       |
| 内存占用       | < 100MB                                       |
| 无障碍         | 支持 `prefers-reduced-motion` 减少动画        |

## 灵感来源

| 项目                                                              | 借鉴之处                            | 差异之处                                            |
| ----------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| [Pixel Agents](https://github.com/pablodelucca/pixel-agents)      | JSONL 文件监听、角色 FSM、Canvas 2D | WebSocket（非文件尾随）、等距视角（非俯视）、单角色 |
| [PixelHQ ULTRA](https://github.com/RemyLoveLogicAI/pixelhq-ultra) | 事件驱动架构、个性引擎              | 温馨小屋（非办公室）、高保真像素风（非 DOM 瓦片）   |

## 文档

- [产品需求文档 (PRD)](./docs/PRD.md)
- [技术设计文档](./docs/TECHNICAL.md)
- [任务分解](./docs/TASKS.md)

## 贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

## 开源协议

本项目基于 [MIT 协议](./LICENSE) 开源。

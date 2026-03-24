# Watch Claw - 产品需求文档

> **Version**: 0.2.0
> **Author**: luyao618
> **Date**: 2026-03-23
> **Status**: In Progress

---

## 1. 概述

**Watch Claw** 是一个实时 pixel-art 可视化项目，用于展示 [OpenClaw](https://github.com/openclaw/openclaw) AI agent 的工作状态。它以 3/4 俯视角（星露谷物语风格）渲染一个温馨小屋，一个戴着龙虾帽的角色——代表 OpenClaw agent——会在各个房间之间移动、执行活动，并根据 agent 的实际运行状态表达情绪。v0.2 版本采用 Electron 桌面应用形式发布。

项目通过轻量级 Bridge Server 监控 OpenClaw 的 Session Log 文件（`~/.openclaw/agents/main/sessions/<session-id>.jsonl`），解析实时 agent 事件（tool calls、assistant 消息、session 生命周期），并通过 WebSocket（`ws://127.0.0.1:18790`）将事件推送给浏览器，转化为角色行为：走到办公室写代码、坐在沙发上思考、空闲时在床上睡觉。

### 一句话描述

> 一个 pixel-art 小屋，你的 OpenClaw AI 就住在里面——实时观看它写代码、思考、休息和庆祝。

### 目标用户

- 想要以有趣的方式可视化 AI agent 活动的 OpenClaw 用户
- 喜欢 pixel-art 美学和"电子宠物"风格陪伴的开发者

### 灵感来源

本项目的灵感来自两个现有项目：

| 项目                                                              | 我们借鉴了什么                                | 我们做了哪些不同                                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Pixel Agents](https://github.com/pablodelucca/pixel-agents)      | JSONL 文件监听、角色 FSM、Canvas 2D rendering | 我们使用 Bridge Server 推送（而非直接 file tailing）、3/4 俯视角（而非 top-down）、单角色（而非 multi-agent）、Electron 桌面应用 |
| [PixelHQ ULTRA](https://github.com/RemyLoveLogicAI/pixelhq-ultra) | Event-driven 架构、personality engine         | 我们专注于温馨小屋（而非企业办公室）、高精度 pixel art（而非 DOM tiles）、Electron 桌面应用                                      |

---

## 2. 设计参考

### 2.1 视觉风格参考

![Isometric House Reference](./assets/reference-isometric-house.png)

> **注意**：请将参考图片放在 `docs/assets/reference-isometric-house.png`。这是在 brainstorming 期间分享的 isometric pixel-art 剖面小屋图片。

参考图片是一个高精度的 isometric pixel-art 三层房屋插画，每个房间代表一个计算机系统功能（Documents、Cinema、Music 等）。其特点包括：

- **Isometric 剖面视角** —— 墙壁被"切开"以同时展示所有房间
- **温暖的木质色调** —— 舒适、有生活气息的感觉，细节丰富
- **功能隐喻** —— 每个房间映射到一个系统概念（文件存储 = 书架、回收站 = 垃圾桶等）
- **情境中的角色** —— 一个人坐在电脑桌前、宠物在客厅休息、一个机器人站在卧室
- **三个不同的楼层** 由楼梯连接：
  - **一楼（地下室）**：图书馆/工具、回收站、工具室（.bun）、密钥库（.ssh）
  - **二楼（主楼层）**：双显示器工作区、带壁炉和宠物的客厅、应用程序架、.claude 记忆室、.npm 仓库
  - **阁楼**：Documents/AIGC 项目、电影院、音乐室、MOSS（温馨机器人室）、照片画廊

### 2.2 我们如何适配这种风格

| 参考图片                                        | Watch Claw                                     |
| ----------------------------------------------- | ---------------------------------------------- |
| 计算机系统隐喻（Documents、Cinema、.ssh vault） | AI agent 活动隐喻（coding、thinking、resting） |
| 静态插画                                        | 由实时数据驱动的实时动画角色                   |
| 多个角色（人、机器人、宠物）                    | 单一主角：龙虾帽角色                           |
| 通用 pixel-art 风格                             | 相同的高精度 isometric 风格、暖色调            |
| 详细的家具和道具                                | 同等级别的细节——桌子、电脑、床、书架           |

---

## 3. 核心概念

### 3.1 龙虾帽角色

主角是一个戴着标志性**龙虾形帽子**的小 pixel 角色（引用 OpenClaw 的龙虾吉祥物）。该角色是 OpenClaw agent 的视觉化身。

- **独特身份**：龙虾帽让角色一眼就能被认出
- **情绪范围**：角色通过头顶的表情气泡显示情绪
- **活动动画**：不同活动有不同的动画（打字、阅读、睡觉、庆祝）

### 3.2 房屋 = Agent 的家

三层小屋是 agent 的个人空间。每个房间在视觉上代表一类 agent 活动：

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

### 3.3 房间驱动行为，而非反过来

关键设计原则：**agent 的活动决定角色去哪个房间**。角色不是自己选择房间——房间是 OpenClaw 当前行为的视觉结果。

---

## 4. MVP 版本（v0.1）

### 4.1 范围

MVP 聚焦于**一层楼（主楼层）的 3 个房间**，以验证核心体验循环：

```
OpenClaw 做了什么 → Bridge Server 推送事件 → 角色移动到对应房间 → 播放动画
```

### 4.2 MVP 楼层布局：主楼层（横排三房间，3/4 俯视角）

```
┌─────────────┬─────────────┬─────────────┐
│             │             │             │
│   工作室     │    书房      │    卧室     │
│  (Workshop) │   (Study)   │  (Bedroom)  │
│             │             │             │
└─────────────┴─────────────┴─────────────┘
```

| 房间                  | Agent 活动                                                 | 角色动画               | 情绪     |
| --------------------- | ---------------------------------------------------------- | ---------------------- | -------- |
| **工作室 (Workshop)** | `write`、`edit`、`exec`、assistant text streaming          | 坐在桌前，在键盘上打字 | Focused  |
| **书房 (Study)**      | `read`、`grep`、`glob`、`web_search`、思考（无 tool call） | 坐在沙发上，看着书架   | Thinking |
| **卧室 (Bedroom)**    | Idle（无活动）、等待用户输入、session 结束                 | 躺在床上，睡觉         | Sleepy   |

### 4.3 MVP 功能列表

#### 必须有（P0）

| #   | 功能                   | 描述                                                                                             |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **Bridge Server 连接** | 连接到 Bridge Server（`ws://127.0.0.1:18790`），监控最近活跃的 Session Log，自动重连             |
| 2   | **Event 解析**         | 解析 Session Log 事件（`session`、`message`、`model_change`），提取 tool calls 和 assistant 消息 |
| 3   | **Event 到行为映射**   | 将解析后的 events 映射为角色动作（去某个房间、播放动画、显示情绪）                               |
| 4   | **3/4 俯视角渲染器**   | Canvas 2D 3/4 俯视角（星露谷物语风格）sprite-based rendering，按 y 坐标排序实现正确遮挡          |
| 5   | **横排三房间布局**     | 工作室、书房、卧室横排一行                                                                       |
| 6   | **龙虾帽角色**         | 带动画的 pixel 角色，状态包括：idle、walk、sit、type、sleep                                      |
| 7   | **Pathfinding**        | 在 tile grid 上进行 BFS pathfinding，角色在房间之间平滑移动                                      |
| 8   | **情绪气泡**           | 在角色头顶显示情绪：focused、thinking、sleepy、happy、confused                                   |
| 9   | **状态面板**           | 侧边栏显示：连接状态、当前 agent 状态、token 使用量、session 信息                                |
| 10  | **Electron 桌面应用**  | 独立桌面窗口、系统托盘、置顶选项                                                                 |

#### 锦上添花（P1）

| #   | 功能         | 描述                            |
| --- | ------------ | ------------------------------- |
| 11  | 缩放控制     | 鼠标滚轮或 +/- 按钮控制视口缩放 |
| 12  | 视口平移     | 点击拖拽平移摄像机              |
| 13  | 角色点击交互 | 点击角色查看详细 agent 信息     |
| 14  | 日夜环境光照 | 根据时间变化的微妙光照效果      |

### 4.4 MVP 不包含的内容

- 二楼和三楼（阁楼、地下室）
- 楼梯间导航
- 音效 / 音乐
- 自定义布局编辑
- 多角色 / sub-agent 可视化
- 持久化设置
- Mock 模式（v0.2 起完全移除，仅支持真实 Bridge Server 数据）

---

## 5. 完整版本（v1.0）

### 5.1 三层楼完整布局

#### 阁楼（3F）

| 房间               | Agent 活动                                         | 角色动画               | 情绪      |
| ------------------ | -------------------------------------------------- | ---------------------- | --------- |
| **Reading Room**   | `read`、`grep`、`glob`（文件浏览 / 搜索）          | 坐在扶手椅上，翻阅书籍 | Curious   |
| **Lab / Workshop** | `task`（sub-agent spawning）、复杂的 multi-tool 链 | 站在白板前，画图表     | Excited   |
| **Balcony**        | 任务成功完成                                       | 坐在躺椅上，晒太阳     | Satisfied |

#### 主楼层（2F）—— 与 MVP 相同

| 房间            | Agent 活动                                   | 角色动画   | 情绪     |
| --------------- | -------------------------------------------- | ---------- | -------- |
| **Office**      | `write`、`edit`、`exec`、assistant streaming | 在桌前打字 | Focused  |
| **Living Room** | `web_search`、思考、轻度浏览                 | 坐在沙发上 | Thinking |
| **Bedroom**     | Idle、等待、session 结束                     | 在床上睡觉 | Sleepy   |

#### 地下室（1F）

| 房间             | Agent 活动                              | 角色动画                | 情绪    |
| ---------------- | --------------------------------------- | ----------------------- | ------- |
| **Tool Room**    | `exec`（系统命令、脚本）                | 在工作台上使用扳手/锤子 | Serious |
| **Storage Room** | `glob`（文件系统扫描）、大文件操作      | 整理箱子和文件柜        | Busy    |
| **Kitchen**      | Build / compile 任务、数据处理 pipeline | 在炉子上做饭，搅拌锅    | Happy   |

### 5.2 v1.0 额外功能

| #   | 功能                  | 描述                                                     |
| --- | --------------------- | -------------------------------------------------------- |
| 1   | **楼梯导航**          | 角色通过楼梯在楼层之间上下行走，带动画                   |
| 2   | **音效**              | 脚步声、打字声、打鼾声、烹饪声、通知铃声                 |
| 3   | **Electron 桌面应用** | 独立桌面窗口、系统托盘、置顶选项                         |
| 4   | **Sub-agent 可视化**  | 当 OpenClaw 产生 sub-agents 时，会出现一个更小的伙伴角色 |
| 5   | **活动历史**          | 带时间戳的近期 agent 活动时间线                          |
| 6   | **自定义主题**        | 亮色/暗色模式、季节性主题（节日装饰等）                  |
| 7   | **通知系统**          | 当 agent 完成任务或遇到错误时发送桌面通知                |
| 8   | **统计视图**          | Token 使用量图表、session 时长、tool 使用频率热力图      |
| 9   | **宠物伙伴**          | 一个小 pixel 宠物（猫/狗），会对 agent 的情绪做出反应    |

---

## 6. Agent 状态到房间/行为映射（完整版）

这是驱动整个可视化的最终映射表。

### 6.1 OpenClaw Session Log Events

| Session Log Event               | `type` 字段             | 关键字段                                     | 可用数据                          |
| ------------------------------- | ----------------------- | -------------------------------------------- | --------------------------------- |
| Session 初始化                  | `session`               | `sessionId`, `version`, `cwd`                | Session ID, 工作目录              |
| 用户消息                        | `message`               | `role: "user"`                               | 用户输入文本                      |
| Assistant 消息（含 tool calls） | `message`               | `role: "assistant"`, `content: [{toolCall}]` | Tool name、params、text、thinking |
| Tool 执行结果                   | `message`               | `role: "toolResult"`, `details`              | exitCode、durationMs、output      |
| 模型变更                        | `model_change`          | `provider`, `modelId`                        | 当前模型信息                      |
| 思考级别变更                    | `thinking_level_change` | `thinkingLevel`                              | 思考级别设置                      |
| 自定义事件（如 model-snapshot） | `custom`                | `customType`                                 | 自定义数据                        |

### 6.2 完整映射表

| OpenClaw Event                    | Tool / Phase     | 目标房间                         | 动画              | 情绪      | 优先级 |
| --------------------------------- | ---------------- | -------------------------------- | ----------------- | --------- | ------ |
| `type: "session"`（session 开始） | --               | 书房                             | 起床，走到沙发    | Thinking  | High   |
| `stopReason: "stop"`（会话结束）  | --               | 卧室                             | 走到床边，躺下    | Sleepy    | High   |
| Tool 执行失败（exitCode ≠ 0）     | --               | （当前房间）                     | 坐下，抱头        | Confused  | High   |
| `tool: write`                     | write            | 工作室                           | 在键盘上打字      | Focused   | Medium |
| `tool: edit`                      | edit             | 工作室                           | 在键盘上打字      | Focused   | Medium |
| `tool: exec`                      | exec             | 工作室 (MVP) / Tool Room (v1.0)  | 打字 / 使用工具   | Serious   | Medium |
| `tool: read`                      | read             | 书房 (MVP) / Reading Room (v1.0) | 阅读，翻页        | Curious   | Medium |
| `tool: grep`                      | grep             | 书房 (MVP) / Reading Room (v1.0) | 在书中搜索        | Curious   | Medium |
| `tool: glob`                      | glob             | 书房 (MVP) / Storage Room (v1.0) | 浏览书架          | Busy      | Medium |
| `tool: web_search`                | web_search       | 书房                             | 在平板/手机上浏览 | Curious   | Medium |
| `tool: task`                      | task (sub-agent) | 书房 (MVP) / Lab (v1.0)          | 在白板上画画      | Excited   | Medium |
| `assistant` streaming             | --               | 工作室                           | 在键盘上打字      | Focused   | Low    |
| 无事件（idle > 30s）              | --               | 卧室                             | 睡觉              | Sleepy    | Low    |
| 任务完成                          | --               | 书房 (MVP) / Balcony (v1.0)      | 庆祝，伸展        | Satisfied | Medium |

### 6.3 优先级解析

当多个事件快速连续到达时，高优先级事件优先处理。优先级分为：

- **High**：Session 生命周期事件（`type: "session"` 开始、`stopReason: "stop"` 结束、tool 执行失败）—— 覆盖一切
- **Medium**：Tool call events —— 常规活动路由
- **Low**：Assistant streaming、idle 过渡 —— 节流并降低优先级

角色会先完成当前的走路动画再响应新事件（除非 High 优先级事件到达，会立即中断）。走路期间的事件会被排队（最大队列大小：3，队列满时优先丢弃最低优先级的事件）。

---

## 7. 用户交互

### 7.1 视口控制

| 交互                  | 操作                                 |
| --------------------- | ------------------------------------ |
| 鼠标滚轮 / 捏合       | 缩放（浮点步进 ±0.25，范围 0.5x-5x） |
| 在空白区域点击 + 拖拽 | 平移摄像机                           |
| 点击角色              | 显示详细 agent 状态弹窗              |
| 点击房间              | 高亮房间并显示其活动映射             |

### 7.2 状态面板

右侧或底部的紧凑侧边栏，显示：

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

## 8. 非功能性需求

| 需求            | 目标                                                 |
| --------------- | ---------------------------------------------------- |
| **帧率**        | 60fps Canvas rendering（requestAnimationFrame）      |
| **Bundle 大小** | < 500KB gzipped（不含 sprite 资源）                  |
| **平台**        | Electron 桌面应用（macOS 优先，Windows/Linux 后续）  |
| **响应式**      | 最小视口：800x600；可缩放至 4K                       |
| **启动时间**    | < 2s 到首次有意义的渲染                              |
| **Bridge 重连** | 带指数退避的自动重连（1s、2s、4s、... 最大 30s）     |
| **内存使用**    | < 100MB 内存占用                                     |
| **无障碍**      | 减少动画支持（通过 prefers-reduced-motion 禁用动画） |

---

## 9. 未来规划（Post v1.0）

- **多 Agent 视图**：支持多个 OpenClaw agents 在同一个房屋中（室友！）
- **移动端伴侣应用**：React Native / PWA 版本
- **可分享的回放**：将 agent 活动录制并分享为动画 GIF
- **社区 sprites**：允许用户贡献家具和角色皮肤
- **与其他 AI agents 集成**：除 OpenClaw 外，支持 Claude Code、Codex CLI、Gemini CLI
- **Twitch/直播覆盖层**：兼容 OBS 的覆盖层，用于直播 coding sessions

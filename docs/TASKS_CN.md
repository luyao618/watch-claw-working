# Watch Claw - 任务分解（v1.0 Phaser 迁移）

> **Version**: 1.0.0
> **Date**: 2026-03-24
> **读者**: AI 编码 agent（vibe coding）+ 人类（美术资产）
> **历史任务**: 见 [TASKS_v0.2_ARCHIVED_CN.md](./TASKS_v0.2_ARCHIVED_CN.md)
>
> 标记 `[AI]` 的任务由 AI 编码 agent 直接执行。
> 标记 `[HUMAN]` 的任务需要人类完成（美术、音频、设计）— 附带精确规格。

---

## AI Agent 上下文

你正在开发 **Watch Claw**，一个 Phaser 3 横版像素风游戏，用于实时可视化 OpenClaw AI agent 的工作状态。游戏展示一个三层小屋，龙虾帽角色根据 agent 的活动在房间之间移动。

**你需要了解的项目结构：**
- `src/connection/` — **不要修改**。这一层处理 WebSocket 连接到 Bridge Server，产生 `CharacterAction` 对象。已完全可用。
- `src/engine/` — **迁移后删除**。旧的 Canvas 2D 渲染器。
- `src/world/` — **迁移后删除**。旧的 tilemap 和房间定义。
- `src/game/` — **你要创建的新目录**。所有 Phaser 代码放这里。
- `src/ui/` — React overlay。`Dashboard.tsx` 保留。`CanvasView.tsx` 和 `ZoomControls.tsx` 将被替换。
- `bridge/server.ts` — **不要修改**。监控 OpenClaw session 日志并通过 WebSocket 推送。
- `electron/` — **到 T4.4 之前不要修改**。

**`src/connection/types.ts` 中的关键类型（不要改）：**
```typescript
type RoomId = 'workshop' | 'study' | 'bedroom'  // T5.3 会扩展
type CharacterAction =
  | { type: 'GOTO_ROOM'; room: RoomId; animation: AnimationId; emotion: EmotionId; speed?: 'fast' | 'slow' | 'normal' }
  | { type: 'WAKE_UP' } | { type: 'GO_SLEEP' } | { type: 'CELEBRATE' } | { type: 'CONFUSED' } | { type: 'RESET' }
```

**`ConnectionManager` 提供的 API：**
```typescript
cm.onAction((action: CharacterAction) => { ... })       // 订阅角色动作
cm.onStatusChange((status: ConnectionStatus) => { ... }) // 'live' | 'connecting' | 'disconnected'
cm.onEventLog((event: SessionLogEvent) => { ... })       // 原始事件用于活动日志
cm.session  // { model, provider, sessionId, totalTokens, totalCost }
```

---

## 阶段总结

| 阶段 | 名称             | AI 任务 | 人工任务 | 范围                                |
| ---- | ---------------- | ------- | -------- | ----------------------------------- |
| P0   | Phaser 初始化    | 3       | 0        | 安装 Phaser、游戏配置、React 挂载   |
| P1   | Tilemap 与世界   | 3       | 1        | Tiled 导入、碰撞、房间检测          |
| P2   | 角色与物理       | 3       | 1        | Sprite、FSM、物理、自动导航         |
| P3   | 事件桥接与集成   | 3       | 1        | 连接层对接、情绪系统、粒子效果      |
| P4   | UI 与打磨        | 3       | 1        | Dashboard、缩放、音效、Electron     |
| P5   | 三层楼扩展       | 3       | 1        | 9 房间、梯子、完整映射、相机打磨    |

---

## Phase 0–4: AI 任务

> 详细的 AI 任务指令（含完整代码模板和步骤）请参见英文版 [TASKS.md](./TASKS.md)。
> 中文版聚焦于 **人工任务的详细规格说明**。

AI 任务概要：
- **T0.1–T0.3**: 安装 Phaser、创建 PhaserContainer React 组件、BootScene 加载进度条
- **T1.2–T1.4**: 加载 Tilemap、碰撞层物理、RoomManager
- **T2.2–T2.4**: 角色 Sprite 物理、FSM 状态机、自动导航、占位家具
- **T3.1–T3.3**: EventBridge 连接、EmotionSystem、粒子效果
- **T4.1–T4.2, T4.4**: Dashboard 更新、像素缩放、Electron 集成

---

## 人工任务详细规格 🎨

### T1.1 [HUMAN] — 创建 Tileset 和 Tilemap

**你需要安装**：[Tiled 地图编辑器](https://www.mapeditor.org/)（免费）

#### Tileset 图片 — `public/assets/tilesets/interior.png`

| 规格 | 要求 |
|------|------|
| **Tile 尺寸** | 16×16 像素 |
| **图片格式** | PNG 带透明通道 |
| **美术风格** | 像素画，正视图/剖面图（像娃娃屋的横截面）。暖色调。参考游戏：Sheltered、Tiny Room Stories 的剖面风格 |
| **像素密度** | 1 像素 = 1 像素（无抗锯齿、无渐变、硬边缘） |
| **调色板** | 最多 32 色。暖木色地板（#8B7355, #6B5335），冷灰色墙壁（#4a4a5a） |

**需要的 Tiles**：

| 编号 | 名称 | 描述 |
|------|------|------|
| 0 | 空白 | 全透明 |
| 1 | 木地板 | 暖棕色木板，侧视图显示厚度（~2px） |
| 2 | 石地板 | 灰色石砖，用于地下室 |
| 3 | 地毯 | 柔软的蓝/红色地毯 |
| 4-6 | 内墙（顶/中/底） | 墙面线脚、可重复中段、墙裙 |
| 7 | 外墙 | 深色砖/石头，房屋外部 |
| 8-9 | 门框 | 拱形门框顶部和侧面 |
| 10 | 窗户 | 带框的玻璃窗 |
| 11-12 | 楼梯 | 左升/右升台阶 |
| 13 | 梯子 | 垂直梯子横档 |
| 14 | 栏杆 | 安全扶手 |
| 15-16 | 屋顶 | 左斜/右斜瓦片 |

#### Tilemap — `public/assets/tilemaps/house.json`

| 规格 | 要求 |
|------|------|
| **地图尺寸** | 30×30 tiles（480×480 像素） |
| **格式** | Tiled JSON 导出 |
| **朝向** | 正交（Orthogonal，标准 2D，不是等距） |

**需要的 Tile 图层**：

| 图层名 | 用途 |
|--------|------|
| `background` | 外墙、天空、房屋框架 |
| `floors` | 所有地面 |
| `walls` | 内墙、房间隔断 |
| `collision` | 不可见的实体碰撞 tiles（**运行时隐藏**），给所有实体表面标记碰撞属性 `collides: true` |
| `foreground` | 在角色前面渲染的物品 |

**需要的对象图层**：

| 图层名 | 对象类型 | 放置内容 |
|--------|----------|----------|
| `spawn_points` | 点对象 | 一个点，命名 `player_start`，放在 2F 办公区 |
| `room_zones` | 矩形对象 | 每个房间一个矩形。名称 = 房间 ID（如 `toolbox`）。自定义属性：`floor`（整数 1/2/3） |
| `activity_spots` | 点对象 | 每个房间一个活动位置。名称 = 房间 ID。属性：`anim`（字符串）、`direction`（`left`/`right`） |
| `ladders` | 矩形对象 | 可攀爬的垂直区域 |

**MVP 先做 2F 单层**：
```
2F: ┌──🔧工具──┬──🛋办公──┬──🛏卧室──┐
    │  (exec)  │  (chat)  │  (rest)  │
    └──────────┴──────────┴──────────┘
      10 tiles   10 tiles   10 tiles
```

**交付物**：`public/assets/tilesets/interior.png`、`public/assets/tilemaps/house.json`、`public/assets/tilemaps/house.tmx`

---

### T2.1 [HUMAN] — 角色 Spritesheet

#### Spritesheet — `public/assets/character/lobster.png`

| 规格 | 要求 |
|------|------|
| **帧尺寸** | 32×32 像素 |
| **图片格式** | PNG 带透明通道 |
| **美术风格** | 像素画，侧视图。Q 版/可爱比例（大头约占身高 40%）。角色戴标志性**红色龙虾帽**（OpenClaw 吉祥物） |
| **调色板** | 最多 16 色。身体：蓝色衣服 #4a7ab5。头部：暖肤色 #f0d0a0。帽子：红色 #e04040 + 深红钳子 #c03030。鞋子：深色 #333 |
| **布局** | 水平条带。每个动画一行。所有帧在一个 PNG 文件中 |

**动画**（spritesheet 中每行一个动画）：

| 行 | 动画名 | 帧数 | 帧率 | 循环 | 描述 |
|----|--------|------|------|------|------|
| 0 | `idle` | 4 帧 | 6 fps | 是 | 轻微呼吸动作。双手垂在两侧 |
| 1 | `walk` | 6 帧 | 10 fps | 是 | 走路循环。手臂摆动，腿迈步 |
| 2 | `jump` | 3 帧 | 8 fps | 否 | 蹲下 → 起跳 → 空中姿势 |
| 3 | `type` | 4 帧 | 8 fps | 是 | 坐着，手在键盘上移动 |
| 4 | `sleep` | 2 帧 | 2 fps | 是 | 躺着，轻微呼吸。眼睛闭合 |
| 5 | `think` | 4 帧 | 4 fps | 是 | 站着，手托下巴，向上看 |
| 6 | `celebrate` | 4 帧 | 8 fps | 是 | 举手跳跃，开心表情 |
| 7 | `climb` | 4 帧 | 8 fps | 是 | 梯子攀爬动作 |

**Spritesheet 总尺寸**：192×256 像素（6 帧宽 × 8 行高，每帧 32×32）

> **工具推荐**：[Aseprite](https://www.aseprite.org/)（$20）、[LibreSprite](https://libresprite.github.io/)（免费）、[Piskel](https://www.piskelapp.com/)（免费网页版）
>
> **替代方案**：在 [itch.io](https://itch.io/game-assets/free/tag-pixel-art/tag-character) 搜索免费横版角色 spritesheet，修改添加龙虾帽。搜索 "tiny character" 或 "chibi platformer" 风格。

**交付物**：`public/assets/character/lobster.png`

---

### T3.4 [HUMAN] — 情绪气泡和粒子 Sprites

#### 情绪气泡 — `public/assets/ui/emotions.png`

| 规格 | 要求 |
|------|------|
| **帧尺寸** | 16×16 像素 |
| **布局** | 水平条带，8 帧 |
| **风格** | 白色对话气泡背景 + 内部彩色图标 |

| 帧 | 情绪 | 图标 | 颜色 |
|----|------|------|------|
| 0 | focused | 灯泡 | 黄色 #FFD700 |
| 1 | thinking | 问号 | 紫色 #A855F7 |
| 2 | sleepy | 月亮+Z | 灰色 #6B7280 |
| 3 | happy | 星星闪烁 | 绿色 #22C55E |
| 4 | confused | 感叹号 | 红色 #EF4444 |
| 5 | curious | 放大镜 | 橙色 #F59E0B |
| 6 | serious | 闪电 | 深红 #DC2626 |
| 7 | satisfied | 对勾 | 青色 #10B981 |

#### 粒子 Sprites — `public/assets/effects/`

| 文件 | 尺寸 | 描述 |
|------|------|------|
| `confetti.png` | 20×4 像素（4×4 × 5 个彩色方块一排） | 红、黄、绿、蓝、粉色方块 |
| `zzz.png` | 8×8 像素 | 白色像素字母 "Z"，透明背景 |
| `spark.png` | 4×4 像素 | 亮橙/红色点 + 1px 光晕 |

**交付物**：`public/assets/ui/emotions.png`、`public/assets/effects/confetti.png`、`zzz.png`、`spark.png`

---

### T4.3 [HUMAN] — 音效

#### 音效文件 — 放在 `public/assets/audio/`

| 文件 | 格式 | 时长 | 描述 | 哪里找 |
|------|------|------|------|--------|
| `footstep.ogg` | OGG Vorbis | 0.1-0.2s | 木地板上的轻柔脚步声 | [freesound.org](https://freesound.org/search/?q=footstep+wood) |
| `typing.ogg` | OGG Vorbis | 0.3-0.5s | 机械键盘按键声（2-3 个键） | [freesound.org](https://freesound.org/search/?q=keyboard+typing+mechanical) |
| `snore.ogg` | OGG Vorbis | 1-2s | 轻柔的呼吸/打鼾声 | [freesound.org](https://freesound.org/search/?q=snore+gentle) |
| `jump.ogg` | OGG Vorbis | 0.2s | 轻柔的嗖声/跳跃声 | [freesound.org](https://freesound.org/search/?q=jump+small) |
| `celebrate.ogg` | OGG Vorbis | 0.5-1s | 短暂的开心铃声/小号 | [freesound.org](https://freesound.org/search/?q=success+chime+8bit) |
| `error.ogg` | OGG Vorbis | 0.3s | 柔和的警报嗡嗡声 | [freesound.org](https://freesound.org/search/?q=error+buzz+soft) |

> **授权**：只使用 **CC0** 或 **CC-BY** 授权的音效。OGG Vorbis 格式优先（Phaser 原生加载），MP3 也可作为 fallback。

**交付物**：6 个音频文件放在 `public/assets/audio/`

---

### T5.1 [HUMAN] — 三层楼 Tilemap 和家具美术

**扩展 Tiled 地图**到三层楼：

```
         ┌──────────────────────────────────────────────┐
  3F     │  📦 仓库(下载)  📚 书房(文档)  🌙 阳台(搜索) │
         ├────────────────────────────────────────────────┤
  2F     │  🔧 工具(执行)  🛋 办公(对话)  🛏 卧室(休息)  │
         ├────────────────────────────────────────────────┤
  1F     │  📱 地下室(应用) 💻 机房(code)  🗑 垃圾桶     │
         └──────────────────────────────────────────────┘
```

**新地图尺寸**：30×34 tiles

#### 家具 Spritesheet — `public/assets/tilesets/furniture.png`

| 规格 | 要求 |
|------|------|
| **Tile 尺寸** | 16×16 像素 |
| **风格** | 与 interior.png 相同的像素画风格。正视图剖面 |

**需要的家具 Tiles**：

| 编号 | 名称 | 用于房间 | 描述 |
|------|------|----------|------|
| 0 | 办公桌 | 办公、书房 | 带腿的木质桌面 |
| 1 | 电脑显示器 | 办公、机房 | 带蓝/绿光的屏幕 |
| 2 | 办公椅 | 办公 | 侧视图转椅 |
| 3-4 | 床（左/右） | 卧室 | 枕头+毯子 |
| 5 | 床头柜 | 卧室 | 带台灯的小桌 |
| 6-7 | 书架（满/半） | 书房 | 彩色书脊 |
| 8-9 | 沙发（左/右） | 书房 | 柔软沙发 |
| 10 | 服务器机架 | 机房 | 带闪烁 LED 的高架 |
| 11-12 | 工作台+工具墙 | 工具室 | 坚固桌子+挂墙工具 |
| 13-14 | 木箱+货架 | 仓库 | 下载/存储 |
| 15 | 垃圾桶 | 垃圾桶 | 开口的桶，有东西露出 |
| 16-17 | 栏杆+盆栽 | 阳台 | 户外元素 |
| 18-19 | 旧电脑+线缆 | 地下室 | 复古 CRT + 纠缠的线 |

**交付物**：更新的 `house.json` + `public/assets/tilesets/furniture.png`

---

## 依赖图

```
        [AI]                             [HUMAN]
T0.1 → T0.2 → T0.3
                 ↓
               T1.1 [HUMAN: tileset + tilemap]
                 ↓
         T1.2 → T1.3 → T1.4
                 ↓
               T2.1 [HUMAN: 角色 spritesheet]
                 ↓
         T2.2 → T2.3 → T2.4
                         ↓
                 T3.1 → T3.2 → T3.3
                                 ↓
                               T3.4 [HUMAN: 情绪 + 粒子 sprites]
                                 ↓
                 T4.1   T4.2
                                 ↓
                               T4.3 [HUMAN: 音效]
                                 ↓
                         T4.4
                                 ↓
                               T5.1 [HUMAN: 三层楼 tilemap + 家具]
                                 ↓
                 T5.2 → T5.3 → T5.4
```

> **注意**：AI 任务可以用程序化占位素材先行开发，无需等待人工美术。当人工交付素材后，直接替换文件即可（无需改代码）。

---

## 预估时间线

| 阶段  | AI 工作 | 人工工作 | 日历      |
| ----- | ------- | -------- | --------- |
| P0    | 1.5 天  | —        | 第 1–2 天 |
| P1    | 1.5 天  | 1–2 天（tileset + tilemap） | 第 2–4 天 |
| P2    | 2 天    | 1–2 天（角色 spritesheet） | 第 4–7 天 |
| P3    | 2 天    | 0.5 天（情绪 + 粒子 sprites） | 第 7–9 天 |
| P4    | 1.5 天  | 0.5 天（音效） | 第 9–11 天 |
| P5    | 1.5 天  | 1–2 天（三层楼 tilemap + 家具） | 第 11–13 天 |
| **合计** | **~10 天** | **~5 天** | **~2.5 周** |

> 人工美术任务可以与 AI 编码任务**并行进行**。AI 使用程序化占位素材，直到真实素材交付。

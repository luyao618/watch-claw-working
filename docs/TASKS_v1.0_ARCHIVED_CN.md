# Watch Claw - 任务分解（v1.0 — 已归档 ✅）

> **Version**: 1.1.0
> **Date**: 2026-03-25
> **状态**: ✅ 全部完成 — 于 2026-03-27 归档
> **读者**: AI 编码 agent（vibe coding）+ 人类（美术资产）
> **历史任务**: 见 [TASKS_v0.2_ARCHIVED_CN.md](./TASKS_v0.2_ARCHIVED_CN.md)
>
> **说明**：本文件已归档。v1.0 任务已全部完成。当前任务请见 [TASKS.md](./TASKS.md) / [TASKS_CN.md](./TASKS_CN.md)。
>
> 标记 `[AI]` 的任务由 AI 编码 agent 直接执行。
> 标记 `[HUMAN]` 的任务需要人类完成（美术、音频、设计）— 附带精确规格。
>
> **所有 HUMAN 任务已有占位素材**，AI 任务可以不间断推进。
> 人类完成美术后，用同名文件替换占位素材即可，无需改代码。

---

## AI Agent 上下文

你正在开发 **Watch Claw**，一个 Phaser 3 横版像素风游戏，用于实时可视化 OpenClaw AI agent 的工作状态。游戏展示一个三层小屋，龙虾帽角色根据 agent 的活动在房间之间移动。

**你需要了解的项目结构：**

- `src/connection/` — **不要修改**。这一层处理 WebSocket 连接到 Bridge Server，产生 `CharacterAction` 对象。已完全可用。
- `src/engine/` — **迁移后删除**。旧的 Canvas 2D 渲染器。
- `src/world/` — **迁移后删除**。旧的 tilemap 和房间定义。
- `src/game/` — **你要创建的新目录**。所有 Phaser 代码放这里。
- `src/ui/` — React overlay。`Dashboard.tsx` 保留。`PhaserContainer.tsx` 挂载 Phaser 游戏。
- `bridge/server.ts` — **不要修改**。监控 OpenClaw session 日志并通过 WebSocket 推送。
- `electron/` — **到 T4.4 之前不要修改**。

**`src/connection/types.ts` 中的关键类型（不要改）：**

```typescript
type RoomId = 'workshop' | 'study' | 'bedroom' // T5.3 会扩展
type CharacterAction =
  | {
      type: 'GOTO_ROOM'
      room: RoomId
      animation: AnimationId
      emotion: EmotionId
      speed?: 'fast' | 'slow' | 'normal'
    }
  | { type: 'WAKE_UP' }
  | { type: 'GO_SLEEP' }
  | { type: 'CELEBRATE' }
  | { type: 'CONFUSED' }
  | { type: 'RESET' }
```

**`ConnectionManager` 提供的 API：**

```typescript
cm.onAction((action: CharacterAction) => { ... })       // 订阅角色动作
cm.onStatusChange((status: ConnectionStatus) => { ... }) // 'live' | 'connecting' | 'disconnected'
cm.onEventLog((event: SessionLogEvent) => { ... })       // 原始事件用于活动日志
cm.session  // { model, provider, sessionId, totalTokens, totalCost }
```

---

## 当前进度

| 任务     | 状态    | 说明                                         |
| -------- | ------- | -------------------------------------------- |
| T0.1     | ✅ 完成 | 安装 Phaser 3.90.0，创建游戏配置和场景 stubs |
| T0.2     | ✅ 完成 | PhaserContainer React 组件替换 CanvasView    |
| T0.3     | ✅ 完成 | BootScene 加载进度条和程序化占位纹理         |
| 占位素材 | ✅ 就位 | 所有 HUMAN 任务的占位文件已放在正确路径      |

---

## 阶段总结

| 阶段 | 名称           | AI 任务 | 人工任务 | 范围                              |
| ---- | -------------- | ------- | -------- | --------------------------------- |
| P0   | Phaser 初始化  | 3       | 0        | 安装 Phaser、游戏配置、React 挂载 |
| P1   | Tilemap 与世界 | 3       | 1        | Tiled 导入、碰撞、房间检测        |
| P2   | 角色与物理     | 3       | 1        | Sprite、FSM、物理、自动导航       |
| P3   | 事件桥接与集成 | 3       | 1        | 连接层对接、情绪系统、粒子效果    |
| P4   | UI 与打磨      | 3       | 1        | Dashboard、缩放、音效、Electron   |
| P5   | 三层楼扩展     | 3       | 1        | 9 房间、梯子、完整映射、相机打磨  |

---

## Phase 0–4: AI 任务

> 详细的 AI 任务指令（含完整代码模板和步骤）请参见英文版 [TASKS.md](./TASKS.md)。
> 中文版聚焦于 **人工任务的详细规格说明**。

AI 任务概要：

- **T0.1–T0.3**: ✅ 已完成。安装 Phaser、PhaserContainer、BootScene 加载进度条
- **T1.2–T1.4**: 加载 Tilemap、碰撞层物理、RoomManager
- **T2.2–T2.4**: 角色 Sprite 物理、FSM 状态机、自动导航、占位家具
- **T3.1–T3.3**: EventBridge 连接、EmotionSystem、粒子效果
- **T4.1–T4.2, T4.4**: Dashboard 更新、像素缩放、Electron 集成

---

## 人工任务详细规格

> **所有人工任务已有占位素材**。你可以随时按自己节奏制作美术，做完后用同名文件替换即可。
> 占位素材由 `scripts/generate-placeholder-assets.cjs` 生成，或从 OpenGameArt 下载（见 `public/assets/CREDITS.md`）。

---

### T1.1 [HUMAN] — 创建 Tileset 和 Tilemap

> **当前占位状态**：
>
> - `interior.png` — ✅ 已有占位（192×128，来自 OpenGameArt "Steampunk Blocks"，CC-BY 3.0）
> - `house.json` — ✅ 已有占位（30×34，三层 9 房间，程序化生成）
> - `house.tmx` — ✅ 已有占位（可用 Tiled 打开编辑）

**你需要安装**：[Tiled 地图编辑器](https://www.mapeditor.org/)（免费）

#### 需要替换的文件

##### 1. `public/assets/tilesets/interior.png`

| 规格             | 要求                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tile 尺寸**    | 16×16 像素                                                                                                                                  |
| **图片格式**     | PNG 带透明通道                                                                                                                              |
| **美术风格**     | 像素画，正视图/剖面图（像娃娃屋的横截面）。暖色调。参考游戏：Sheltered、Tiny Room Stories 的剖面风格                                        |
| **像素密度**     | 1 像素 = 1 像素（无抗锯齿、无渐变、硬边缘）                                                                                                 |
| **调色板**       | 最多 32 色。暖木色地板（#8B7355, #6B5335），冷灰色墙壁（#4a4a5a）                                                                           |
| **当前占位尺寸** | 192×128（12 列 × 8 行 = 96 tiles）— 你的新文件需要保持 **16×16 tile 尺寸**，列数和行数可以不同，但需要相应更新 house.json 中的 tileset 引用 |

**需要的 Tiles**（最少 17 个）：

| 编号  | 名称             | 描述                               |
| ----- | ---------------- | ---------------------------------- |
| 0     | 空白             | 全透明                             |
| 1     | 木地板           | 暖棕色木板，侧视图显示厚度（~2px） |
| 2     | 石地板           | 灰色石砖，用于地下室               |
| 3     | 地毯             | 柔软的蓝/红色地毯                  |
| 4-6   | 内墙（顶/中/底） | 墙面线脚、可重复中段、墙裙         |
| 7     | 外墙             | 深色砖/石头，房屋外部              |
| 8-9   | 门框             | 拱形门框顶部和侧面                 |
| 10    | 窗户             | 带框的玻璃窗                       |
| 11-12 | 楼梯             | 左升/右升台阶                      |
| 13    | 梯子             | 垂直梯子横档                       |
| 14    | 栏杆             | 安全扶手                           |
| 15-16 | 屋顶             | 左斜/右斜瓦片                      |

##### 2. `public/assets/tilemaps/house.json` + `public/assets/tilemaps/house.tmx`

| 规格         | 要求                                                     |
| ------------ | -------------------------------------------------------- |
| **地图尺寸** | 30×34 tiles（480×544 像素）                              |
| **格式**     | Tiled JSON 导出（house.json）+ Tiled 源文件（house.tmx） |
| **朝向**     | 正交（Orthogonal，标准 2D，不是等距）                    |

**三层楼布局**：

```
         ┌──────────────────────────────────────────────┐
  3F     │  📦 仓库(下载)  📚 书房(文档)  🌙 阳台(搜索) │
  阁楼   │   warehouse      study          balcony      │
         ├────────────────────────────────────────────────┤
  2F     │  🔧 工具(执行)  🛋 办公(对话)  🛏 卧室(休息)  │
  主楼层 │   toolbox        office         bedroom       │
         ├────────────────────────────────────────────────┤
  1F     │  📱 地下室(应用) 💻 机房(code)  🗑 垃圾桶     │
  底层   │   basement       server_room    trash         │
         └──────────────────────────────────────────────┘
              ^ 梯子连接各楼层（col 5 附近）^
```

**需要的 Tile 图层**（5 个）：

| 图层名       | 用途                                        |
| ------------ | ------------------------------------------- |
| `background` | 外墙、天空、房屋框架                        |
| `floors`     | 所有地面（每层楼底部）                      |
| `walls`      | 内墙、房间隔断（col 10 和 col 20 处有门洞） |
| `collision`  | 不可见的实体碰撞 tiles（**运行时隐藏**）    |
| `foreground` | 在角色前面渲染的物品                        |

**需要的对象图层**（4 个）：

| 图层名           | 对象类型 | 放置内容                                                                                                      |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `spawn_points`   | 点对象   | 一个点，命名 `player_start`，放在 2F 办公区（地板上方一行）                                                   |
| `room_zones`     | 矩形对象 | 9 个房间各一个矩形。名称 = 房间 ID（如 `toolbox`）。自定义属性：`floor`（整数 1/2/3）                         |
| `activity_spots` | 点对象   | 9 个房间各一个活动位置（地板上方一行）。名称 = 房间 ID。属性：`anim`（字符串）、`direction`（`left`/`right`） |
| `ladders`        | 矩形对象 | 2 个梯子区域：1F↔2F 和 2F↔3F，高度需覆盖两个楼层的可走区域                                                    |

**替换步骤**：

1. 用 Tiled 打开 `public/assets/tilemaps/house.tmx`（当前占位文件）
2. 替换 tileset 图片为你的自定义 `interior.png`
3. 重新绘制地图（或在现有基础上美化）
4. 导出为 JSON：文件 → 导出为 → `house.json`
5. 保存 TMX：文件 → 保存

---

### T2.1 [HUMAN] — 角色 Spritesheet

> **当前占位状态**：
>
> - `lobster.png` — ✅ 已有占位（192×256，来自 OpenGameArt "Super Sprite Boy"，CC0）
> - 占位角色是一个通用像素小人，不是龙虾帽角色

#### 需要替换的文件

##### `public/assets/character/lobster.png`

| 规格         | 要求                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **帧尺寸**   | 32×32 像素                                                                                                       |
| **总尺寸**   | **192×256 像素**（6 帧宽 × 8 行高）                                                                              |
| **图片格式** | PNG 带透明通道                                                                                                   |
| **美术风格** | 像素画，侧视图。Q 版/可爱比例（大头约占身高 40%）。角色戴标志性**红色龙虾帽**（OpenClaw 吉祥物）                 |
| **调色板**   | 最多 16 色。身体：蓝色衣服 #4a7ab5。头部：暖肤色 #f0d0a0。帽子：红色 #e04040 + 深红钳子 #c03030。鞋子：深色 #333 |
| **布局**     | 水平条带。每个动画一行。所有帧在一个 PNG 文件中                                                                  |

**动画**（spritesheet 中每行一个动画）：

| 行  | 动画名      | 帧数 | 帧率   | 循环 | 描述                       |
| --- | ----------- | ---- | ------ | ---- | -------------------------- |
| 0   | `idle`      | 4 帧 | 6 fps  | 是   | 轻微呼吸动作。双手垂在两侧 |
| 1   | `walk`      | 6 帧 | 10 fps | 是   | 走路循环。手臂摆动，腿迈步 |
| 2   | `jump`      | 3 帧 | 8 fps  | 否   | 蹲下 → 起跳 → 空中姿势     |
| 3   | `type`      | 4 帧 | 8 fps  | 是   | 坐着，手在键盘上移动       |
| 4   | `sleep`     | 2 帧 | 2 fps  | 是   | 躺着，轻微呼吸。眼睛闭合   |
| 5   | `think`     | 4 帧 | 4 fps  | 是   | 站着，手托下巴，向上看     |
| 6   | `celebrate` | 4 帧 | 8 fps  | 是   | 举手跳跃，开心表情         |
| 7   | `climb`     | 4 帧 | 8 fps  | 是   | 梯子攀爬动作               |

> **工具推荐**：[Aseprite](https://www.aseprite.org/)（$20）、[LibreSprite](https://libresprite.github.io/)（免费）、[Piskel](https://www.piskelapp.com/)（免费网页版）
>
> **替代方案**：在 [itch.io](https://itch.io/game-assets/free/tag-pixel-art/tag-character) 搜索免费横版角色 spritesheet，修改添加龙虾帽。搜索 "tiny character" 或 "chibi platformer" 风格。

**替换步骤**：直接用新的 `lobster.png` 覆盖 `public/assets/character/lobster.png`，确保尺寸为 **192×256**。

---

### T3.4 [HUMAN] — 情绪气泡和粒子 Sprites

> **当前占位状态**：
>
> - `emotions.png` — ✅ 已有占位（128×16，程序化生成的彩色矩形图标）
> - `confetti.png` — ✅ 已有占位（20×4，5 个彩色方块）
> - `zzz.png` — ✅ 已有占位（8×8，白色像素 Z）
> - `spark.png` — ✅ 已有占位（4×4，橙色光点）

#### 需要替换的文件

##### 1. `public/assets/ui/emotions.png`

| 规格       | 要求                            |
| ---------- | ------------------------------- |
| **总尺寸** | **128×16 像素**（8 帧 × 16×16） |
| **帧尺寸** | 16×16 像素                      |
| **布局**   | 水平条带，8 帧                  |
| **风格**   | 白色对话气泡背景 + 内部彩色图标 |

| 帧  | 情绪      | 图标     | 颜色         |
| --- | --------- | -------- | ------------ |
| 0   | focused   | 灯泡     | 黄色 #FFD700 |
| 1   | thinking  | 问号     | 紫色 #A855F7 |
| 2   | sleepy    | 月亮+Z   | 灰色 #6B7280 |
| 3   | happy     | 星星闪烁 | 绿色 #22C55E |
| 4   | confused  | 感叹号   | 红色 #EF4444 |
| 5   | curious   | 放大镜   | 橙色 #F59E0B |
| 6   | serious   | 闪电     | 深红 #DC2626 |
| 7   | satisfied | 对勾     | 青色 #10B981 |

##### 2. 粒子 Sprites — `public/assets/effects/`

| 文件           | 尺寸          | 描述                                        |
| -------------- | ------------- | ------------------------------------------- |
| `confetti.png` | **20×4** 像素 | 5 个 4×4 彩色方块一排（红、黄、绿、蓝、粉） |
| `zzz.png`      | **8×8** 像素  | 白色像素字母 "Z"，透明背景                  |
| `spark.png`    | **4×4** 像素  | 亮橙/红色点 + 1px 光晕                      |

**替换步骤**：直接用新文件覆盖 `public/assets/ui/emotions.png` 和 `public/assets/effects/` 下的三个文件，**保持文件名和尺寸不变**。

---

### T4.3 [HUMAN] — 音效

> **当前占位状态**：
>
> - 6 个 `.ogg` 文件 — ✅ 已有占位（ffmpeg 生成的合成正弦波音效）
> - 占位音效是简单的电子音，需要替换为更真实的音效

#### 需要替换的文件

放在 `public/assets/audio/` 目录下：

| 文件            | 格式 | 时长     | 描述                       | 哪里找                                                                      |
| --------------- | ---- | -------- | -------------------------- | --------------------------------------------------------------------------- |
| `footstep.ogg`  | OGG  | 0.1-0.2s | 木地板上的轻柔脚步声       | [freesound.org](https://freesound.org/search/?q=footstep+wood)              |
| `typing.ogg`    | OGG  | 0.3-0.5s | 机械键盘按键声（2-3 个键） | [freesound.org](https://freesound.org/search/?q=keyboard+typing+mechanical) |
| `snore.ogg`     | OGG  | 1-2s     | 轻柔的呼吸/打鼾声          | [freesound.org](https://freesound.org/search/?q=snore+gentle)               |
| `jump.ogg`      | OGG  | 0.2s     | 轻柔的嗖声/跳跃声          | [freesound.org](https://freesound.org/search/?q=jump+small)                 |
| `celebrate.ogg` | OGG  | 0.5-1s   | 短暂的开心铃声/小号        | [freesound.org](https://freesound.org/search/?q=success+chime+8bit)         |
| `error.ogg`     | OGG  | 0.3s     | 柔和的警报嗡嗡声           | [freesound.org](https://freesound.org/search/?q=error+buzz+soft)            |

> **授权**：只使用 **CC0** 或 **CC-BY** 授权的音效。OGG Vorbis 格式优先（Phaser 原生加载），MP3 也可作为 fallback。
> 如果使用 CC-BY 素材，请更新 `public/assets/CREDITS.md`。

**替换步骤**：直接用新的 `.ogg` 文件覆盖 `public/assets/audio/` 下的同名文件。

---

### T5.1 [HUMAN] — 三层楼 Tilemap 和家具美术

> **当前占位状态**：
>
> - `furniture.png` — ✅ 已有占位（320×16，20 个彩色矩形 tiles，程序化生成）
> - `house.json` 和 `house.tmx` — ✅ 已包含三层楼 9 房间布局（在 T1.1 占位中已完成）

#### 需要替换的文件

##### 1. `public/assets/tilesets/furniture.png`

| 规格          | 要求                                          |
| ------------- | --------------------------------------------- |
| **总尺寸**    | **320×16 像素**（20 个 16×16 tiles 水平排列） |
| **Tile 尺寸** | 16×16 像素                                    |
| **风格**      | 与 interior.png 相同的像素画风格。正视图剖面  |

**需要的家具 Tiles**（20 个）：

| 编号  | 名称          | 用于房间   | 描述                 |
| ----- | ------------- | ---------- | -------------------- |
| 0     | 办公桌        | 办公、书房 | 带腿的木质桌面       |
| 1     | 电脑显示器    | 办公、机房 | 带蓝/绿光的屏幕      |
| 2     | 办公椅        | 办公       | 侧视图转椅           |
| 3-4   | 床（左/右）   | 卧室       | 枕头+毯子            |
| 5     | 床头柜        | 卧室       | 带台灯的小桌         |
| 6-7   | 书架（满/半） | 书房       | 彩色书脊             |
| 8-9   | 沙发（左/右） | 书房       | 柔软沙发             |
| 10    | 服务器机架    | 机房       | 带闪烁 LED 的高架    |
| 11-12 | 工作台+工具墙 | 工具室     | 坚固桌子+挂墙工具    |
| 13-14 | 木箱+货架     | 仓库       | 下载/存储            |
| 15    | 垃圾桶        | 垃圾桶     | 开口的桶，有东西露出 |
| 16-17 | 栏杆+盆栽     | 阳台       | 户外元素             |
| 18-19 | 旧电脑+线缆   | 地下室     | 复古 CRT + 纠缠的线  |

##### 2. 更新 `house.json` 和 `house.tmx`

如果你替换了 `interior.png` 和 `furniture.png`，需要用 Tiled 重新编辑地图：

1. 打开 `public/assets/tilemaps/house.tmx`
2. 替换 tileset 图片引用
3. 用新的家具 tiles 装饰 9 个房间
4. 导出 JSON：文件 → 导出为 → `house.json`

**替换步骤**：

- 直接用新的 `furniture.png` 覆盖 `public/assets/tilesets/furniture.png`，保持 **320×16** 尺寸
- 如需修改地图布局，用 Tiled 编辑 `house.tmx` 后重新导出 `house.json`

---

## 替换文件速查表

| 任务 | 文件路径                               | 尺寸要求                             | 当前占位来源          |
| ---- | -------------------------------------- | ------------------------------------ | --------------------- |
| T1.1 | `public/assets/tilesets/interior.png`  | 16×16 tiles（当前 192×128）          | OpenGameArt CC-BY 3.0 |
| T1.1 | `public/assets/tilemaps/house.json`    | 30×34 Tiled JSON                     | 程序化生成            |
| T1.1 | `public/assets/tilemaps/house.tmx`     | Tiled 源文件                         | 程序化生成            |
| T2.1 | `public/assets/character/lobster.png`  | **192×256**（32×32 帧，6 列 × 8 行） | OpenGameArt CC0       |
| T3.4 | `public/assets/ui/emotions.png`        | **128×16**（16×16 帧，8 列）         | ImageMagick 生成      |
| T3.4 | `public/assets/effects/confetti.png`   | **20×4**                             | ImageMagick 生成      |
| T3.4 | `public/assets/effects/zzz.png`        | **8×8**                              | ImageMagick 生成      |
| T3.4 | `public/assets/effects/spark.png`      | **4×4**                              | ImageMagick 生成      |
| T4.3 | `public/assets/audio/footstep.ogg`     | OGG, 0.1-0.2s                        | ffmpeg 生成           |
| T4.3 | `public/assets/audio/typing.ogg`       | OGG, 0.3-0.5s                        | ffmpeg 生成           |
| T4.3 | `public/assets/audio/snore.ogg`        | OGG, 1-2s                            | ffmpeg 生成           |
| T4.3 | `public/assets/audio/jump.ogg`         | OGG, 0.2s                            | ffmpeg 生成           |
| T4.3 | `public/assets/audio/celebrate.ogg`    | OGG, 0.5-1s                          | ffmpeg 生成           |
| T4.3 | `public/assets/audio/error.ogg`        | OGG, 0.3s                            | ffmpeg 生成           |
| T5.1 | `public/assets/tilesets/furniture.png` | **320×16**（16×16 tiles，20 列）     | ImageMagick 生成      |

> **注意**：如果使用 CC-BY 授权的素材，请更新 `public/assets/CREDITS.md`。

---

## 依赖图

```
        [AI]                             [HUMAN]

T0.1 ✅ → T0.2 ✅ → T0.3 ✅
                       ↓
  占位素材已就位 ─→  T1.2 → T1.3 → T1.4      T1.1 慢慢做，做完替换 interior.png + house.json/tmx
                               ↓
                       T2.2 → T2.3 → T2.4      T2.1 慢慢做，做完替换 lobster.png
                               ↓
                       T3.1 → T3.2 → T3.3      T3.4 慢慢做，做完替换 emotions.png + 粒子
                               ↓
                       T4.1   T4.2   T4.4      T4.3 慢慢做，做完替换 audio/*.ogg
                               ↓
                       T5.2 → T5.3 → T5.4      T5.1 慢慢做，做完替换 furniture.png + house.json
```

> **AI 任务不再阻塞**：所有占位素材已就位，AI 可以不间断完成 T1.2 → T5.4。
> 人类按自己节奏制作美术，做完一个替换一个，即时生效（无需改代码）。

---

## 预估时间线

| 阶段     | AI 工作    | 人工工作                      | 日历      |
| -------- | ---------- | ----------------------------- | --------- |
| P0       | ✅ 完成    | —                             | —         |
| P1       | 1.5 天     | 随时（tileset + tilemap）     | —         |
| P2       | 2 天       | 随时（角色 spritesheet）      | —         |
| P3       | 2 天       | 随时（情绪 + 粒子 sprites）   | —         |
| P4       | 1.5 天     | 随时（音效）                  | —         |
| P5       | 1.5 天     | 随时（三层楼 tilemap + 家具） | —         |
| **合计** | **~10 天** | **随时并行**                  | **~2 周** |

> 人工美术任务可以与 AI 编码任务**完全并行**。AI 使用占位素材开发，人类随时替换为真实美术。

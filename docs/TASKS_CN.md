# Watch Claw - 任务分解

> **Version**: 2.0.0
> **Date**: 2026-03-27
> **读者**: AI 编码 agent（vibe coding）+ 人类（美术资产）
> **历史任务**: 见 [TASKS_v1.0_ARCHIVED_CN.md](./TASKS_v1.0_ARCHIVED_CN.md) 和 [TASKS_v0.2_ARCHIVED_CN.md](./TASKS_v0.2_ARCHIVED_CN.md)

---

## 归档历史

| 版本 | 状态      | 归档日期   | 文件                                                     |
| ---- | --------- | ---------- | -------------------------------------------------------- |
| v0.2 | ✅ 已完成 | 2026-03-24 | [TASKS_v0.2_ARCHIVED_CN.md](./TASKS_v0.2_ARCHIVED_CN.md) |
| v1.0 | ✅ 已完成 | 2026-03-27 | [TASKS_v1.0_ARCHIVED_CN.md](./TASKS_v1.0_ARCHIVED_CN.md) |

---

## v1.0 总结（已完成）

v1.0 里程碑完成了从原始 Canvas 2D 渲染器到 **Phaser 3 的迁移**，包括：

- **Phaser 3 Arcade Physics** -- 重力、楼层间跳跃、单向平台穿越
- **像素风横版小屋** -- 三层楼、九房间的瓦片地图及碰撞层
- **角色状态机** -- idle、walk、jump、type、think、sleep、celebrate、climb 状态
- **智能自动导航** -- 通过梯子/通道跨楼层寻路
- **情绪系统** -- 带上下文图标的语音气泡
- **粒子效果** -- 庆祝彩纸、错误火花、睡眠浮动 Z
- **音效** -- 脚步声、打字声、鼾声、跳跃声、庆祝声、错误提示音
- **事件桥接** -- ConnectionManager 集成，实时可视化 OpenClaw 活动
- **状态面板** -- 连接状态、角色状态、会话信息、Token 使用量、活动日志
- **Electron 桌面应用** -- 独立打包，Bridge Server 自动启动

---

## v2.0 初步想法

> ⚠️ **以下内容仅为初步想法，非实施方案。具体需求、优先级和技术方案均需进一步讨论。**

### 想法 1：移动端 App

- 将 Watch Claw 做成移动端应用（iOS / Android）
- 通过局域网 WebSocket 连接到运行 OpenClaw 的电脑上的 Bridge Server
- 手机端实时展示龙虾角色的活动状态
- 需要考虑：跨平台框架选型（React Native / Flutter / PWA）、Bridge Server 局域网发现机制、移动端 Phaser 性能适配

### 想法 2：桌宠模式

- 常驻系统托盘，后台静默运行
- 有 agent 事件时弹出小窗口，显示龙虾角色的实时反应
- 无事件时自动收回，不打扰用户
- 需要考虑：Electron tray API、弹窗动画和尺寸、事件过滤（避免频繁弹窗）、跨平台托盘支持

### 想法 3：游戏模式

- 平台跳跃解压小游戏
- 用户可手动操控龙虾角色在小屋内跑跳
- 可在 agent 空闲时自动切换到游戏模式，或手动按键进入
- 需要考虑：游戏模式与观察模式的切换逻辑、关卡/玩法设计、是否加入得分/成就系统

### 想法 4：一键杀龙虾

- 在 Watch Claw 界面提供按钮或快捷键
- 一键终止正在运行的 OpenClaw agent 进程（kill session）
- 龙虾角色播放对应的终止动画效果
- 需要考虑：Bridge Server 需新增终止 agent 的 API、安全确认弹窗防误触、进程终止方式（SIGTERM vs SIGKILL）

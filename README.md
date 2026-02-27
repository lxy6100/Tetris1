# Tetris Vanilla（原生 HTML/CSS/JS）

一个无需构建工具、可直接部署到 GitHub Pages 的俄罗斯方块小游戏。

## 运行方式

### 本地运行
```bash
python -m http.server 8000
```
浏览器打开：http://localhost:8000

### GitHub Pages 部署
1. 推送仓库到 GitHub。
2. 打开 `Settings -> Pages`。
3. `Build and deployment` 选择 `Deploy from a branch`。
4. 选择 `main` + `/ (root)`（或放到 `docs/` 目录）。
5. 保存后等待部署完成。

## 项目结构

- `index.html`：页面结构、设置弹窗、移动端按钮
- `styles.css`：主题、响应式布局
- `main.js`：游戏核心逻辑（状态机、渲染、输入、规则、计分、调试工具）
- `assets/`：可选资源目录

## 清行修复说明（本次重点）

### 1) 清行算法
- 采用 **过滤重建（filter + 顶部补空行）**，避免边遍历边 `splice` 的跳行/错位风险。
- 流程：
  1. 锁定方块（merge 到 `board[y][x]`）
  2. 用合并后的 board 检测 `fullRows`
  3. 进入 `CLEARING` 动画状态
  4. 动画结束后原子执行 `removeRowsFilterRebuild`
  5. 结算分数/连击/等级并生成下一块
- board 坐标统一约定：`board[y][x]`，`y=0` 在顶部，渲染同方向。

### 2) CLEARING 状态机
- 状态：`PLAYING | PAUSED | CLEARING | GAMEOVER`
- `CLEARING` 期间：
  - 禁止移动/旋转/hold/硬降
  - 禁止重入 lock/clear
  - 禁止下落 tick
- 动画结束后才执行真实删行与下落，杜绝误消/漏消/行错位。

### 3) 隐藏行策略
- 满行检测从 `hiddenRows` 开始，即只对可见区（及其下方）判定满行。
- 保持隐藏缓冲行行为稳定，不引入顶部误判。

## 计分与最高分

- 实时显示 `score` 与 `highScore`。
- 基础消行分：1/2/3/4 行 = `100/300/500/800 * level`
- 软降每格 +1，硬降每格 +2。
- 保留 Combo/B2B/T-Spin(简化)/Perfect Clear 奖励。
- 最高分按模式 localStorage 存储：`tetris_highScore_<mode>`。
- 设置面板支持“清空当前模式最高分”。

## 可复现调试（Deterministic + Replay）

- 设置面板支持固定随机种子 `debugSeed`（保存到 localStorage）。
- 使用同一 seed，可稳定复现 bag 顺序。
- 支持 replay 导出/导入：
  - 导出内容：`seed + mode + 输入事件序列(相对时间戳)`
  - 导入后自动按时间重放，复现问题。

## 可观测调试（Debug Overlay）

- 开启“显示调试面板”后可见：
  - board 维度（可见 + 隐藏行）
  - 当前 piece 坐标/旋转
  - dropAcc / lockAcc
  - 当前 phase（PLAYING/PAUSED/CLEARING/GAMEOVER）
  - 最近检测到的 fullRows 索引
  - seed / replay 事件数
- 提供调试按钮：
  - **单步执行 Step**（暂停状态下推进 1 帧）
  - **运行清行自检**

## 控制台调试 API

可在浏览器 Console 直接调用：

- `window.__dumpBoard()`：打印当前棋盘字符矩阵
- `window.__setBoard(matrix)`：注入指定盘面（二维数组，shape 必须匹配当前 board）
- `window.runLineClearSelfTests()`：运行清行自检

## 自检说明

`runLineClearSelfTests()` 包含：
- 同时 2 行相邻满
- 同时 3 行相邻满
- 同时 4 行相邻满
- 同时 2 行不相邻满
- 隐藏行满（默认策略下按忽略处理）

并断言：
- cleared 行数正确
- board 高度不变
- 方块总量守恒（只减少被清除行上的方块）

失败会 `console.error` 打印 before/after 矩阵用于定位。

## 快捷键

- `← / →`：左右移动
- `↓`：软降
- `Space`：硬降
- `X / ↑`：顺时针旋转
- `Z`：逆时针旋转
- `C`：Hold
- `P`：暂停/继续
- `R`：重开
- `Esc`：打开/关闭设置

## 移动端

底部触控按钮：左右/软降/双旋转/硬降/Hold/暂停。
响应式布局下按钮不遮挡主棋盘。

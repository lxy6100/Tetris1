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

- `index.html`：页面结构、侧栏、设置弹窗、移动端按钮
- `styles.css`：主题、响应式布局、弹窗、触控样式
- `main.js`：游戏主逻辑（状态管理、渲染、输入、规则、计分、模式、存档、音效）
- `assets/`：可选资源目录（当前使用 WebAudio 实时生成音效）

## 玩法简介

- 核心规则为经典 Tetris：方块下落、旋转、落地锁定、消行、升级、加速。
- 支持 7-bag 随机系统（每袋 7 种方块各一次，打乱后抽取）。
- 支持 Next（显示后续 5 个）、Hold（暂存）、Ghost（落点预览）。

## 快捷键（桌面）

- `← / →`：左右移动
- `↓`：软降
- `Space`：硬降
- `X / ↑`：顺时针旋转
- `Z`：逆时针旋转
- `C`：Hold
- `P`：暂停
- `R`：重开
- `Esc`：打开/关闭设置

## 移动端操作

页面底部提供触控按钮：
- 左/右/下（持续按住可连续）
- 顺时针 / 逆时针旋转
- 硬降
- Hold
- 暂停

已做响应式布局，手机竖屏下可在单屏内操作，按钮不遮挡主棋盘。

## 游戏模式（>=4）

1. **Classic**：经典无限，速度随等级提升。
2. **Sprint 40**：目标消除 40 行，记录最短用时。
3. **Survival**：定时注入垃圾行，节奏更快。
4. **Challenge**：每 30 秒刷新目标连击，失败追加惩罚。
5. **Zen**：慢速无压模式。

## 参数面板（可保存到 localStorage）

### A) 棋盘与视觉
- 棋盘宽/高可调（8-16，16-30）
- 网格线、描边开关
- 阴影强度
- 主题切换（dark/light/neon）
- 色盲友好符号叠加

### B) 速度与手感
- 初始下落速度（ms）
- 升级规则（按消行/时间/分数）
- DAS / ARR
- 软降倍率
- 锁定延迟
- 踢墙模式（off/simple/srs）
- 输入缓冲时长
- 旋转重置锁定次数

### C/D/E/F/G)
- 计分系统（classic / modern）
- Ghost / Hold / 最佳落点建议 开关
- 硬降二次确认
- 难度预设（轻松/标准/硬核）
- 音量 / 静音 / 视觉反馈
- Debug 面板开关
- 导入导出 JSON（设置+记录）

## 计分与判定

- 支持经典与现代两套计分。
- 支持 Combo、Back-to-Back。
- T-Spin 使用简化判定：T 方块旋转后锁定，四角占用 >= 3。
- 支持 Perfect Clear 额外奖励。

## 存档与排行榜（本地）

- localStorage 保存：
  - 设置：`tetris_vanilla_save_v1`
  - 成绩：`tetris_vanilla_scores_v1`
- 各模式保存最佳分数；Sprint 保存最佳时间。

## 调试方式

1. 打开设置，勾选“显示调试面板”。
2. 右侧显示 FPS、当前方块、坐标、下落/锁定计时。
3. 浏览器开发者工具 Console 可查看是否有错误。

## 稳定性说明

- 使用 `requestAnimationFrame` 主循环。
- 输入处理与逻辑更新分离，避免卡键。
- 所有参数在应用前做范围校验与回退。


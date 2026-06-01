# MOBILE-001 设计修订案 — 移动端独立播放器控制（音乐播放器范式）与全站翡翠绿品牌化

本修订版设计规范了 `WatchMobileLayout` 播放器控制条的交互重构、全站强调色向官方翡翠绿（Emerald）的收拢规范，以及字幕跳转、空状态美化的具体实现参数。

---

## 1. 移动端独立播放器控制条：音乐播放器范式

移动端播放器（视口宽度 < 768px）隐藏 YouTube 原生控件（`controls=0`），完全采用自定义的底部常驻控制条。该控制条采用**音乐播放器式**的拇指操控区布局。

### 1.1 界面布局 (Bottom Custom Control Bar)

自定义控制条固定悬浮在吸顶视频区的最下方，背景采用半透明的黑色渐变遮罩以保证在亮色视频背景下的可读性。

```text
+-------------------------------------------------------------+
|                                                             |
|   [===================●--------------------------------]     |  <- 自定义进度条 (h-[5px], 拖拽 Seek)
|   01:23                                               03:45 |  <- 时间文本 (text-[10px] font-mono)
|                                                             |
|     [ 1.0x ]    [ |<< ]      (( > ))      [ >>| ]   [ 全屏 ] |  <- 拇指操作栏 (高度 h-14)
|                                                             |
+-------------------------------------------------------------+
```

### 1.2 关键组件与 Tailwind Class 规范

1. **容器背景遮罩**：
   - 类名：`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pb-3 pt-6 flex flex-col gap-2.5 transition-all duration-300`
   - 显示触发条件：`showControls || !isPlaying` 时可见（`opacity-100 translate-y-0`），正在播放且无触摸时自动隐藏（`opacity-0 translate-y-2 pointer-events-none`）。

2. **自定义进度条 (Progress Seek Slider)**：
   - 使用原生的 `<input type="range" />`，并通过 CSS 渐变绘制当前进度。
   - 类名：`w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-brand-500 focus:outline-none`
   - 动态样式：`style={{ background: 'linear-gradient(to right, #10b981 0%, #10b981 ' + percent + '%, rgba(255, 255, 255, 0.2) ' + percent + '%)' }}`
   - 强调色统一使用翡翠绿（`#10b981`），杜绝天蓝色（`sky-500`）。

3. **时间指示器**：
   - 进度条左右两侧或下方渲染 `currentTimeSec` 和 `durationSec`。
   - 类名：`text-[10px] font-bold text-white/90 font-mono select-none`

4. **主控操作栏 (Thumb Area controls)**：
   - 容器：`flex items-center justify-between h-14`
   - **倍速选择器 (`[1.0x]`)**：
     - 类名：`text-white active:text-brand-400 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all select-none border border-white/5`
     - 菜单激活：点击弹出的半透明气泡菜单中，选中速度使用 `bg-brand-500 text-white` 进行高亮。
   - **上一句跳转 (`[|<<]`)**：
     - 使用 Lucide 图标 `<SkipBack className="h-5 w-5" />`
     - 类名：`text-zinc-300 active:text-brand-400 p-2 transition-colors active:scale-90`
   - **中央播放/暂停键 (`(( > ))`)**：
     - 增大点击热区，居中摆放。
     - 类名：`h-12 w-12 flex items-center justify-center rounded-full bg-brand-500 text-white shadow-lg active:scale-95 transition-all`
     - 播放/暂停图标：统一使用 Lucide 的 `Play`（带微调 `ml-0.5` 修正视觉重心）和 `Pause`。
   - **下一句跳转 (`[>>|]`)**：
     - 使用 Lucide 图标 `<SkipForward className="h-5 w-5" />`
     - 类名：`text-zinc-300 active:text-brand-400 p-2 transition-colors active:scale-90`
   - **全屏切换**：
     - 使用 Lucide 图标 `<Maximize className="h-5 w-5" />` 或 `<Minimize className="h-5 w-5" />`
     - 类名：`text-zinc-300 active:text-brand-400 p-2 transition-colors`

---

## 2. 逐句跳转（上一句/下一句）交互逻辑

跳转逻辑依赖当前播放时间 `currentTimeSec` 与字幕 Cue 列表 `subtitleCues`（格式同 `{ start: number, dur: number, text: string }`）的比对。

### 2.1 算法边界规范

1. **上一句跳转 (handlePrevSentence)**：
   - 计算逻辑：
     - 若当前时间 `currentTimeSec` 大于当前激活 Cue 的开始时间 `start` + 2 秒，说明用户希望**重新聆听当前句**。此时将视频 seek 到当前 Cue 的 `start`。
     - 否则，寻找在当前 Cue 之前的上一个 Cue（即 `index - 1`）。将视频 seek 到该 Cue 的 `start`。
     - 若当前没有激活的 Cue，则寻找**所有在当前时间之前结束/开始的最后一个 Cue** 进行跳转。如果没有任何前置 Cue，则跳转到视频起点 `0`。

2. **下一句跳转 (handleNextSentence)**：
   - 计算逻辑：
     - 寻找在当前激活 Cue 之后的下一个 Cue（即 `index + 1`）。将视频 seek 到该 Cue 的 `start`。
     - 若当前没有激活的 Cue，则寻找**第一个在当前时间之后开始的 Cue** 进行跳转。如果没有后续 Cue，则不做任何跳转。

3. **数据接口规范**：
   - `WatchClient.tsx` 中定义 `handlePrevSentence` 和 `handleNextSentence` 回调函数。
   - `WatchMobileLayout` 通过 Props 接收这两个回调并绑定在 `SkipBack` 和 `SkipForward` 按钮上。

---

## 3. 全站强调色统一为翡翠绿（Emerald）

根据品牌规范，所有此前由 `sky-` (蓝色) 渲染的控制及激活高亮全部收拢为官方主色 `brand` (翡翠绿)。

### 3.1 查词卡 (LookupCard.tsx) 配色收拢

查词卡片（无论是移动端底部抽屉还是桌面端右侧面板）需将蓝色背景 and 字色统一改为温润的品牌绿色：
* **生词未激活/次要标签**：
  - 替换前：`bg-sky-500/10 text-sky-600 border-sky-500/20`
  - 替换后：`bg-brand-500/10 text-brand-700 dark:text-brand-400 border-brand-500/20`
* **收藏/熟词等高亮按钮**：
  - 将所有 `bg-sky-500 hover:bg-sky-600` 改为 `bg-brand-500 hover:bg-brand-600`。
  - 将所有 `text-sky-500` 改为 `text-brand-600` 或 `dark:text-brand-400`。
  - 所有带 `hover:border-sky-500` 的词条卡片改用 `hover:border-brand-500/30`。

### 3.2 播放器与控制控件配色收拢

* 移动端音量进度条和视频进度条的 `accent-sky-500` 全部替换为 `accent-brand-500`。
* 进度条背景渲染的 CSS 渐变中的蓝色值 `#0ea5e9` 统一替换为翡翠绿 `#10b981`。

---

## 4. 细节清理与美化

### 4.1 顶栏清理
* 在移动端（`< 768px`），`SiteHeader` 顶栏移除任何可能拥挤的控制元素（如 1x 速度选择、折叠设置）。这些配置一律隐藏（使用 `hidden md:flex`），确保顶栏保持极简（仅 Logo、搜索触发和侧边菜单触发）。主题切换和个人中心链接由滑出的 `MobileNav` 抽屉底层承载。

### 4.2 「无台词」空状态美化 (SubtitlePanel)
* 当视频由于各种原因没有加载到同步字幕（`hasLoadedSubtitles && subtitleCues.length === 0`）时，不再显示枯燥的 `（无台词）` 占位符。
* **美化后规范**：
  - 容器：`w-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 bg-zinc-50/50 dark:bg-zinc-900/10 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl`
  - 内部元素：放置一个 Lucide 哑光图标 `<FileText className="h-6 w-6 text-zinc-400 mb-2" />`，下方渲染中文文案：
    - 主标题：`暂无西语字幕` (类名：`text-sm font-semibold text-zinc-700 dark:text-zinc-300`)
    - 辅助提示：`此视频暂无同步字幕，您可以通过进度条自由播放与精听。` (类名：`text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-[240px]`)

---

## 5. 校验与验证方案 (QA 指南)

1. **单实例校验**：全站换色和交互重构绝对不能在 DOM 中生成第二个播放器 iframe 实例，视频在中途切换 Tab（例如从“字幕”切到“转写”）时，播放不能中断。
2. **跳转精确性**：点击上一句/下一句按钮，视频应该精准 seek 到上一句/下一句的开始时间，并且字幕高亮状态立即跟随更新。
3. **视觉抽查**：用 Chrome 开发者工具模拟移动端，确认全站无 `sky-500` 的蓝色遗留，所有进度条、激活框、查词标签呈现温润的品牌翡翠绿。

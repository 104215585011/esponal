# MOBILE-001 — watch 页 + 字幕面板 移动端独立布局重设计设计稿

本设计稿规范了 `WatchClient` 页面在移动端视口下的独立布局（WatchMobileLayout）以及字幕、转写、控制条在移动端的展示与交互规范。设计追求移动端原生 App 级体验，保持精细、高效的成人自学调性，对齐 MOBILE-000 的高品质感。

---

## 1. 整体移动端架构与布局范式

在移动端（视口宽度 < 768px），我们放弃桌面的双栏布局，采用 **视频吸顶（Sticky Player） + 下方滚动内容流（Scrollable Details）** 的单栏结构，并使用 **Sticky Tab Switcher** 切换字幕、转写及推荐视频。

### 1.1 ASCII 页面布局 (Mobile Portrait View)

```text
+---------------------------------------------+
|  [<- 视频]  Esponal Logo             (某某)  |  <- 顶栏 (SiteHeader)
+---------------------------------------------+
|                                             |
|             YouTube 视频播放器               |  <- 视频吸顶区 (sticky top-0 z-40)
|                                             |  <- 宽度 w-full, 高度 aspect-video
+---------------------------------------------+
|   字幕   |   转写   |   推荐                 |  <- 选项卡 (sticky top-[56.25vw] z-40)
+---------------------------------------------+  <- tabs 容器高度 44px
|                                             |
|  [ 视频元信息：标题、作者、刷新字幕 ]       |  <- Tab 滚动内容流起始
|                                             |
|  +---------------------------------------+  |
|  |             字幕展示区                |  |  <- 字幕 Tab (SubtitlePanel)
|  |  Queremos aprender español para...    |  |  <- 单词大字距, 触摸目标达标
|  |  我们想学习西班牙语，为了...            |  |
|  +---------------------------------------+  |
|                                             |
|  +---------------------------------------+  |
|  |             底部控制条                |  |  <- 拇指可达区 (控制面板)
|  |  显示模式: [中西] [仅西] [仅中]       |  |  <- 切换按钮触摸高度 44px
|  |  播放速度: [0.75] [0.85] [1.0] [1.25] |  |
|  +---------------------------------------+  |
|                                             |
+---------------------------------------------+
```

### 1.2 关键设计决策
1. **视频吸顶 (Sticky Video)**: 视频播放器使用 `sticky top-0 z-40 w-full aspect-video shadow-md`，使用户在向下滚动阅读转写或查看字幕选项时，视频画面始终可见。
2. **独立布局渲染**: 引入 `WatchDesktopLayout` 与 `WatchMobileLayout` 展示组件，通过 `useIsMobileViewport()` 钩子在客户端进行单分支渲染，避免 SSR 布局冲突，彻底杜绝渲染出第二个 YouTube Player 实例。
3. **安全区适配 (Safe Area)**: 底部内容流及弹出的底部查词抽屉均使用 `.pb-safe` 适配刘海屏及底部 Home Bar。

---

## 2. 界面与组件详细设计

### 2.1 WatchClient 独立分支结构 (WatchClient.tsx)

```jsx
// 骨架伪代码
export function WatchClient({ videoId, videoInfo, relatedVideos }) {
  const isMobile = useIsMobileViewport();

  if (isMobile === null) {
    return <div className="min-h-screen bg-white dark:bg-zinc-950 animate-pulse" />;
  }

  // 共享的状态和 Player 逻辑
  const sharedState = {
    currentTimeSec,
    playbackRate,
    activeLookup,
    spanishLine,
    chineseLine,
    activeCue,
    playerRef,
    // ... callbacks
  };

  return isMobile ? (
    <WatchMobileLayout {...sharedState} videoInfo={videoInfo} relatedVideos={relatedVideos} />
  ) : (
    <WatchDesktopLayout {...sharedState} videoInfo={videoInfo} relatedVideos={relatedVideos} />
  );
}
```

### 2.2 WatchMobileLayout 结构 (WatchMobileLayout.tsx)
* **容器**：`relative flex w-full flex-col bg-white dark:bg-zinc-950`。
* **吸顶视频包装器**：
  - 类名：`sticky top-0 z-40 w-full aspect-video bg-black shadow-md`。
  - 内含 YouTube `iframe` 容器以及全屏切换按钮。
* **Tab 开关控制条**：
  - 类名：`sticky top-[56.25vw] z-40 flex h-11 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm`。
  - Tab 选项按钮：`flex-1 flex items-center justify-center text-xs font-semibold h-11 cursor-pointer transition-all`。
  - 选中状态：`border-b-2 border-brand-500 text-brand-600 dark:text-brand-400`。
  - 未选中状态：`text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200`。
* **Tab 内容流区**：
  - 类名：`flex-1 min-w-0 w-full overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]`。

### 2.3 SubtitlePanel 移动端重设 (SubtitlePanel.tsx)
在移动端 Tab 中，SubtitlePanel 不再使用 `isOverlay` 浮层模式，而是直接融于页面白底/黑底内容流中：
* **字幕卡片背景**：
  - 类名：`w-full bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl p-5 shadow-sm min-h-[140px] flex items-center justify-center text-center`。
* **西语单词 Span 点击优化**：
  - 西语单句大小：`text-lg font-semibold leading-relaxed tracking-wide text-zinc-900 dark:text-zinc-100`。
  - 单词点击：`cursor-pointer rounded px-0.5 transition hover:bg-zinc-200 dark:hover:bg-zinc-800/80`，激活词高亮为 `bg-brand-500/20 text-brand-600 dark:text-brand-300 font-bold`。
  - 单词点击热区（Touch Target）：利用 margin 和 inline-block 确保物理点击区域大小。
* **翻译显示**：
  - 类名：`mt-2.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium`。
* **底部控制区 (Thumb Zone Controls)**：
  - 将字幕设置（显示模式、速度、刷新）提取为一个扁平化的底层控制面板，排列在字幕卡片下方。
  - **显示模式切换**：使用胶囊式 Segment Control `flex bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-full`。选项（中西、仅西、仅中）使用 `flex-1 py-1.5 text-[11px] font-bold rounded-full`。
  - **播放速度切换**：`grid grid-cols-4 gap-1 mt-3 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-full`。速度选项使用 `text-center py-1.5 text-[11px] font-bold rounded-full`，选中项为 `bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm`。
  - **刷新字幕与下载 PDF (WATCH-009)**：
    - 在控制条下部，排列一排次要操作按钮（两列等宽布局）。
    - 刷新字幕按钮：`flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800 rounded-full h-10 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50`。
    - 下载 PDF 按钮 (WATCH-009)：`flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800 rounded-full h-10 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50`。

### 2.4 TranscriptPanel 移动端重设 (TranscriptPanel.tsx)
* **长列表滚动容器**：
  - 类名：`w-full h-[calc(100vh-56.25vw-44px-env(safe-area-inset-bottom)-48px)] overflow-y-auto`。
  - 对句子流进行合理裁剪或原生虚拟化滚动，确保滑动顺畅。
* **句子卡片 (Sentence Group)**：
  - 容器：`group flex flex-col p-4 border-b border-zinc-100 dark:border-zinc-900/60 bg-white dark:bg-zinc-950 transition`。
  - 激活状态句：`bg-brand-50/20 dark:bg-brand-950/5 border-l-2 border-brand-500`。
  - 句子西语文本：`text-sm font-semibold leading-relaxed text-zinc-800 dark:text-zinc-200`。
  - 句子中文翻译：`text-xs text-zinc-400 dark:text-zinc-500 mt-1`。

### 2.5 推荐卡片流重设 (Related Videos)
* **卡片条目**：
  - 容器：`flex gap-3.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/10 hover:border-brand-200/50 transition`。
  - 缩略图：`w-28 h-16 object-cover rounded-lg shrink-0`。
  - 信息区：`flex-1 min-w-0 flex flex-col justify-between py-0.5`。
  - 标题：`text-[12px] font-semibold leading-relaxed line-clamp-2 text-zinc-800 dark:text-zinc-200`。
  - 频道：`text-[10px] text-zinc-400 dark:text-zinc-500 mt-1`。

---

## 3. 强制校验标准 (验收 Checklist)

1. **响应式适配**：保证 iOS 设备的刘海及安全指示条区域通过 `env(safe-area-inset-bottom)` 自动顶开，禁止发生操作键与 Home 指示条重叠。
2. **唯一 Player 实例**：用 Chrome DevTools 检查 DOM，`id="esponal-youtube-player"` 在同一时间仅能挂载 1 个，视频播放中途切换 tab，播放绝不能中断或重置。
3. **无游戏化与中文文案**：依照 `docs/UI-DESIGN-CONSTRAINTS.md`，页面内不能出现进度完成率圈、XP 积分以及任何引发焦虑的每日进度术语。错误提示及重载状态文案 100% 用清晰中文。

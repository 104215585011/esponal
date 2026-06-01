# MOBILE-000 — 移动端地基：查词卡抽屉化 + 设计 Token + 对标 DejaVocab 视觉升级设计稿

本设计稿规范了 `LookupCard` 共享查词组件在移动端的底部抽屉（Bottom Sheet）形态、全站移动端设计 Token 规范以及对标 DejaVocab 精致质感的视觉设计方案。此版设计以 Esponal 品牌强调色（`sky` 蓝系）贯穿，补回内容丰富度，打造一流的成品级移动查词体验。

---

## 1. 查词卡移动端形态：对标 DejaVocab 底部抽屉 (Mobile Sheet)

### 1.1 手机端底部抽屉 ASCII 布局 (Mobile Drawer Layout)

```text
+---------------------------------------------+
|                                             |
|              点击外部/背景关闭                 |
|                                             |
+---------------------------------------------+  <- 视口上部，主界面背景变暗
|                                             |
|  +---------------------------------------+  |  <- 底部抽屉开始 (rounded-t-3xl)
|  |                ======                 |  |  <- 居中拖拽杆 (Drag Handle)
|  |                                       |  |
|  |  aprender       [🔊]            [🤍]  |  |  <- 词头区 (大字 + 品牌色喇叭 + 收藏心形)
|  |  /a.pɾen.ˈdeɾ/   [v.]                 |  |  <- 音标/读音/词性
|  |                                       |  |
|  |  [ 已学 ✓ ]                           |  |  <- 状态 badge/chip (sky-500/10)
|  |                                       |  |
|  |  释义：                                |  |
|  |  1. 学习，学会                         |  |  <- 释义正文
|  |                                       |  |
|  |  你在今天遇到了                     [+]  |  <- 分区标题 + 品牌色 Plus 按钮
|  |  +---------------------------------+  |  |
|  |  | "Queremos aprender español."   |  |  |  <- 遭遇卡片 (深色圆角 elevated)
|  |  | (句中目标词 aprender 高亮为 sky 蓝)   |  |  |
|  |  |                                 |  |  |
|  |  |  [▶] 视频: Spanish for Beginners|  |  |  <- 遭遇来源 (Muted 文本 + 图标)
|  |  +---------------------------------+  |  |
|  |                                       |  |
|  |  相关搭配                           [+]  |  <- 分区标题
|  |  +---------------------------------+  |  |
|  |  | aprender a (学习做...)      搭配 |  |  <- 搭配卡片 (LEX-003)
|  |  +---------------------------------+  |  |
|  |                                       |  |
|  |  [          保存至我的生词本          ]  |  |  <- 核心操作按钮 (圆角胶囊, Height 44px)
|  |                                       |  |  <- 适配 iOS 底部安全区 (pb-safe)
|  +---------------------------------------+  |
+---------------------------------------------+
```

### 1.2 高保真 UI 模型图 (High-Fidelity UI Mockup)

下列模型图展示了移动端查词底部抽屉在真实场景下对标 DejaVocab 的界面排布。

![MOBILE-000 移动端底部抽屉查词卡 UI 模型](file:///C:/Users/wang/.gemini/antigravity/brain/7bac0d5a-3e94-46d5-9839-17e9ebbf0f49/mobile_lookup_sheet_deja_aligned_1780301354008.png)

---

## 2. 视觉规范细节 (Tailwind Class Checklist)

开发团队（Codex1）在实现时必须严格使用以下样式规范，消灭 `useStaticLayout` 导致的平铺感，在亮色和暗色模式下拉开层次：

### 2.1 抽屉面板与遮罩 (Drawer Container & Backdrop)
* **遮罩层 (Backdrop)**：`bg-black/50 backdrop-blur-[2px] transition-opacity duration-300`。
* **面板主体 (Panel Body)**：
  - 容器：`bg-white dark:bg-[#09090B] border-t border-zinc-200/50 dark:border-zinc-800/40 rounded-t-3xl shadow-hero flex flex-col transition-transform duration-300 ease-out`。
  - 拖拽手柄：`w-12 h-1 bg-zinc-200 dark:bg-zinc-800/80 rounded-full mx-auto mt-3 mb-2 shrink-0`。
  - 安全区内边距：`pb-[calc(env(safe-area-inset-bottom)+16px)]`。

### 2.2 词头与发音 (Header & Speech)
* **单词标题**：`text-[26px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 font-display`。
* **TTS 按钮**：
  - 图标：使用 Lucide `Volume2`（代替旧的 `>`）。
  - 颜色：非播放状态为 `text-sky-500 hover:bg-sky-500/10`，播放中为 `text-sky-600 bg-sky-500/20 animate-pulse`。
  - 尺寸：`w-9 h-9 flex items-center justify-center rounded-full bg-sky-500/5 dark:bg-sky-500/10 transition`。
* **收藏/生词本心形 (Heart Icon)**：
  - 放置在词头最右侧。
  - 未收藏：`text-zinc-300 dark:text-zinc-600 hover:text-sky-500 transition`。
  - 已收藏：`text-sky-500 fill-sky-500 scale-110 transition duration-300`。

### 2.3 音标与状态 Chip (Status & Phonetic)
* **音标/词性行**：`flex items-center gap-2 mt-1 text-sm font-mono text-zinc-400 dark:text-zinc-500`。
* **词性 Badge**：`bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded text-[11px] font-medium`。
* **状态 Chip**（当已加入生词本时显示）：
  - 样式：`bg-sky-500/10 text-sky-500 border border-sky-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit mt-3`。
  - 内部文本：`已学 ✓` 或 `已标记`。

### 2.4 分区标题 (Section Titles)
* 统一采用：`flex justify-between items-center text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-6 mb-3`。
* 右侧搭配品牌色 Plus 按钮：`text-sky-500 hover:text-sky-600 cursor-pointer p-1 -mr-1 transition`。

### 2.5 遭遇卡片与相关搭配 (Encounter Card & Related Phrases)
* **遭遇卡容器 (Encounter Box)**：
  - 样式：`bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/40 rounded-2xl p-4 shadow-sm relative overflow-hidden`。
  - 句中目标词高亮：`text-sky-500 font-bold hover:underline cursor-pointer`。
  - 遭遇来源：前置 Lucide `Play` 或 `FileText` 徽标，文字使用 `text-xs text-zinc-400 dark:text-zinc-500 mt-2 block`。
* **相关搭配卡片 (Related Phrase Item)**：
  - 样式：`bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/40 rounded-xl p-3 flex justify-between items-center hover:border-sky-500/30 transition`。
  - 左侧：`lemma` 用 `text-sm font-semibold text-zinc-800 dark:text-zinc-200`，中文翻译用 `text-xs text-zinc-400 dark:text-zinc-500 ml-2`。
  - 右侧：类型 Badge（短语/搭配）用 `text-[10px] font-semibold tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200/20`。

### 2.6 底部核心保存按钮 (Footer Action Button)
* **未保存状态**：`bg-sky-500 hover:bg-sky-600 text-white font-semibold h-11 w-full rounded-full transition shadow-md flex items-center justify-center gap-2`。
* **已保存状态**：`bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 font-medium h-11 w-full rounded-full transition flex items-center justify-center gap-2 cursor-default`。

---

## 3. UI 交互细节与状态联动
1. **点词暂停与遮罩关闭**：
   - 手机端底部查词抽屉拉起时，视频/朗读应正常暂停，遮罩点击、手持下滑均可关闭抽屉，并恢复音频/视频播放。
2. **安全区域保护**：
   - 抽屉底部内边距必须使用 `pb-[calc(env(safe-area-inset-bottom)+16px)]`，确保操作按钮不被系统 Home Bar 遮挡。
3. **滚动锁定**：
   - 抽屉拉起时，主视口（Player 页面）通过 `overflow: hidden` 锁定，滚动区域仅限抽屉内部。

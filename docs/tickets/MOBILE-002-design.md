# MOBILE-002 — lectura 分级阅读 移动端重设计（设计稿）

**更新时间**: 2026-06-02
**状态**: 设计交付（Ready for Implementation）
**作者**: UI 设计师（接替 Gemini1）
**设计基调**: 克制、专业、温暖的现代阅读体验。lectura 是每日留存引擎，**排版与可读性高于一切**。拒绝游戏化、拒绝打卡焦虑、拒绝 sky 蓝（全站强调色统一翡翠绿 `brand` #10b981）。

---

## 0. 给开发（Codex1）的前置说明 — 必读

在动手前先理解现状，避免重复造轮子 / 误改桌面：

1. **查词底部抽屉已经自动生效，不要再写。**
   `LookupCardStack`（在 `src/app/watch/LookupCard.tsx`）内部用 `useIsMobileViewport()`（`matchMedia("(max-width: 767px)")`）自动判断：移动端时渲染 `MobileLookupSheet`——`fixed inset-0 z-50`、`rounded-t-2xl`、拖拽手柄、`bg-black/45` 遮罩、`pb-[calc(env(safe-area-inset-bottom)+12px)]`、锁 body 滚动、下滑/点遮罩关闭。
   `LecturaReader.tsx` 的浮动分支已经在用 `LookupCardStack`，所以**点词在移动端已经是 MOBILE-000 底部抽屉**。本票**不许改 LookupCard / MobileLookupSheet 一行**（全站共享，MOBILE-001 血泪教训）。浮动分支里那个 `style={{ left, top }}` 在移动端会被 `MobileLookupSheet` 的 `fixed inset-0` 覆盖、不起作用，无需处理。

2. **桌面端 lectura 一律不动。** 本票所有新增样式只在 `<768px`（`max-md:` / 默认 + `md:` 覆盖）生效。桌面端的 `ReadingPreferences`、右侧 `ReadingDock`（`hidden lg:block`）、段落 hover 显隐播放键全部原样保留。新增的移动控制条加 `md:hidden`。

3. **不做双语对照。** 内容文件 `content/lectura` 的 `paragraphs` 是纯西语字符串数组、**无逐段中文译文**（只有 `titleZh` / `summaryZh`）。仓库虽存在 `/api/translate/route.ts`，但逐段实时翻译每段（每篇十余次请求 + 缓存）超出本票「排版重做」目标，且本票「不在范围」未列双语。本设计**不包含双语切换**。需要中文时用户点词查词即可（抽屉里有释义）。如果 PM 确需双语，另开 ticket 评估译文质量 / 缓存策略。

4. **复用既有 token / 工具类**：`bg-app` / `bg-surface`、`brand-*`、`zinc-*`、`shadow-card|elevated|hero`、`.glass-card`、`.saved-word`、`.animate-shimmer`、`rounded-card|surface|hero`、`font-serif`（正文）、`font-display`（数字/标题）、`.pb-safe` / `.mobile-touch-target`（如已定义；触摸目标 ≥44px）。图标统一 `lucide-react`。

5. **改动文件范围**：`src/app/lectura/page.tsx`（列表，仅微调）、`src/app/lectura/[slug]/page.tsx`（文章壳，仅微调）、`LecturaReader.tsx`（新增移动控制条 + 正文响应式字号 + 段落播放键移动端常显）、`ReadingPreferences.tsx`（可选：复用为移动控制条内的字号控件）。**不碰** `LookupCard.tsx`、`ReadingDock.tsx`（桌面）、`LecturaReadStatus.tsx`（桌面顶部状态保留）。

---

## 1. 列表页 `/lectura` 移动端

> 现状评估：列表页其实已经是不错的单列卡片流（`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`，等级徽章、时长、已读徽章齐全，`active:scale-[0.98]`）。**本票对列表页只做精修，不重写。**

### 1.1 容器与间距（基本保留，确认即可）

- 区块容器：`mx-auto max-w-app-shell px-4 py-6 md:py-10`（保留）。
- 卡片网格移动端单列：`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3`（保留）。
- 卡片内边距移动端略增手感：把现有 `p-4 md:p-5` 保留即可（`p-4` = 16px 已达标）。

### 1.2 卡片触摸反馈（保留，确认达标）

现有卡片类已正确做了「移动端无 hover 抬升、用 `active:scale-[0.98]`，桌面才 `md:hover:-translate-y`」的隔离：

```jsx
className={`group flex flex-col gap-3 rounded-2xl border p-4 md:p-5 shadow-card transition-all active:scale-[0.98] md:hover:-translate-y-[2px] md:hover:border-brand-200 md:dark:hover:border-brand-800 md:hover:shadow-elevated ${
  isRead
    ? "border-brand-100/60 dark:border-brand-900/30 bg-brand-50/5 dark:bg-brand-950/2"
    : "border-zinc-200/60 dark:border-zinc-800/60 bg-surface"
}`}
```

**唯一要补的一点（手感）**：整卡是 `<Link>`，移动端确保点击目标足够大——卡片本身高度已 >44px，达标，无需额外改。

### 1.3 等级徽章 / 时长 / 已读态（保留现状，已合规）

当前 `levelStyle` 已是绿/zinc/amber，无 sky、无 purple，符合禁区。保留：
- A1：`bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 border border-brand-200/30 dark:border-brand-800/20`
- A2：`bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50`
- B1：`bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/30 dark:border-amber-800/20`
- 时长：`text-[11px] font-medium text-zinc-400 dark:text-zinc-500`
- 已读徽章：`bg-brand-50 dark:bg-brand-950/40 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-brand-400 border border-brand-100/50 dark:border-brand-900/30`

### 1.4 顶部「已读 N / M 篇」进度（合规性确认）

页面顶部有一个**细圆环 + 文字**的已读统计。按禁区清单 §1：**静态、客观、低优先级**的「已读 N / M 篇」是被允许的（不是每日进度环、不带「还差 X」压力文案）。**保留，不改**。圆环描边色已是 `text-brand-500 dark:text-brand-400`，合规。

> 结论：列表页**无需大改**，Codex1 只需确认上述均为现状、移动端单列渲染正常、徽章配色无 sky 即可。设计精力集中在文章页。

---

## 2. 文章页 `/lectura/[slug]` 移动端正文排版（本票重点）

### 2.1 文章壳容器（`[slug]/page.tsx`，微调）

```
+------------------------------------------+
|               SiteHeader                 |
+------------------------------------------+
|  ← 阅读                                   |   <- BackLink；右侧桌面才显示 LecturaReadStatus
|                                          |
|  La siesta                               |   <- 西语大标题 (font-display)
|  西班牙午睡                                |   <- 中文副标题
|  [A1] · 2 min · 原创文化短文              |   <- meta 行
|                                          |
|  Un león dormía tranquilo en el bosque…  |   <- 正文（serif，舒适字号/行距）
|  …                                       |
|                                          |
|        [ 底部留白 pb-28，给控制条 ]        |
+------------------------------------------+
|  [Aa]      [|◁]  ( ▶ )  [▷|]       [✓]   |  <- 移动悬浮控制条 md:hidden
+------------------------------------------+
```

- `article` 容器：保留 `mx-auto max-w-3xl px-5 pb-32 pt-6 md:px-6 md:pt-10`。
  - `px-5`（20px）左右留白移动端阅读舒适，保留。
  - `pb-32`（128px）为底部悬浮控制条 + 安全区留白，保留。
- 西语大标题：`mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:mt-8 md:text-3xl lg:text-4xl`（保留；可加 `font-display` 强化品牌大标题，可选）。
- 中文副标题：`mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 font-normal`（保留）。
- meta 行：`mt-4 flex flex-wrap items-center gap-3 text-sm`（保留），等级徽章用 §1.3 同款。
- 顶部 `LecturaReadStatus`（「标记为已读 / 已读 ✓」）：桌面保留在右上角即可。**移动端可隐藏顶部这枚**（加 `hidden md:inline-flex` 包裹），因为已读操作下沉到底部控制条的 `✓` 键（见 §3.3.4），避免重复。若不想动 server 组件结构，也可保留顶部小徽章——二选一交由实现方便，但**不要移动端上下各一个 ✓ 引起困惑**。推荐：移动端隐藏顶部，统一用底部控制条。

### 2.2 西语正文字号阶梯 / 行高（核心，给精确值）

`LecturaReader.tsx` 当前 `fontSizeStyle` 用了 `text-[16px] leading-[1.8]` 等非标准值。**移动端优先级：可读性 > 严格 token**——这里行高/字号是阅读体验的命根，允许保留精确数值，但要做**移动端略小、桌面略大**的响应式（移动端窄屏不需要太大字撑爆行）。替换为：

| 偏好档位 | 移动端 (<768px) | 桌面 (≥768px) | 说明 |
|---|---|---|---|
| **sm（小）** | `text-[16px] leading-[1.75]` | `md:text-[16px] md:leading-[1.8]` | 高密度 |
| **md（中·默认）** | `text-[18px] leading-[1.85]` | `md:text-[18px] md:leading-[1.85]` | 黄金可读 |
| **lg（大）** | `text-[19px] leading-[1.9]` | `md:text-[20px] md:leading-[1.9]` | 视力疲劳者 |

实现：

```ts
const fontSizeStyle: Record<ReadingFontSize, string> = {
  sm: "text-[16px] leading-[1.75] md:leading-[1.8]",
  md: "text-[18px] leading-[1.85]",
  lg: "text-[19px] leading-[1.9] md:text-[20px]"
};
```

其它正文规范（移动端）：
- 字体家族：保留 `font-serif`（西文沉浸阅读质感更好）；正文色 `text-zinc-800 dark:text-zinc-200`。
- **段距**：段落间距是长文不累的关键。当前 `mb-8`（32px）偏大、移动端浪费屏。改为 **`mb-6 md:mb-8`**（移动 24px / 桌面 32px）。
- **左右留白**：由 `article` 的 `px-5` 提供；正文容器本身不再额外加左 padding（见 §2.3 播放键改造）。
- 正文最大宽度：移动端天然满宽（`max-w-3xl` 在窄屏不触发），无需处理。

### 2.3 段落播放键 + 朗读高亮（移动端改造）

现状：每段是 `flex gap-3 border-l-2 pl-3.5`，左侧一个圆形播放键 `sm:opacity-0 sm:group-hover:opacity-100`（桌面 hover 才显，移动端常显）。问题：移动端这个键常显且占左侧 24px+gap，挤压正文且视觉杂。

**移动端方案**：左侧逐段小播放键在移动端**隐藏**，朗读改由底部控制条统一驱动（§3.3.3，整篇连续/逐段播放）。这样移动端正文是干净的纯文本，留白最大化。

- 逐段播放键 `<button>`：把可见性规则改成「移动端隐藏、桌面保留原 hover 行为」：
  - 移动端：`hidden`
  - 桌面：`md:flex md:opacity-0 md:group-hover:opacity-100`（外加播放中 `opacity-100`）
  - 即：`className="... hidden md:flex md:opacity-0 md:group-hover:opacity-100 ..."`（播放态再补 `opacity-100`）。
- 段落容器：移动端去掉为播放键预留的 `gap-3 pl-3.5`，但**保留朗读高亮的左边框**：
  - 段落容器类：`group mb-6 md:mb-8 flex md:gap-3 border-l-2 pl-3 md:pl-3.5 transition`
  - 朗读中段落（高亮）：`border-brand-500`（保留）。
  - 非朗读段落：`border-transparent`（保留）。
  - 当前正在朗读的段落，额外给一点呼吸：`bg-brand-50/40 dark:bg-brand-950/20`（仅 active 段，移动端尤其帮助定位）。可选，但推荐。

> 朗读高亮状态机沿用现有：`playingParagraphIndex`。仅一段高亮、其余正常（**不要**把其它段落降到 `opacity-45`——会让长文阅读分心，违背克制基调）。

### 2.4 已收藏词标识

正文里已收藏词用 `.saved-word`（细虚线下划线，非删除线），保留——符合禁区 §3。移动端无需改。点词命中 `.saved-word` 一样弹底部抽屉。

---

## 3. 移动端悬浮控制条（`ReadingDock` 的移动形态 / 新增组件）

> 这是文章页移动端的核心新增。桌面端的右侧 `ReadingDock`（查词固定面板，`hidden lg:block`）**完全不动**。移动控制条是另一个东西：一条**底部胶囊**，把「字号、朗读、已读」三类拇指高频操作集中到底部热区。建议在 `LecturaReader.tsx` 内新增一个 `md:hidden` 的 `<nav>`，或抽成 `MobileReadingBar` 子组件（同文件内，避免新文件依赖问题）。

### 3.1 布局 ASCII

```
+-----------------------------------------------------------+
|             [ 正文滚动区，底部 pb-32 留白 ]                  |
|  +-----------------------------------------------------+  |
|  |  [Aa]      [|◁]   ( ▶/❚❚ )   [▷|]          [ ✓ ]   |  |  <- z-30 毛玻璃胶囊
|  +-----------------------------------------------------+  |
|        字号        上一段  播放/暂停  下一段       已读      |
+-----------------------------------------------------------+
```

### 3.2 容器

```jsx
<nav
  className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex h-16 items-center justify-between gap-1 rounded-full border border-zinc-200/60 bg-white/80 px-3 shadow-elevated backdrop-blur-md transition-all duration-300 ease-out dark:border-zinc-800/60 dark:bg-zinc-900/80 md:hidden"
  aria-label="阅读控制"
>
  …
</nav>
```

要点：
- `md:hidden`：只在移动端出现，桌面零影响。
- `bottom-[calc(env(safe-area-inset-bottom)+12px)]`：避开 iOS Home Bar。
- `z-30`：**严格低于查词抽屉 `z-50`**。
- 毛玻璃：`bg-white/80 ... backdrop-blur-md`（对齐 `.glass-card` 语言）。
- 高度 `h-16`(64px)，内部每个可点元素 ≥44px。

### 3.3 控件（左 → 右）

所有图标用 `lucide-react`。

#### 3.3.1 字号循环键 [Aa]
- 行为：点击循环 `sm → md → lg → sm`（移动端屏幕窄，循环比展开弹层更省手）。沿用现有 `handleSetFontSize` 写 localStorage（`read-pref-size`），无需新逻辑。
- 样式：
  `className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-600 active:scale-90 active:bg-zinc-100 transition-transform dark:text-zinc-300 dark:active:bg-zinc-800"`
- 内容：文本 `Aa`，`text-sm font-semibold font-display`。当前档位用尺寸暗示：可在 `Aa` 右上角加极小档位点（可选，别花哨）。
- 无障碍：`aria-label={"字号：" + {sm:"小",md:"中",lg:"大"}[fontSize]}`。

#### 3.3.2 上一段 [|◁]　lucide `SkipBack`
- 样式：`className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 active:scale-90 transition-transform dark:text-zinc-400"`
- 图标：`<SkipBack className="h-5 w-5" />`
- 动作：跳到上一段并播放。若当前无播放，跳到第一段（`p0`）播放。到顶则停在第一段。

#### 3.3.3 播放 / 暂停（主键）[▶ / ❚❚]　lucide `Play` / `Pause`
- 样式：
  `className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/25 active:scale-95 transition-all"`
- 图标：播放中 `<Pause className="h-5 w-5 fill-current" />`，否则 `<Play className="h-5 w-5 fill-current translate-x-[1px]" />`。
- 动作：复用现有 `toggleParagraphAudio`。若当前无 `playingParagraphIndex`，从第一段 `p0` 开始；正在播放则暂停（调用 `stopCurrentAudio`）。
  - **可选增强（连续朗读）**：现有 `audio.addEventListener("ended", …)` 直接把段落置空。要实现「自动播下一段」，在 `ended` 回调里改为 `toggleParagraphAudio(index+1)`（若存在下一段）。这是体验加分项，若实现成本高可先做「逐段、播完即停」，由用户点 `▷|` 续播。**最低验收只需逐段可播。**

#### 3.3.4 下一段 [▷|]　lucide `SkipForward`
- 样式：同 §3.3.2（左右对称）。
- 图标：`<SkipForward className="h-5 w-5" />`
- 动作：跳下一段播放；已是最后一段则停止（`stopCurrentAudio`）。

#### 3.3.5 已读键 [✓]　lucide `Check`
- 行为：标记 / 已标记当前文章为已读。复用现有 `markAsRead`（POST `/api/lectura/[slug]/read`）与 `isMarked` 状态。已读后变实心绿、不可再切（与全站「已读是安静的终态、不反悔」一致；保持只读，不做取消已读）。
- 未读：
  `className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 active:scale-90 hover:text-brand-500 transition-all dark:border-zinc-800 dark:text-zinc-500"`
- 已读：
  `className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/20 transition-all"`（已读后去掉 hover/active，加 `cursor-default`）
- 图标：`<Check className="h-5 w-5" />`
- 注意：滚动到 90% 自动标已读的现有逻辑保留——此时底部 `✓` 自动变实心绿（绑定同一 `isMarked`）。

### 3.4 与查词底部抽屉（MOBILE-000）不打架

查词抽屉是 `fixed inset-0 z-50` 全屏 + 锁 body 滚动；控制条 `z-30`。即便层级已够，**仍要在抽屉开启时隐藏控制条**，避免抽屉半透明边缘下透出胶囊、或抽屉关闭过渡期误触：

```jsx
// MobileReadingBar 渲染前
if (activeLookup) return null;   // 查词抽屉开启时，移动控制条卸载
```

`activeLookup` 已是 `LecturaReader` 的现成 state，直接用。抽屉关闭（`setActiveLookup(null)`）后控制条自动随 `duration-300` 重新淡入（容器已带 `transition-all duration-300`）。

### 3.5 沉浸阅读（可选，本票不强制）

可选加分项：向下滚动时控制条用 `translate-y-[calc(100%+24px)] opacity-0` 滑出、向上滚动滑回（节流监听 `scrollY` 方向）。**默认实现不要做**——避免「找不到播放键」。若 PM 要，再单列。`SiteHeader` 顶栏移动端保持常显，不做隐藏（导航可达性优先）。

---

## 4. ReadingPreferences 移动端入口/形态

- **桌面端**：保留现有齿轮按钮 + 下拉弹层（字号三档 + 查词模式 float/dock）。**不动**。把它包一层 `hidden md:flex` 确保移动端不出现（现在它在正文右上 `flex justify-end mb-6` 容器里，移动端会与新控制条功能重复）。
  - 实现：`<div className="hidden md:flex justify-end mb-6">…ReadingPreferences…</div>`
- **移动端**：字号入口下沉到底部控制条 `Aa` 循环键（§3.3.1），**不再单独出偏好弹层**。查词模式（float/dock）在移动端无意义（移动端永远是底部抽屉），所以移动端无需暴露该选项。
  - 移动端默认查词模式：现有 `useEffect` 已在 `window.innerWidth < 1024` 时设 `lookupMode="float"`。无论 float/dock，移动端 `LookupCardStack` 都自动渲染底部抽屉，行为一致，**无需改**。

---

## 5. 颜色 / 材质 Token 对照（移动端控制条与正文）

禁止硬编码 hex（正文字号的 `text-[18px]` 属可读性例外，已说明）。

| 元素 | Light | Dark |
|---|---|---|
| 主背景 | `bg-app` | `dark:bg-app`（globals 已处理） |
| 卡片/面板底 | `bg-surface` | `dark:bg-zinc-900` |
| 悬浮控制条玻璃 | `bg-white/80 backdrop-blur-md` | `dark:bg-zinc-900/80 backdrop-blur-md` |
| 控制条边框 | `border-zinc-200/60` | `dark:border-zinc-800/60` |
| 西语正文字色 | `text-zinc-800` | `dark:text-zinc-200` |
| 主操作 / 强调 | `bg-brand-500` / `text-brand-600` | `dark:bg-brand-500` / `dark:text-brand-400` |
| 朗读高亮边 | `border-brand-500` | `border-brand-500` |
| 已读实心 | `bg-brand-500 text-white` | 同 |

强调色**只有翡翠绿 `brand`**。等级 B1 的 amber 仅用于等级徽章（沿用现状），不扩散到控制条。**禁止任何 sky / purple。**

---

## 6. 桌面端隔离清单（验收逐条核对）

1. 移动控制条 `<nav>` 带 `md:hidden`，桌面零渲染。
2. 桌面 `ReadingPreferences` 容器加 `hidden md:flex`，桌面正常、移动隐藏。
3. 桌面右侧 `ReadingDock`（查词面板）仍 `hidden lg:block`，**不动**。
4. 逐段播放键移动端 `hidden`、桌面 `md:flex md:opacity-0 md:group-hover:opacity-100`（+ 播放态 `opacity-100`）。
5. 正文字号 `fontSizeStyle` 用 `md:` 断点做响应式，桌面值不回退（md 档桌面仍 18px/1.85，lg 桌面仍 20px）。
6. 不改 `LookupCard.tsx` / `MobileLookupSheet`（共享）。
7. 不引入 `/api/translate`、不加双语状态。

---

## 7. 实现校验（给 Codex1 / Codex2）

- 真机 / 设备模式（375 宽）实际打开 `/lectura` 与一篇 `/lectura/[slug]`：不触发 error boundary、正文舒适、控制条在底部安全区内、四键拇指可达。
- 点任意西语词 → 底部抽屉弹出、控制条消失；关抽屉 → 控制条淡回。
- 播放主键能出声并高亮当前段；`✓` 能标已读并变实心绿；滚到底自动已读时 `✓` 同步变绿。
- 桌面（≥1280）打开同页：无任何变化（控制条不出现，右侧查词面板与齿轮偏好如旧）。
- `npm test` 全绿 + `npm run build` 通过 + `lint:encoding` 通过；文件 UTF-8、无 scratch 调试文件入仓。

---

## 8. 需 PM / 用户拍板的开放点

1. **连续朗读**：底部播放主键播完一段是「自动续下一段」还是「停下等用户点 ▷|」？设计推荐自动续播（更贴近「躺着听一篇」的留存场景），但实现稍复杂。最低验收只要求逐段可播。→ 请 PM 定是否纳入本票。
2. **顶部已读徽章去留**：移动端是否隐藏文章页顶部的 `LecturaReadStatus`、把已读统一收到底部 `✓`？设计推荐隐藏顶部（避免一页两个已读入口）。→ 请 PM 确认。
3. **沉浸滑动隐藏控制条**：默认不做（避免找不到播放键）。→ 若用户想要再开子票。
4. **双语对照**：本设计明确不做（`paragraphs` 无逐段译文、属本票范围外）。`/api/translate` 虽存在，但逐段实时翻译 + 缓存的工作量与质量风险应单独评估。→ 若产品确需，另立 ticket。

---

## 9. PM 决议(§8 开放点)— Claude1 2026-06-02

1. **连续朗读:纳入本票,做自动续播。** 底部播放主键播完一段→自动播下一段(`ended` 回调 → `toggleParagraphAudio(index+1)`),到末段停。理由:贴"躺着听一篇"的留存场景,且实现成本低。(最低保底仍是逐段可播。)
2. **顶部已读徽章:移动端隐藏顶部 `LecturaReadStatus`,已读统一收到底部 `✓`。** 避免一页两个已读入口。桌面顶部保留。
3. **沉浸滑动隐藏控制条:不做**(避免找不到播放键)。
4. **双语对照:不做**,范围外;确需另立 ticket。

> 以上为 PM 拍板,Codex1 照此实现;用户真机验收时若对 1/2 有异议再调。

---

## 10. 用户真机反馈 → 待返工(Claude1 记录 2026-06-02,暂挂,等 MOBILE-009 外壳定)

1. **播放改逐句小喇叭**:去掉底部"上一段/播放/下一段"那套,改为**每句话后面一个小喇叭图标**,点哪句听哪句(不用点"下一个")。底部条只留 字号 + 已读(且要与 MOBILE-009 底部 tab 栏协调,别打架)。需把段落 TTS 细到句级(按 .!?¿¡ 切句,点击该句 → TTS)。
2. **字号三档:用户喜欢,保留**。
3. **排版难看 = 松散/太空 + 卡片/头部/配色不精**:收紧整体间距层次,精修文章头部(标题/副标题/meta)、卡片、配色,做出 MOBILE-001 那种精致度。(下划线不是问题,无需动。)
4. 依赖 MOBILE-009:底部 tab 栏会占底部,lectura 控制条要叠在其上或沉浸时让位,返工时按 MOBILE-009 设计协调。

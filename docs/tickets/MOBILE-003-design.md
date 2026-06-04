# MOBILE-003 — 首页 `/` 内容布局 移动端重设计（设计稿）

**更新时间**: 2026-06-03
**状态**: 设计交付（Ready for Implementation）
**作者**: UI 设计师（接替 Gemini1）
**范围**: 只重做首页 `src/app/page.tsx` 的**内容布局**在移动端（<768px）的呈现，让它像一个清爽的 app 首页，不是堆砌的网页。**导航外壳（底部 tab、顶栏、头像侧边栏）由 MOBILE-009 负责，本票一律不碰。桌面端首页零回退。**
**强调色**: 全站统一翡翠绿 `brand`（#10b981），**禁 sky 蓝、禁 purple**。

---

## 0. 给开发（Codex1）的前置说明 — 必读

### 0.1 本票的"心智模型转变"（最重要，先读懂再动手）

旧首页是按"网页落地页"设计的：Hero 大横幅 + 5 张学习路径步骤卡横排 + 工具区 + footer。它假设首页是**导航中枢**——用户从这里点进各个功能。

但 MOBILE-009 已经把导航接管了：
- **底部 tab**（常驻）：视频 `/watch`、阅读 `/lectura`、课程 `/learn`、语料库 `/vocab`。
- **头像左侧侧边栏**：发音 `/phonics`、对话 `/talk`、语法 `/grammar`、拆解 `/dissect`、设置、积分订阅。

所以移动端首页**不再需要重复罗列所有入口**。它的新职责是：**一块"开门即见、引导下一步"的着陆区**——欢迎 + 一个最强 CTA（继续学/开始学）+ 精选内容流（让人立刻有东西可看可读）。导航的事交给 tab 和侧边栏，首页只做"内容门面 + 下一步引导"。

> 这与既定 IA 一致：MOBILE-009 §11.2 明确"app 开门即进内容，不要首页 tab"，并把"`/` 首页在移动端去留 + 默认落地 tab"留给本票（MOBILE-003）定。**本票的 PM 拍板见 §7 开放点**——默认方案是**保留 `/` 作为内容门面页**（不删），但精简到不与 tab/侧边栏重复。

### 0.2 现状摸底（实现前必读）

| 事实 | 影响 |
|---|---|
| `page.tsx` 是 server component，渲染 `SiteHeader` + `HomeHero` + 学习路径 section + 工具 section + 隐藏的 `#video-sections`（测试占位）+ footer。 | 本票重排这些区块的**移动端**呈现；server 取数逻辑（`getVocabStats`、`lecturaRead.count`）保留。 |
| `HomeHero` 是 client 组件，已支持 `isLoggedIn`，内含 `ParticleBackground`、`min-h-[460px]`、`p-8 sm:p-16`、`text-4xl…text-6xl` 大标题、两个胶囊按钮。 | 移动端 Hero **太高太重**（460px + 粒子 + 6xl）。本票给它一套 `md:hidden`/响应式精简版（见 §2）。**粒子背景移动端建议关掉或弱化**（性能 + 克制）。桌面分支完全保留。 |
| 学习路径 5 张 `LearningStepCard` 当前 `flex-col gap-4 lg:flex-row`，移动端是竖向堆叠 5 张 220px 高卡片 → 一屏放不下、滚动疲劳。卡里有 `progress` + 圆环 `percentage`。 | 移动端 5 张大卡竖排太长、太"网页"。改为**紧凑的横向滑动轨道**或**精简竖列**（见 §3）。**圆环进度 `percentage` 在移动端首页要去掉**（见 §0.3 合规）。 |
| 工具区 `toolItems` = 句子拆解器 `/dissect` + 词库 `/vocab`。`/vocab` 已是底部 tab「语料库」，`/dissect` 已在头像侧边栏。 | **移动端首页的"工具区"与 tab/侧边栏重复**。建议移动端**移除独立工具区**（§4），或仅保留一个"拆解器"轻入口。`/vocab` 不再在首页重复出现。 |
| `#video-sections`（`hidden`）和 `curatedChannels` 引用是为 `tests/home001.test.mjs` 静态断言保留的。 | **不要删这两个标识**，否则测试挂。视频流见 §5——可把真实视频流放进 `#video-sections` 容器或新容器，但保留该 id 与 `curatedChannels` 引用。先与 Codex2 对齐测试断言再改 DOM 文本。 |
| `VideoCard` 有 `compact`（横向 120×68 缩略图 + 两行标题）和默认（`w-60` 固定宽卡）两种形态。 | 移动端视频流**复用 `VideoCard`**，按 §5 选形态。**不新造视频卡组件。** |
| 现有 `fetchChannelVideos` 会逐频道 fetch `/api/youtube/channel`。首页当前其实没渲染视频（只有隐藏占位）。 | 本票若要在移动端首页**真的显示**一条精选视频流，需要 Codex1 在 server 端调 `fetchChannelVideos`（取 1 个精选频道、6~8 条）并传给客户端渲染。**这是新增数据流**，见 §5 + §7 开放点 2（PM 需确认是否本票纳入真实视频流，还是先占位）。 |

### 0.3 禁区合规（本票特别注意）

对照 `UI-DESIGN-CONSTRAINTS.md`：

- **学习路径卡里的圆环进度 `percentage`（`已收藏 X 词` 折算成百分比的环 + "进度到 50 词")**：这是"把进度百分比放在显眼位置"，移动端首页是开门第一屏，**违反 §1**。→ **移动端首页去掉百分比圆环**。文字态 `已收藏 N 词` / `已读 N 篇` 是"静态、客观、低优先级"展示，**允许保留为纯文字**（§1 ✅），但不要环、不要"还差 X 词"。
- 不做打卡 streak、不做"今天还没学"、不做红点角标。
- Hero badge 文案"全新设计语言·极简交互体验"是营销腔，移动端可换成更克制的一句（见 §2.2），但不强制。
- 所有文案中文优先、正确中文（项目踩过乱码坑，文件存 UTF-8）。

### 0.4 复用既有 token / 工具类

`bg-app`、`bg-surface`、`brand-*`、`zinc-*`、`shadow-card|elevated|hero`、`.glass-card`、`.card-hover-lift`、`rounded-card|surface|hero`、`font-display`（标题/数字）、`font-sans`（正文）、`.pb-safe`、`.mobile-touch-target`（若已定义；触摸目标 ≥44px）。图标统一 `lucide-react`。**不写死 hex、不发明字号（正文阅读类例外不适用于首页，首页一律用阶梯）。**

---

## 1. 移动端首页整体骨架（从上到下）

```
┌─────────────────────────────────────┐
│  [MOBILE-009 顶栏: 头像 订阅 搜索]    │  ← 不属本票，sticky h-13
├─────────────────────────────────────┤
│                                       │  ← 内容滚动区 (本票)
│  ╭───────────────────────────────╮   │
│  │  Hero 精简卡 (§2)              │   │  ← 欢迎语 + 1 个主 CTA
│  │  欢迎回来 / 西班牙语从听懂开始  │   │     登录态 vs 未登录态
│  │  [ 继续学习 → ] / [ 开始学习 → ]│   │
│  ╰───────────────────────────────╯   │
│                                       │
│  继续你的学习                          │  ← 区标题 (§3)
│  ┌──────┐┌──────┐┌──────┐┌──→        │  ← 学习路径 横向滑轨 (snap)
│  │发音  ││课程  ││阅读   │            │
│  │01    ││02    ││03 已读3篇│         │
│  └──────┘└──────┘└──────┘            │
│                                       │
│  精选频道                              │  ← 区标题 (§5)
│  ┌──────────────┐ ┌──────────────┐    │  ← 视频流 横向滑轨 或 竖列
│  │ ▢ 缩略图     │ │ ▢ 缩略图     │    │
│  │ 标题两行      │ │ 标题两行      │    │
│  │ 频道名        │ │ 频道名        │    │
│  └──────────────┘ └──────────────┘    │
│                                       │
│  [ 你的词汇: 已收藏 89 词 · 已读 5 篇 ]│  ← 词汇统计 安静小条 (§6)
│                                       │
│       Esponal · 为中文母语者…          │  ← footer 精简 (§6)
│   ↑ 底部留白 pb-[calc(3.5rem+safe)]   │  ← 给底部 tab 让位 (MOBILE-009 §3.3)
└─────────────────────────────────────┘
│  [底部 tab: 视频 阅读 课程 语料库]    │  ← 不属本票，fixed
└─────────────────────────────────────┘
```

### 1.1 主容器与留白（关键，照抄）

当前 `page.tsx` 主容器：`<div className="mx-auto w-full max-w-app-shell px-4 py-16 sm:px-6 lg:px-8">`。

移动端问题：`py-16`（64px 上下）在移动端开门浪费首屏；且**底部没给底部 tab 留白**（会被 tab 盖住，违反 MOBILE-009 §3.3）。改为响应式：

```jsx
<div className="mx-auto w-full max-w-app-shell px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:pt-16 md:pb-16 lg:px-8">
```

- 移动：`pt-4`（顶栏下方 16px 起）、底部 `pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)]`（3.5rem=底部 tab `h-14` + 安全区 + 16px 呼吸）。
- 桌面：`md:pt-16 md:pb-16` 恢复原 `py-16`，**桌面零回退**。

### 1.2 区块间距节奏（统一，别再各区 `mt-16`）

旧首页各 section 用 `mt-16`（64px）——移动端太空、太"网页"。移动端统一收紧到 `mt-8`（32px），桌面恢复 `md:mt-16`：

- 每个 section 外层：`className="mt-8 md:mt-16"`（Hero 后第一个区可 `mt-6 md:mt-16`）。
- 区块标题与内容间距：`mb-3 md:mb-6`。

### 1.3 区标题统一样式（照抄，替换旧的 `text-base text-gray-800`）

旧标题用了 `text-gray-800`（违反设计系统"用 zinc 不用 gray"）。统一改为：

```jsx
<div className="mb-3 flex items-baseline justify-between md:mb-6">
  <h2 className="text-base font-semibold font-display text-zinc-900 dark:text-zinc-50 md:text-lg">
    {/* 区标题，如「继续你的学习」「精选频道」 */}
  </h2>
  {/* 可选：右侧「全部 →」链接，跳对应 tab 路由 */}
  <Link href="/watch" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
    全部 <span aria-hidden>→</span>
  </Link>
</div>
```

- 副标题（旧"按这个顺序走，会更轻松一点"）移动端可保留为 `mt-1 text-xs text-zinc-500 dark:text-zinc-400`，但建议精简一行或省略，避免堆字。

---

## 2. Hero 区（移动端精简）

> 桌面 `HomeHero` 完全保留。移动端给一套精简形态：**矮、轻、一个主 CTA**。两种做法二选一，推荐 **做法 A**（改 `HomeHero.tsx` 内部加响应式类，单组件、不新建文件）。

### 2.1 做法 A（推荐）：在 `HomeHero.tsx` 内做响应式精简

**`HomeHero` 是各页可能复用的 client 组件**——本票只动它的尺寸/间距/可见性类，不动文案逻辑结构。具体改动：

1. **外层 section 高度与内边距**（移动端矮、桌面不变）：
   - 旧：`min-h-[460px] flex items-center p-8 sm:p-16 mb-16`
   - 新：`min-h-[240px] md:min-h-[460px] flex items-center p-6 sm:p-8 md:p-16 mb-8 md:mb-16`
   - 即移动端 `min-h-[240px]`、`p-6`、`mb-8`；桌面经 `md:` 恢复 460/16/16。

2. **粒子背景移动端关闭**（性能 + 克制）：
   - `ParticleBackground` 外面包一层 `<div className="hidden md:block">` 或给组件传 `disabled`/不渲染。移动端 Hero 用纯净背景即可（见下 §2.3 背景）。
   - 若 `ParticleBackground` 不便条件渲染，则用 `className="pointer-events-none hidden md:block"` 包裹其容器。

3. **大标题字号阶梯**（移动端别上 6xl）：
   - 旧：`text-4xl sm:text-5xl lg:text-6xl`
   - 新：`text-[26px] leading-tight sm:text-4xl md:text-5xl lg:text-6xl`
   - 移动端 26px（介于 2xl~3xl）足够有力、不撑爆窄屏；桌面经 `sm:/md:/lg:` 恢复。

4. **副标题与第二行说明**：移动端只留一行主副标题，隐藏冗余第二句。
   - 现有第二段 `<p className="mt-1 text-sm text-gray-400">A1 起步，在真实内容里积累词汇。</p>` 与主副标题重复 → 移动端 `hidden md:block`（且把 `text-gray-400` 改 `text-zinc-400 dark:text-zinc-500`，顺手修 gray）。
   - 主副标题 `<p>`：移动端 `text-sm`，桌面 `md:text-lg`：`mt-3 text-sm md:mt-6 md:text-lg`。

5. **CTA 按钮组**：移动端**只突出一个主 CTA**，次按钮"查看工具"在移动端隐藏（工具区移动端已移除，见 §4）。
   - 主按钮容器：`mt-6 md:mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center`
   - 主按钮（登录态/未登录态文案分流）：移动端**整宽**好按：
     ```jsx
     <Link
       href={isLoggedIn ? "/learn" : "/phonics"}
       className="inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98] hover:bg-brand-600 sm:w-auto"
     >
       {isLoggedIn ? "继续学习" : "开始学习"} <span className="ml-1" aria-hidden>→</span>
     </Link>
     ```
     - `w-full sm:w-auto`：移动端整宽（≥44px 高，`py-3.5`=14px 上下达标），桌面恢复自适应宽。
     - `active:scale-[0.98]`：移动端点按微反馈（无 hover）。
   - 次按钮"查看工具"：加 `hidden sm:inline-flex`（移动端不出现）。

6. **badge（顶部小标签）**：移动端文案过营销，换克制版（可选）：
   - 把"全新设计语言 · 极简交互体验"在移动端替换为更克制的一句，如登录态显「欢迎回来」、未登录显「面向中文母语者 · A1 起步」。实现：可加两套 span 用 `md:hidden` / `hidden md:inline-flex` 切换，或直接按 `isLoggedIn` 出文案。不强制，但别留营销腔在第一屏。

7. **登录链接**（未登录态底部"已有账号？登录"）：移动端保留，`mt-4 md:mt-5 text-sm`。

### 2.2 文案分流（登录态 / 未登录态）

`HomeHero` 已收 `isLoggedIn`，沿用：

| 元素 | 未登录 | 登录 |
|---|---|---|
| 大标题 | 西班牙语，从**听懂**开始（`听懂` 染 `text-brand-500`） | 西班牙语，从**听懂**开始（标题可不变） |
| 副标题 | 面向中文母语者的西语学习工具集，从 A1 起步。 | 欢迎回来，继续你的西语之旅。 |
| 主 CTA | 开始学习 →（`/phonics`） | 继续学习 →（`/learn`，或最近学习入口） |
| 登录链接 | 显示「已有账号？登录」 | 隐藏 |

### 2.3 移动端 Hero 背景（替代粒子，制造质感不喧宾夺主）

移动端去掉粒子后，给 Hero 卡一个**克制的品牌氛围**，避免纯白板：

- section 容器保留 `rounded-hero bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 shadow-card`（即 `shadow-hero` 改 `shadow-card`，移动端不需太重阴影；桌面可经 `md:shadow-hero` 恢复）。
- 加一层右上角翡翠柔光（CSS 渐变，纯装饰，`pointer-events-none`，移动端轻量）：
  ```jsx
  <div
    aria-hidden
    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl md:hidden"
  />
  ```
  这层只在移动端出现（`md:hidden`），桌面继续用粒子。给 Hero 一点翡翠氛围、立刻有"app 高级感"，又不违反"不堆阴影/克制"。

### 2.4 做法 B（备选，若不愿改共享 HomeHero）

在 `page.tsx` 里渲染两份：现有 `<HomeHero>` 包 `hidden md:block`，移动端单独写一个 `<MobileHomeHero>`（`md:hidden`，inline 在 page 或同文件子组件）。**缺点**：文案两处维护、易不一致。**不推荐**，除非 HomeHero 改动牵连别的页面。优先做法 A。

---

## 3. 学习路径（移动端核心引导区）

> 这是首页移动端最该想清楚的区。旧"5 张 220px 大卡竖排"在移动端 = 滚不完的网页。新目标：**一眼看清学习阶梯、轻松点进下一步，不制造进度焦虑。**

### 3.1 形态决策：横向 snap 滑轨（推荐）

5 个阶段（发音 → 课程 → 阅读 → 视频 → 对话）做成**横向滑动卡片轨道**（像 app 的"继续学习"行）。理由：

- 移动端横滑卡是原生 app 常见范式，比 5 张竖排大卡省屏、有"还有更多"的探索暗示。
- 每张卡缩小为紧凑形态，拇指横扫浏览阶梯。

> 注意：视频 `/watch`、阅读 `/lectura`、课程 `/learn` 已在底部 tab；发音 `/phonics`、对话 `/talk` 在头像侧边栏。学习路径轨道在首页的价值是**"有序引导 + 进度感（文字）"**，不是导航重复——它告诉新用户"先发音再课程再阅读"的**顺序**，这是 tab（无序并列）给不了的。所以保留有意义，但**精简卡片、去环、文字进度**。

### 3.2 轨道容器（照抄）

区标题用 §1.3。标题文案：登录态「继续你的学习」、未登录「学习路径」。轨道：

```jsx
<section className="mt-6 md:mt-16">
  {/* 区标题 §1.3，副标题移动端可省 */}
  {/* 移动端：横向 snap 滑轨；桌面：恢复原 flex-row 横排 */}
  <div
    className="
      -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2
      [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
      md:mx-0 md:snap-none md:overflow-visible md:px-0 md:gap-4 md:pb-0
    "
  >
    {learningSteps.map((step) => (
      <MobileStepCard key={step.step} {...step} />
    ))}
  </div>
</section>
```

要点：
- `-mx-4 px-4`：让轨道左右出血到屏幕边、但首卡仍与内容左对齐（移动端横滑轨经典手法）。桌面 `md:mx-0 md:px-0` 归零。
- `snap-x snap-mandatory` + 卡片 `snap-start`：滑动吸附，手感跟手。
- 隐藏滚动条：`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`。
- 桌面 `md:snap-none md:overflow-visible`：恢复原静态横排（桌面零回退；桌面那对 `→` 箭头分隔符见 §3.4）。

### 3.3 紧凑步骤卡 `MobileStepCard`（移动端形态，桌面用原 `LearningStepCard`）

> **实现建议**：不要硬塞进现有 `LearningStepCard`（它桌面 `min-h-[220px]` 太高）。给移动端一套响应式：要么改 `LearningStepCard` 加 `md:` 断点把移动端压缩，要么在 page 内写一个 `MobileStepCard` 子组件 `md:hidden`、原 `LearningStepCard` 包 `hidden md:contents`。推荐**改造 `LearningStepCard` 加响应式**（单一来源），关键差异：

移动端卡尺寸/排版（固定宽，适合横滑）：

```jsx
<Link
  href={href}
  className="
    group snap-start shrink-0 w-[140px] md:w-auto
    glass-card md:card-hover-lift
    flex flex-col rounded-card border border-zinc-200/50 dark:border-zinc-800/50
    bg-white/70 dark:bg-zinc-900/70 p-4 shadow-sm
    min-h-[150px] md:min-h-[220px] md:flex-1 md:min-w-0
    active:scale-[0.98] transition-transform md:active:scale-100
  "
  data-testid="learning-step-card"
>
  {/* 序号徽章 */}
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/50 text-sm font-bold font-display text-brand-600 dark:text-brand-400 md:h-10 md:w-10 md:text-base md:group-hover:scale-110 md:transition-transform">
    0{step}
  </div>
  {/* 标题 */}
  <h3 className="mt-3 text-sm font-semibold font-display text-zinc-800 dark:text-zinc-200 md:mt-5 md:text-base">{title}</h3>
  {/* 描述：移动端截短 2 行 */}
  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 md:mt-2 md:line-clamp-none md:min-h-[50px]">{description}</p>
  {/* 进度：移动端纯文字，无环（§0.3） */}
  {progress ? (
    <span className="mt-auto pt-2 text-[11px] font-medium text-brand-600 dark:text-brand-400">{progress}</span>
  ) : (
    <span className="mt-auto pt-2 inline-flex items-center text-[11px] font-semibold text-brand-500 md:hidden">
      去学习 <span className="ml-0.5" aria-hidden>→</span>
    </span>
  )}
</Link>
```

差异要点（实现核对）：
- 移动端卡是**整卡 `<Link>`**（拇指好点，整卡 ≥44px），桌面原卡是内部底部一个文字链接——若改 `LearningStepCard` 为整卡 Link，确认桌面视觉不破（原桌面也可整卡可点，更好）。若怕动桌面交互，则移动端用 `MobileStepCard` 整卡 Link、桌面原样。
- 移动端 `w-[140px] shrink-0 snap-start`、`min-h-[150px]`、`p-4`；桌面 `md:w-auto md:flex-1 md:min-h-[220px] md:p-6`（注意原桌面 `p-6`，上面给的是 `p-4 md:p-6`）。
- **进度环 `percentage` 移动端删除**：只渲染 `progress` 文字（`已收藏 N 词`/`已读 N 篇`）。圆环 SVG 块整段在移动端不渲染（用 `hidden md:flex` 包裹原环，或移动卡干脆不含环 DOM）。桌面端是否保留环 → 见 §0.3 / §7 开放点 3（设计建议桌面也去环，统一克制，但本票最小改动可只去移动端）。
- 移动端无 hover：`card-hover-lift` 加 `md:` 前缀（`md:card-hover-lift`），移动端用 `active:scale-[0.98]`。

### 3.4 桌面端步骤间的 `→` 分隔符

旧 page 在卡之间插了 `<span className="hidden lg:block …">→</span>`。这本就是 `hidden lg:block`（移动端不显）→ **移动端无需处理，保留原样即可**（横滑轨道里它不出现）。确认它在新的轨道容器结构里仍是 `hidden lg:block`、不破坏 `snap`/`flex` 即可。若插在 `overflow-x-auto` flex 里会占一个 flex item，移动端虽 `hidden` 不占宽，但稳妥起见可把分隔符也加 `md:`/`lg:` 仅桌面渲染（与现状一致）。

---

## 4. 工具区（移动端处理：移除 / 收敛）

> 旧工具区 = 句子拆解器 `/dissect` + 词库 `/vocab`。在 MOBILE-009 下：`/vocab`=底部 tab「语料库」，`/dissect`=头像侧边栏「拆解」。**移动端首页再列一遍 = 重复导航，违背 §0.1 的心智模型。**

### 4.1 推荐：移动端隐藏整个工具区

- 现有工具 section（`<section id="tools" …>`）整体加 `hidden md:block`：
  ```jsx
  <section className="mt-16 border-t border-gray-100 pt-10 hidden md:block" id="tools">
  ```
  （顺手把 `border-gray-100` 改 `border-zinc-100 dark:border-zinc-900`。）
- 桌面端工具区原样保留（桌面零回退）。
- 注意：`HomeHero` 的"查看工具"按钮锚点 `#tools` 在移动端已隐藏（§2.1 第 5 点），首页无悬空锚点——合规。

### 4.2 备选：移动端保留 1 个"拆解器"轻入口

若 PM 认为拆解器是首页该露出的"工具"（它不是内容流、是即用工具，放首页有 utility 价值）：移动端只保留**拆解器**一张窄卡（`/vocab` 去掉，因为它=tab）。样式复用 ToolCard，移动端整宽单列：

```jsx
{/* 仅当 PM 选备选时 */}
<section className="mt-8 md:mt-16 md:border-t md:border-zinc-100 md:pt-10 md:dark:border-zinc-900">
  <h2 className="hidden md:block ...">工具</h2>  {/* 移动端可不要独立标题，直接一张卡 */}
  <Link
    href="/dissect"
    className="group flex items-center gap-3 rounded-card border border-zinc-200/50 bg-white/70 p-4 shadow-sm active:scale-[0.98] transition-transform dark:border-zinc-800/50 dark:bg-zinc-900/70 md:hidden"
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
      {/* lucide ScanText / Wand2 图标 w-5 h-5 */}
    </div>
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">句子拆解器</h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">粘贴西语句子，看骨架词与逐词释义。</p>
    </div>
  </Link>
  {/* 桌面原 grid 工具区 hidden md:grid 保留 */}
</section>
```

**设计默认取 §4.1（隐藏）**，更干净、更"内容门面"。§7 开放点 1 请 PM 拍。

---

## 5. 精选频道视频流（移动端内容流，让首页"有东西看"）

> 这是让移动端首页**不空、像内容 app** 的关键区。旧首页其实没真渲染视频（只有隐藏 `#video-sections` 占位）。本票建议在移动端首页真渲染**一条精选视频流**（横滑），首页立刻"活"起来。**但这涉及新增 server 数据流，需 PM 确认是否本票纳入**（§7 开放点 2）。下面给两种交付层级。

### 5.1 数据（若纳入真实视频流）

- Codex1 在 `page.tsx`（server）里取**一个精选频道**（如 `curatedChannels[0]`，"Dreaming Spanish"，入门首推）的 6~8 条视频：复用现有 `fetchChannelVideos(channelId)`（已存在），`maxResults` 设 8。
- 失败/空：该区**整段不渲染**（不显示报错、不显示空骨架占位太久）。`fetchChannelVideos` 已对非 200 返回 `[]`，据此 `videos.length === 0 ? null : <section>`。
- **保留 `curatedChannels` 引用和 `#video-sections` id**（测试依赖，§0.2）——把真实视频流容器套在/挂上这个 id，或新容器 + 保留隐藏占位。**先与 Codex2 对齐 `tests/home001.test.mjs` 断言**再改 DOM。

### 5.2 区标题 + 横滑视频轨道（照抄）

```jsx
<section className="mt-8 md:mt-16" id="video-sections">
  {/* 区标题 §1.3：左「精选频道」 右「全部 →」跳 /watch */}
  <div className="mb-3 flex items-baseline justify-between md:mb-6">
    <h2 className="text-base font-semibold font-display text-zinc-900 dark:text-zinc-50 md:text-lg">精选频道</h2>
    <Link href="/watch" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
      全部 <span aria-hidden>→</span>
    </Link>
  </div>
  {/* 横滑视频轨道：复用默认形态 VideoCard（w-60 固定宽） */}
  <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
    {videos.map((video) => (
      <div key={video.id} className="snap-start shrink-0">
        <VideoCard video={video} />
      </div>
    ))}
  </div>
</section>
```

要点：
- **复用 `VideoCard` 默认形态**（`w-60 shrink-0`，自带 16:9 缩略图 + 时长徽章 + 两行标题 + 频道名）——它本就是为横滑流设计的（`shrink-0`），移动端直接用。**不新造卡。**
- `-mx-4 px-4` 出血 + `snap-x` 吸附，与学习路径轨道节奏一致（全页横滑手法统一）。
- 桌面 `md:flex-wrap md:overflow-visible`：恢复换行网格（桌面零回退；若桌面原本就没视频流，则桌面这段也是新增——确认桌面视觉，或桌面也用横滑/网格皆可，**桌面不破即可**）。
- `VideoCard` 缩略图有 placeholder 容错（`placehold.co`），缩略图缺失不崩。
- **可选**：若用 `compact` 形态做竖向列表（120×68 缩略图 + 两行标题）也行——竖列更"信息流"、横滑更"精选"。**设计推荐横滑默认形态**（精选频道=策展感）。竖列见 §5.3。

### 5.3 备选：竖向 compact 列表

若 PM 更想要"刷信息流"的竖排（而非横滑精选），用 `VideoCard` 的 `compact` 形态竖排：

```jsx
<div className="flex flex-col gap-1 md:hidden">
  {videos.slice(0, 5).map((video) => (
    <VideoCard key={video.id} video={video} compact />
  ))}
</div>
```

`compact` 卡是 `flex gap-3 ... hover:bg-gray-50`（顺手把 `hover:bg-gray-50` 在移动端无 hover、可加 `active:bg-zinc-100 dark:active:bg-zinc-800`，但属 VideoCard 共享组件改动——**若不愿动共享 VideoCard，就用 §5.2 默认横滑形态，零改 VideoCard**）。**为避免动共享组件，默认 §5.2。**

### 5.4 交付层级（给 PM 选，§7 开放点 2）

- **L1（最小，零新数据流）**：移动端首页**不渲染真实视频流**，保留隐藏 `#video-sections` 占位即可（与现状一致）。首页内容 = Hero + 学习路径轨道 + 词汇统计。**风险**：首页偏空。
- **L2（推荐）**：移动端首页渲染**一条**精选频道横滑流（§5.1+§5.2，取 `curatedChannels[0]` 8 条）。首页立刻像内容 app。**需 server 加 `fetchChannelVideos`**。
- **L3（更丰富，后续）**：多频道分区（每频道一行横滑），对标 `/watch`。**本票不做**，留后续。

---

## 6. 词汇统计 + footer（移动端安静呈现）

### 6.1 词汇统计小条（合规：静态客观，无环无焦虑）

`page.tsx` 已取 `stats`（`getVocabStats`）与 `readCount`。旧首页只把它塞进学习路径卡的进度。移动端可在视频流下方放一条**安静的统计小条**（仅登录态显示；未登录不显示，避免空数据）：

```jsx
{userId && stats ? (
  <section className="mt-8 md:mt-16">
    <div className="flex items-center justify-center gap-4 rounded-card border border-zinc-200/50 bg-white/60 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800/50 dark:bg-zinc-900/60 dark:text-zinc-400 md:hidden">
      <span>已收藏 <span className="font-semibold text-zinc-700 dark:text-zinc-300">{stats.totalSaved}</span> 词</span>
      <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
      <span>已读 <span className="font-semibold text-zinc-700 dark:text-zinc-300">{readCount}</span> 篇</span>
    </div>
  </section>
) : null}
```

合规核对：
- 纯文字、客观、低优先级 → §1 ✅ 明确允许"已收藏 89 词"这类。
- **无百分比、无进度环、无"还差 X 词达标"、无打卡** → 不违反 §1。
- 仅登录态显示，避免 0/0 空数据焦虑。
- `md:hidden`：这条小条是移动端专属（桌面统计仍在学习路径卡里，桌面零回退）。

### 6.2 footer 精简

旧 footer：`mt-16 border-t border-gray-100 pt-6 text-center text-xs text-gray-400`。移动端收紧 + 修 gray：

```jsx
<footer className="mt-8 border-t border-zinc-100 pt-6 text-center text-[11px] text-zinc-400 dark:border-zinc-900 dark:text-zinc-500 md:mt-16 md:text-xs">
  Esponal · 为中文母语者设计的西语学习平台
</footer>
```

---

## 7. 颜色 / 材质 Token 速查（本票所有新元素）

| 元素 | Light | Dark |
|---|---|---|
| 页面背景 | `bg-app`（main 已有） | globals 处理 |
| 卡片底 | `bg-white/70` / `.glass-card` | `dark:bg-zinc-900/70` |
| 卡片边框 | `border-zinc-200/50` | `dark:border-zinc-800/50` |
| 分隔线 | `border-zinc-100` | `dark:border-zinc-900` |
| 区标题 | `text-zinc-900` | `dark:text-zinc-50` |
| 描述/辅助 | `text-zinc-500` | `dark:text-zinc-400` |
| 极淡（footer/meta） | `text-zinc-400` | `dark:text-zinc-500` |
| 主操作/强调 | `bg-brand-500` / `text-brand-600` | `dark:bg-brand-500` / `dark:text-brand-400` |
| 序号徽章底 | `bg-brand-50` | `dark:bg-brand-950/50` |
| Hero 移动柔光 | `bg-brand-500/10 blur-3xl` | 同 |

**强调色只有翡翠绿 `brand`。全文禁 sky / purple。** 顺手把旧 page 里所有 `gray-*`（`text-gray-800`/`text-gray-500`/`border-gray-100`/`text-gray-400`/`bg-gray-50`）改成对应 `zinc-*`（设计系统 §1.1：用 zinc 不用 gray）——这是顺带的债务清理，**仅限移动端涉及的类**，桌面不破即可。

---

## 8. 桌面端隔离清单（血泪三戒落地，验收逐条核对）

桌面端（≥768px）**零回退**：

- [ ] 主容器 padding：移动 `pt-4 pb-[calc(3.5rem+safe+16px)]`，桌面 `md:pt-16 md:pb-16` 恢复原 `py-16`。
- [ ] Hero：移动 `min-h-[240px] p-6 mb-8 text-[26px]` + 无粒子 + 柔光层 `md:hidden`；桌面经 `md:` 全部恢复 460/16/16/粒子/6xl。
- [ ] 学习路径轨道：移动 `snap-x overflow-x-auto -mx-4 px-4`；桌面 `md:snap-none md:overflow-visible md:mx-0 md:px-0` 恢复原横排；`→` 分隔符仍仅桌面渲染。
- [ ] 步骤卡：移动 `w-[140px] min-h-[150px] p-4` + 无进度环 + 整卡 Link；桌面 `md:w-auto md:flex-1 md:min-h-[220px] md:p-6` 恢复。进度环移动端不渲染（桌面去留见开放点 3）。
- [ ] 工具区：默认移动 `hidden md:block`（或备选单卡 `md:hidden` + 桌面 grid `hidden md:grid`）；桌面原样。
- [ ] 视频流：若做 L2，移动 `snap-x` 横滑，桌面 `md:flex-wrap md:overflow-visible`；桌面不破。
- [ ] 词汇统计小条 `md:hidden`（桌面统计仍在卡内）。
- [ ] footer：移动 `mt-8 text-[11px]`，桌面 `md:mt-16 md:text-xs`。
- [ ] 复用 `HomeHero`（做法 A）只加响应式类，不删桌面文案/结构；`ParticleBackground` 桌面仍渲染。
- [ ] **不碰** MOBILE-009 的底部 tab / 顶栏 / 头像侧边栏 / `MobileNav` / `SiteHeader`。
- [ ] **不碰共享组件** `VideoCard`（用其现有 props）；若选 §5.3 竖列需改 VideoCard hover，则改用 §5.2 横滑避免动共享件。
- [ ] 保留 `#video-sections` id 与 `curatedChannels` 引用（测试依赖）；改 DOM 前与 Codex2 对齐 `tests/home001.test.mjs`。

---

## 9. 实现校验（给 Codex1 / Codex2）

- 设备模式 375 宽打开 `/`（登录态 + 未登录态各一次）：
  - 不触发 error boundary；首屏 Hero 矮而精、一个整宽主 CTA 拇指可达；无粒子卡顿。
  - 学习路径横滑顺滑、吸附、首卡左对齐、卡 ≥44px 可点；**无进度环、无百分比**。
  - （若 L2）精选频道横滑出真实缩略图、时长徽章、两行标题；点卡进 `/watch?v=`。
  - 词汇统计小条仅登录态显示，纯文字无环。
  - 页面底部最后一屏内容**不被底部 tab 遮挡**（底部留白生效）。
  - 中文显示正确、无乱码；文件 UTF-8。
- 桌面（≥1280）打开 `/`：与改造前**视觉一致**（Hero 460px + 粒子、5 卡横排、工具 grid、原 footer）。
- `npm test` 全绿 + `npm run build` 通过 + `lint:encoding` 通过；无 scratch 文件入仓。

---

## 10. 需 PM / 用户拍板的开放点

1. **工具区移动端去留**：设计默认**隐藏整个工具区**（§4.1，最干净，`/dissect` 在侧边栏、`/vocab` 在 tab）。备选只留"句子拆解器"单卡（§4.2，承认它是即用工具有首页价值）。→ 请 PM 选。
2. **精选视频流交付层级**：L1 不渲染（保持现状占位，首页偏空）/ **L2 渲染一条精选频道横滑（推荐，需 server 加 `fetchChannelVideos`）** / L3 多频道分区（后续）。→ 请 PM 定 L1 还是 L2（设计强烈建议 L2，否则移动端首页太空、不像内容 app）。
3. **学习路径进度环桌面去留**：移动端首页**必去环**（合规，已定）。桌面端首页是否也去环、统一改纯文字？设计建议**桌面也去环**（全站克制、避免进度焦虑灰区），但本票最小改动可仅去移动端、桌面保留。→ 请 PM 定（涉及是否动桌面）。
4. **默认落地 tab**（MOBILE-009 §11.2 遗留）：app 开门默认进哪个 tab / 还是进 `/` 首页？本票默认**保留 `/` 作为首页门面**（不删，移动端精简）。若 PM 想"开门即进视频/某 tab、首页退化或合并"，则本票方案需调整（首页是否还存在）。→ 请 PM 确认"移动端是否保留独立 `/` 首页"。
5. **学习路径区标题文案**：登录态「继续你的学习」/ 未登录「学习路径」——是否 OK？（避免"今日"/"还差"等焦虑词，已合规。）

---

## 11. 一句话总结给 Codex1

把移动端 `/` 从"网页落地页"改成"app 内容门面"：Hero 砍矮砍轻留一个整宽 CTA（改 `HomeHero` 加响应式 + 关粒子 + 翡翠柔光）；5 张学习路径卡改**横向 snap 滑轨**的紧凑卡、**去进度环**只留文字进度；工具区移动端**隐藏**（已在 tab/侧边栏）；新增**一条精选频道横滑视频流**（复用 `VideoCard`，让首页有内容）；词汇统计做成**安静纯文字小条**；全程 `md:` 隔离，桌面零回退，底部留 tab 栏空白，禁 sky、修 gray→zinc、UTF-8 防乱码。

---

## 12. PM 决议(§10 开放点)— Claude1 2026-06-03
1. **工具区移动端隐藏**(`hidden md:` 包裹)——拆解/语法已在头像侧边栏,避免重复。
2. **精选视频流纳入(L2,真实渲染)**——首页不能空;视频流走 channel 接口(WEB-019 已便宜),OK。
3. **学习路径进度环:移动端去掉,改纯文字进度**(符合禁区);**桌面本票不动**(若桌面进度环也违 UI 禁区,另开小清理票,不在本票)。
4. **保留独立 `/` 首页作内容页,不改底部 tab**(用户已定:只改内容布局)。`/` 的进入方式维持现状(logo/默认落地),本票不处理。
5. 区标题保持「学习路径」。

> PM 拍板,Codex1 照此实现;用户真机验收时若对 1/2 有异议再调。

---
## 🔁 v2 实现基准(2026-06-03,用户批准后)— 以此为准,覆盖上文视觉
之前实现"太丑"已被 Codex1 还原。**重新实现请严格照批准的模型:`docs/tickets/MOBILE-003-mockup.html`**(干净现代·极简),并遵守 `docs/tickets/MOBILE-design-language.md`。
- **去掉精选视频区**(用户定:首页不放视频流)。
- 结构:顶栏 → Hero(纯白/大标题/听懂翡翠/翡翠CTA)→ 两格统计(119词/4篇)→ 学习路径(翡翠数字徽标横滑卡)。无视频。
- 把模型的颜色/字体/间距映射到项目 Tailwind token(brand=翡翠绿、zinc 灰);桌面 `md:` 还原不回退。

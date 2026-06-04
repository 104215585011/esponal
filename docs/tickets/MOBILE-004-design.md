# MOBILE-004 — 「课程」tab `/learn` 移动端重设计（设计稿）

**更新时间**: 2026-06-03
**状态**: 设计交付（Ready for Implementation）
**作者**: UI 设计师（接替 Gemini1）
**范围**: 重做「课程」tab 的移动端（<768px）呈现：
- `src/app/learn/page.tsx`（课程总览 / 落地页，**重点**）：Hero + 统计 + 起步入口卡 + 9 单元网格。
- `src/app/learn/[slug]/page.tsx`（单元详情页，398 行）：词汇 / 句型 / 对话 / 语法 / 中西对比 / 练习的移动端排版可读性。
- `src/app/learn/foundation/page.tsx`：顺带确认移动可用，**最小改动**。

**桌面端（≥768px）零回退**——本票只加 `md:` 断点收敛移动端，桌面所有尺寸/布局经 `md:` 恢复原值。
**强调色统一翡翠绿 `brand`（#10b981），禁 sky 蓝、禁 purple。**
**不碰** 底部 tab / 顶栏 / 头像侧边栏 / `SiteHeader` / `BackLink` / `AudioButton` / `SpanishText` 等共享组件。

> 与 MOBILE-003（首页）同一套移动端语言：横滑出血轨道 `-mx-4 px-4 snap-x`、紧凑卡 `p-4 md:p-6`、区标题 `text-base md:text-lg`、`active:scale-[0.98]` 触感、底部给 tab 留白 `pb-[calc(3.5rem+safe+16px)]`、`md:` 隔离桌面、修 gray→zinc、UTF-8。本票延续，不重造。

---

## 0. 给开发（Codex1）的前置说明 — 必读

### 0.1 心智模型

`/learn` 是「课程中心」——像 app 的课程目录页。移动端职责：**开门看清"9 个单元的学习地图 + 一个起步入口"，点进任一单元后能舒服地读长内容、随时跳站内播放器。** 不堆进度焦虑、不游戏化（对照 `UI-DESIGN-CONSTRAINTS.md`）。

### 0.2 现状摸底（实现前必读）

| 事实 | 影响 |
|---|---|
| 两页都是 server component，渲染 `SiteHeader` + 主容器 `mx-auto max-w-app-shell px-4 py-10/py-8`。 | 移动端 `py-10`/`py-8` 开门偏空，且**底部没给底部 tab 留白**（最后一屏被 tab 盖住，违反 MOBILE-009 §3.3）。统一改 §1.1。 |
| 总览 Hero：`rounded-hero` 翡翠渐变 + `px-6 py-8`，内含 3 列统计 `grid-cols-3`（单元数 / A1-A2 / Audio）。 | 移动端渐变可留但收紧高度；统计条移动端做成轻量行（§2）。 |
| 总览 9 单元网格：`grid md:grid-cols-2 xl:grid-cols-3 gap-5`，移动端默认单列。单卡含序号、标题、titleEs、level badge、时长、推荐视频名、coreVerbs chips、3 条目标、"进入单元"。 | 移动端单列已对，但**单卡信息过载**（chips + 3 条目标 + 视频名 → 太长，9 张滚动疲劳）。改紧凑卡 §3。 |
| 起步入口卡：amber 横卡 `flex-col sm:flex-row`，已是整卡 `<Link>`。 | 移动端基本可用，微调触感/间距 §2.3。 |
| 详情页桌面有 `lg:block` 左侧 `w-56` sticky 锚点导航（`sectionAnchors`）。 | 移动端 `hidden lg:block` 已隐藏 → 移动端**没有章节跳转**。建议补一条移动端横滑锚点条 §5.1（可选，PM 拍）。 |
| 详情页词汇卡 `grid md:grid-cols-2 xl:grid-cols-3`，移动端单列，整卡含 `SpanishText`（点词查词）+ `AudioButton`。 | 移动端单列已对，间距收紧即可（§5.3）。 |
| 详情页句型用 `grid md:grid-cols-[1.1fr_1fr_auto]`（西/中/音频三列）。 | **移动端三列挤成一坨**，西语句、中文、喇叭横向压扁不可读。改移动端竖向堆叠 §5.4。 |
| 详情页对话：speaker A=`brand`，**speaker B=`sky`**（`bg-sky-100 text-sky-700`）。 | **违反"禁 sky"**（`UI-DESIGN-CONSTRAINTS` 全站翡翠）。本票顺手把 B 改非 sky 中性/暖色（§5.5）。 |
| 详情页"中西对比"区：标题 `text-sky-700`、卡片 `border-sky-100 bg-sky-50`、表格 `[&_td]:border-sky-100`。 | **整块 sky**，违反禁色。本票改 zinc 中性（§5.6）。 |
| 语法表 `overflow-x-auto`，已能横向滚。练习是 `<details>` 折叠。底部"推荐视频"`grid md:grid-cols-[280px_1fr]`，上一/下一单元导航。 | 移动端基本可用，间距/触感微调（§5.7）。 |

### 0.3 禁区合规（本票）
- 不做进度环 / 百分比 / streak / "今天还差 X"。单元卡**不加**任何"完成度/已学 N/N"。`durationMin`（"约 X 分钟"）是客观静态信息 → 允许（§1 ✅）。
- 不做完成 ✓ 勾标在单元卡上（暗示"这个单元死了"，§3 禁区）。学习目标区里原有的 ✓ 是"目标清单"语义，保留。
- 文案中文优先、正确中文（项目踩过乱码坑，文件 UTF-8）。

### 0.4 复用既有 token / 工具类
`bg-app`、`brand-*`、`zinc-*`、`amber-*`（仅起步卡，沿用现状）、`shadow-card|hero|sm`、`.glass-card`、`.card-hover-lift`、`rounded-card|surface|hero`、`font-display`（标题/数字）、`font-sans`（正文）。触摸目标 ≥44px。**不写死 hex、不发明字号**（用阶梯：详情页正文阅读用 `text-sm/base/lg`）。

---

## 1. 全局：主容器与节奏（两页都改，照抄）

### 1.1 主容器 padding（给底部 tab 留白 + 收紧首屏）

**总览页**当前：`<div className="mx-auto max-w-app-shell px-4 py-10 sm:px-6 lg:px-8">`
**详情页**当前：`<div className="mx-auto flex max-w-app-shell gap-8 px-4 py-8 sm:px-6 lg:px-8">`

两页统一把 `py-*` 拆成响应式，并加底部 tab 留白：

```jsx
/* 总览页 */
<div className="mx-auto max-w-app-shell px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10 lg:px-8">

/* 详情页（保留 flex gap-8 给桌面侧栏） */
<div className="mx-auto flex max-w-app-shell gap-8 px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-8 lg:px-8">
```

- 移动：`pt-5`/`pt-4`（顶栏下方起）、底部 `pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)]`（3.5rem = 底部 tab `h-14` + 安全区 + 16px 呼吸）。
- 桌面：`md:py-10`/`md:py-8` 恢复原 `py-10`/`py-8`，**桌面零回退**。

### 1.2 区块/区标题节奏（移动端收紧）
- 单元详情页各 section 现用 `mt-8`/`mt-10` → 移动端收到 `mt-7`，桌面恢复：`className="mt-7 md:mt-10"`（goals 区是 `mt-8` → 改 `mt-6 md:mt-8`）。
- 区标题（"核心词汇""句型"等）`h2` 现 `text-2xl` → 移动端略小、桌面恢复：`text-xl md:text-2xl`。上方小写英文标签 `text-xs ... tracking-[0.2em]` 保留不变。

### 1.3 区标题统一组件式样（移动端用到处）
延续 MOBILE-003 §1.3，移动端区标题：
```jsx
<h2 className="text-base font-semibold font-display text-zinc-900 dark:text-zinc-50 md:text-lg">…</h2>
```
（仅用于总览页区标题；详情页保留其"英文小标签 + 中文 h2"的现有双层结构，按 §1.2 缩放。）

---

## 2. 课程总览 — Hero 区（移动端收紧）

桌面渐变 Hero 完全保留。移动端给一套矮、轻的形态。**直接在现有 section 上加 `md:` 断点，不新建组件。**

当前外层：
```jsx
<section className="rounded-hero bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-6 py-8 text-white shadow-hero sm:px-8">
```
改为（移动收紧内边距 + 阴影减轻）：
```jsx
<section className="rounded-hero bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-5 py-6 text-white shadow-card sm:px-8 md:py-8 md:shadow-hero">
```

### 2.1 Hero 文案区
- 顶部小标签 `Esponal Curriculum`：移动端字号不变（`text-sm`），保留。
- 大标题当前 `text-3xl sm:text-4xl` → 移动端略收：`text-2xl leading-snug sm:text-4xl`。标题文案"9 个单元，从打招呼一路走到真实交流。"保留。
- 副标题段当前 `text-sm sm:text-base`：移动端保留 `text-sm`，但 `line-clamp-3` 防止过长占屏：在该 `<p>` 加 `line-clamp-3 md:line-clamp-none`。

### 2.2 统计条（移动端轻量行，桌面恢复卡片）
当前统计是右侧 `grid grid-cols-3 ... rounded-2xl bg-white/10 p-4`（单元 / A1-A2 / Audio）。桌面 `lg:flex-row` 时在右侧；移动端它堆在标题下方、`p-4` 偏重。

移动端把它做成**一条贴合的轻量行**（仍在 `bg-white/10` 容器内，去重内边距）：
```jsx
<div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-white/10 dark:bg-black/20 p-3 text-sm text-brand-50 backdrop-blur md:mt-0 md:p-4">
  {/* 三个统计项不变；数字 text-2xl 移动端可保留，密度可接受 */}
</div>
```
- 仅把 `p-4`→`p-3 md:p-4`、外层包裹的 `mt-4`（移动端给标题下间距）→ `md:mt-0`（桌面 `lg:items-end` 时归零，避免错位）。
- 数字仍 `text-2xl font-display`，移动端三栏并排（屏宽 375 足够，每栏约 100px）。
- **无进度/百分比**——这三项是"单元数 / 难度 / 跟读"客观信息，合规。

---

## 2.3 起步入口卡（amber 横卡，微调）

当前已是整卡 `<Link>`、`flex-col sm:flex-row`、`mt-6`。移动端微调：
- 外层 `mt-6` → `mt-5 md:mt-6`；加触感 `active:scale-[0.99] transition-transform md:active:scale-100`。
- 右侧"开始 →"在移动端 `flex-col` 下当前 `self-end`，已可用；保留。
- 序号圆"7" `h-12 w-12` 已 ≥44px，整卡可点，合规。
- 顺手：amber 系为"起步特例色"，**沿用现状**（非 sky/purple，符合禁色；起步卡用 amber 与单元卡 brand 做语义区分是设计意图，保留）。

---

## 3. 课程总览 — 9 单元网格（移动端核心）

> 移动端默认单列（现状 `grid` 无 `grid-cols-1` 显式声明，但 `md:grid-cols-2` 之前即单列，正确）。问题是**单卡太长**：序号+标题+titleEs+level+时长+视频名+verb chips+3 条目标+进入。9 张竖排 = 滚到累。**移动端精简单卡为"扫读卡"**，把次要信息收起，桌面经 `md:` 恢复完整卡。

### 3.1 网格容器
当前：
```jsx
<section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
```
改为（移动端单列、间距收紧）：
```jsx
<section className="mt-7 grid grid-cols-1 gap-3 md:mt-8 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
```

### 3.2 单元卡（移动端紧凑形态 + 桌面完整）
对现有卡（`page.tsx` L70–119）逐块加 `md:` 控制移动端可见性，**结构不变、只加类**：

**外层 Link**：
```jsx
<Link
  className="group flex flex-col rounded-card border border-brand-100 dark:border-brand-900/40 bg-white/70 dark:bg-zinc-900/70 p-4 glass-card shadow-sm transition-transform active:scale-[0.99] md:rounded-hero md:p-5 md:card-hover-lift md:active:scale-100 hover:border-brand-300 dark:hover:border-brand-700/50"
  href={`/learn/${unit.slug}`}
  key={unit.id}
>
```
- 移动 `rounded-card p-4`，桌面 `md:rounded-hero md:p-5`（恢复原）。
- 移动 `active:scale-[0.99]`，桌面 `md:card-hover-lift md:active:scale-100`。

**头部（序号 + 标题 + level badge）** — 移动端保留：
- `Unidad {number}` 小标签：保留不变。
- 标题 `h2` 当前 `text-2xl` → 移动端收：`text-xl md:text-2xl`。
- `titleEs`（`text-sm text-zinc-400`）：移动端保留单行 + 截断 `truncate`。
- level badge：保留。

**时长 + 推荐视频名行**（L89–93）— 移动端保留但视频名截断：
- 容器 `mt-5` → `mt-3 md:mt-5`。
- 视频名已 `line-clamp-1`，保留。

**coreVerbs chips**（L95–104）— **移动端隐藏，桌面恢复**：
```jsx
<div className="mt-5 hidden flex-wrap gap-2 md:flex">…chips…</div>
```
（移动端扫读不需要动词标签，降噪；桌面信息密度无妨。）

**3 条 communicativeGoals 列表**（L106–113）— **移动端只显 1 条 + 截断，桌面 3 条**：
```jsx
<ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:mt-5">
  {unit.communicativeGoals.slice(0, 3).map((goal, i) => (
    <li
      className={`flex gap-2 items-start ${i === 0 ? "" : "hidden md:flex"}`}
      key={goal}
    >
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 dark:bg-brand-600" />
      <span className="line-clamp-1 md:line-clamp-none">{goal}</span>
    </li>
  ))}
</ul>
```
- 移动端：只第 1 条目标，单行截断 → 卡片高度可控、9 张扫读快。
- 桌面：3 条全显、不截断（原样）。

**"进入单元"行**（L115–118）— 保留，移动端用 `mt-auto` 贴底对齐（卡 `flex flex-col` 后底部对齐统一）：
```jsx
<div className="mt-4 flex items-center justify-between text-sm font-semibold text-brand-500 md:mt-6 md:hover:text-brand-600">
  <span>进入单元</span>
  <span className="transition group-hover:translate-x-1 duration-300 transform">→</span>
</div>
```

> 结果：移动端单元卡 ≈ 序号 + 标题 + 英文名 + 时长/视频 + 1 条目标 + 进入箭头，高度紧凑、9 张可快速扫读；桌面完整卡（chips + 3 目标）零回退。

### 3.3 空态（课程加载中）
现有 `EmptyState`（`kind="empty"`，"课程内容加载中" / "请稍后刷新"）保留，移动端 `EmptyState` 共享组件不动。仅确保它在 `pt-5` 容器内垂直留白舒适（如需移动端上间距可在其外层加 `mt-7 md:mt-8`，与网格一致）。

---

## 4. （总览页 完）→ 单元详情页

---

## 5. 单元详情页（移动端排版）

桌面布局：左 `w-56` sticky 锚点栏（`hidden lg:block`，移动端不显）+ 右内容。移动端只有右内容主流。

### 5.1 移动端章节锚点条（可选，PM 拍 — §7 开放点 1）
移动端没有桌面那条 sticky 章节导航 → 长页面跳转不便。建议在 Hero 下方加**一条横滑章节 chip 条**（复用 `sectionAnchors` 数据，锚点跳转），仅移动端显示：
```jsx
{/* 仅移动端：横滑锚点条，紧贴 Hero 下 */}
<nav
  aria-label="章节导航"
  className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden"
>
  {sectionAnchors.map((s) => (
    <a
      key={s.id}
      href={`#${s.id}`}
      className="shrink-0 rounded-full border border-zinc-200/70 bg-white/70 px-3.5 py-2 text-xs font-medium text-zinc-600 transition active:scale-95 dark:border-zinc-800/60 dark:bg-zinc-900/70 dark:text-zinc-400"
    >
      {s.label}
    </a>
  ))}
</nav>
```
- `-mx-4 px-4` 出血轨道（与全站横滑一致）；chip `py-2` 高度约 36px，可接受（纯导航非主操作；若要严格 ≥44px 改 `py-2.5`）。
- `lg:hidden`：仅在桌面侧栏出现的断点（`lg`）以下显示，桌面 `lg` 起用左侧栏。
- 注意 `sectionAnchors` 里"中西对比"`compare` 锚点对应区块改色后仍存在（§5.6），锚点不动。

> 默认**纳入**这条（长内容页章节跳转价值高、不违禁区）。PM 若嫌多可去（§7-1）。

### 5.2 详情页 Hero（移动端收紧）
当前 `rounded-hero ...gradient... px-6 py-8 shadow-hero sm:px-8`，内含右侧 `min-w-[220px]` 统计卡（时长/词汇组/Audio）。
- 外层：`px-5 py-6 shadow-card sm:px-8 md:py-8 md:shadow-hero`（同总览 §2）。
- 大标题 `text-3xl sm:text-4xl` → `text-2xl leading-snug sm:text-4xl`。
- 右侧统计卡 `min-w-[220px] ... sm:grid-cols-3`：当前在移动端是 `grid-cols-1`（竖排 3 行）占高。改移动端 3 列横排轻量：
  ```jsx
  <div className="mt-4 grid w-full grid-cols-3 gap-3 rounded-hero bg-white/10 dark:bg-black/20 p-3 text-sm text-brand-50 backdrop-blur sm:mt-0 sm:min-w-[220px] sm:grid-cols-3 md:p-4">
  ```
  - 移动端 `w-full grid-cols-3 p-3`（横排，与总览统计条一致），数字 `text-xl` 不变；桌面 `sm:min-w-[220px]` 恢复。
- `flex-wrap items-start justify-between` 外层不变（移动端自动换行：标题块上、统计条下）。

### 5.3 核心词汇（移动端单列，间距收紧）
当前 `grid md:grid-cols-2 xl:grid-cols-3 gap-4`，移动端已单列。微调：
- 网格 `gap-4` → `gap-3 md:gap-4`。
- 词汇组之间 `space-y-8` → `space-y-6 md:space-y-8`。
- 单卡 `rounded-surface ... p-5` → `p-4 md:p-5`；加触感（卡本身非链接但含 `AudioButton`/`SpanishText` 交互，保持 `card-hover-lift` 仅桌面）：`glass-card shadow-sm md:card-hover-lift`。
- 卡内 `es`（`text-lg` via `SpanishText`）+ `zh` + `AudioButton` 横向布局现为 `flex items-start justify-between gap-3`，移动端可用（喇叭在右上）。`AudioButton` 共享组件**不动**，确认其点击区 ≥44px（若不足由其内部负责，不在本票）。

### 5.4 句型（移动端竖向堆叠 — 重点修复）
当前每条 `grid gap-3 py-4 md:grid-cols-[1.1fr_1fr_auto]`（西/中/喇叭三列）。**移动端三列挤压不可读** → 移动端竖向堆叠：
```jsx
<div className="flex flex-col gap-2 py-4 md:grid md:grid-cols-[1.1fr_1fr_auto] md:gap-3 md:items-center" key={…}>
  {/* 西语句 + 喇叭同一行（喇叭右对齐），中文另起一行 */}
  <div className="flex items-start justify-between gap-3 md:contents">
    <div className="min-w-0 text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display">
      <SpanishText … />
    </div>
    {/* 喇叭：移动端跟在西语句右侧；桌面 md:contents 还原到第三列 */}
    <div className="shrink-0 md:order-last md:justify-self-end">
      <AudioButton label={item.es} src={item.audioSrc} />
    </div>
  </div>
  <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.zh}</div>
</div>
```
要点：
- 移动端：第一行=西语句（左）+ 喇叭（右），第二行=中文释义。竖向可读。
- 桌面：外层 `md:grid md:grid-cols-[1.1fr_1fr_auto]` + 内层 `md:contents`（让包裹层"透明化"，三个孙节点落回 grid 三列）→ **桌面三列布局零回退**。
- `md:contents` 是关键技巧：移动端用 flex 包裹西语+喇叭，桌面 `display:contents` 取消该包裹的盒子，孙节点直接参与父 grid。Codex1 实现后务必桌面核对三列对齐。
- 若 `md:contents` 实现风险高，备选：移动端/桌面各写一份（移动 `md:hidden` 竖排、桌面 `hidden md:grid` 原三列），但重复 DOM——**优先 `md:contents`**。
- 组容器 `space-y-6` → `space-y-5 md:space-y-6`；组卡 `p-6` → `p-4 md:p-6`。

### 5.5 对话（修 sky → 改色 + 移动端排版）
**禁色修复（必做）**：speaker B 当前：
```jsx
: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400"
```
改为中性（A=brand 强调，B=中性区分，符合"全站翡翠 + 中性"）：
```jsx
: "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300"
```
（A 保持 `bg-brand-100 ... text-brand-700`，两个说话人靠 brand vs 中性区分，不引入第二强调色。）

移动端排版：
- 对话卡 `p-6` → `p-4 md:p-6`；卡间 `space-y-6` → `space-y-5 md:space-y-6`。
- 卡头 `flex-wrap items-center justify-between`：移动端"播放全部"按钮可能换行 → 给标题块 `min-w-0`，按钮 `shrink-0`，并加触感 `active:scale-95 transition md:active:scale-100`。按钮 `px-4 py-2` 高约 36px → 移动端提到 `py-2.5`（≥44px 友好）：`px-4 py-2.5 md:py-2`。
- 每行台词卡 `px-4 py-4` 保留；`es`（`SpanishText`）+ 喇叭横排（`flex items-start justify-between gap-3`）移动端可用。

### 5.6 中西对比（整块去 sky → zinc 中性，必做）
当前整块 sky：标签 `text-sky-700`、卡 `border-sky-100 bg-sky-50/80`、表格 `[&_*]:border-sky-*`。**全改中性灰**（这是"对比说明"信息块，用中性即可，不需第二色）：

- 英文小标签：`text-sky-700 dark:text-sky-400` → `text-zinc-500 dark:text-zinc-400`（与其它区英文标签的 brand 不同，这里用中性以示"参考资料"性质；若 PM 想与其它区一致用 brand 也可，§7-2）。
- 卡片：
  ```jsx
  <article className="rounded-hero border border-zinc-200/50 bg-zinc-50/70 dark:border-zinc-800/50 dark:bg-zinc-900/40 p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 shadow-sm md:p-6" key={card.title}>
  ```
- 表格内联 class：把 `[&_td]:border-sky-100 dark:[&_td]:border-sky-950 ... [&_th]:border-sky-100 ...` 中的 `sky` 全替换为 `zinc`：`[&_td]:border-zinc-200 dark:[&_td]:border-zinc-800 [&_th]:border-zinc-200 dark:[&_th]:border-zinc-800`。其余 `dangerouslySetInnerHTML` 内容不动。
- 容器 `overflow-x-auto` 保留（表格移动端可横滚）。区外层 `mt-10` → `mt-7 md:mt-10`。

### 5.7 语法 / 练习 / 推荐视频 / 上下单元（移动端微调）

**语法**：
- 卡 `p-6` → `p-4 md:p-6`；卡间 `space-y-6` → `space-y-5 md:space-y-6`。
- 变位表已 `overflow-x-auto`（移动端横滚），保留。表头/单元格 `px-4 py-3` 移动端可接受，不改。
- `card.verb` 标题 `text-2xl` → `text-xl md:text-2xl`；旁边 titleZh `text-base` 移动端可换行，保持。

**练习**（`<details>` 折叠）：
- 折叠卡 `p-6` → `p-5 md:p-6`；`summary` 是整行可点（`flex justify-between`），≥44px，移动端友好，保留。
- 答案块 `rounded-2xl ... p-4` 保留。区间 `space-y-4` 保留。

**推荐视频**（站内跳转 `/watch?v=`）：
- 当前 `grid md:grid-cols-[280px_1fr]`，移动端已单列（缩略图上、文案下），正确。
- 缩略图 `aspect-video` 移动端整宽，保留。
- "去观看 →"按钮 `px-6 py-3` 已 ≥44px；移动端整宽更好按：`inline-flex w-full justify-center md:w-fit md:justify-start`，并加 `active:scale-[0.98] md:active:scale-100`。
- 区卡 `p-6` → `p-5 md:p-6`。

**上一个 / 下一个单元导航**：
- 当前 `flex-col sm:flex-row justify-between`，移动端竖排两个整宽按钮，已可用。
- 给两个按钮（含 disabled span）加移动端整宽：`w-full text-center sm:w-auto`，并给可点的加 `active:scale-[0.98] transition sm:active:scale-100`。`px-6 py-3` ≥44px 达标。
- `BackLink`（"课程"）共享组件**不动**。

---

## 6. foundation 起步页（最小改动，确认移动可用）
- 主容器同 §1.1：`px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10 lg:px-8`（替换现 `py-10`）。
- lesson 网格 `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`，移动端已单列；`day===1` 的 `lg:col-span-2` 仅桌面生效，移动端无碍，保留。
- lesson 卡 `p-6` → `p-5 md:p-6`，加 `active:scale-[0.99] transition-transform md:active:scale-100`。
- 底部"句子拆解器"入口卡：`active:scale-[0.99]` 触感即可。其余不动。
- 标题区 `mt-4`/`mt-8` 节奏移动端可保留（foundation 内容少，不挤）。

---

## 7. 颜色 / 材质 Token 速查（本票所有元素）

| 元素 | Light | Dark |
|---|---|---|
| 页面背景 | `bg-app`（main 已有） | globals |
| 卡片底 | `bg-white/70` / `.glass-card` | `dark:bg-zinc-900/70` |
| 卡片边框（单元卡） | `border-brand-100` | `dark:border-brand-900/40` |
| 卡片边框（通用） | `border-zinc-200/50` | `dark:border-zinc-800/50` |
| 分隔线 | `border-zinc-100` | `dark:border-zinc-900` |
| 区标题 | `text-zinc-900` | `dark:text-zinc-50` |
| 描述/辅助 | `text-zinc-500` | `dark:text-zinc-400` |
| 极淡（meta） | `text-zinc-400` | `dark:text-zinc-500` |
| 主操作/强调 | `bg-brand-500` / `text-brand-600` | `dark:bg-brand-500` / `dark:text-brand-400` |
| Hero 渐变 | `from-brand-600 via-brand-500 to-brand-400`（保留） | 同 |
| 起步卡（特例） | `amber-*`（沿用现状） | `dark:amber-*` |
| 对话 speaker A | `bg-brand-100 text-brand-700`（保留） | `dark:bg-brand-950/60 dark:text-brand-400` |
| **对话 speaker B（改）** | `bg-zinc-100 text-zinc-600` | `dark:bg-zinc-800/60 dark:text-zinc-300` |
| **中西对比块（改 sky→zinc）** | `bg-zinc-50/70 border-zinc-200/50` | `dark:bg-zinc-900/40 dark:border-zinc-800/50` |

**强调色只有翡翠绿 `brand`；amber 仅限起步线特例（语义区分，非强调）。全文禁 sky / purple。** 本票顺手清掉详情页两处 sky（对话 B + 中西对比），这是禁色债务的必清项。

---

## 8. 桌面端隔离清单（血泪三戒落地，验收逐条核对）

桌面（≥768px，部分 ≥1024px）**零回退**：
- [ ] 两页主容器：移动 `pt-* pb-[calc(3.5rem+safe+16px)]`，桌面 `md:py-10`/`md:py-8` 恢复。
- [ ] 总览 Hero：移动 `px-5 py-6 shadow-card text-2xl`；桌面 `md:py-8 md:shadow-hero` + `sm:text-4xl` 恢复。统计条移动 `p-3`，桌面 `md:p-4` + `lg:items-end` 不错位。
- [ ] 单元卡：移动 `p-4 rounded-card` + 隐藏 chips + 1 条目标 + `active:scale`；桌面 `md:p-5 md:rounded-hero` + `md:flex` chips + 3 条目标 + `md:card-hover-lift` 恢复。
- [ ] 详情页桌面左 sticky 锚点栏 `hidden lg:block` 不动；移动横滑锚点条 `lg:hidden`（若纳入 §5.1）。
- [ ] 句型：移动竖排，桌面 `md:grid md:grid-cols-[1.1fr_1fr_auto]` + `md:contents` 还原三列（**重点核对桌面三列对齐**）。
- [ ] 对话 speaker B 改中性色（A 仍 brand）；移动端按钮触感/整宽，桌面恢复。
- [ ] 中西对比：sky 全替 zinc（标签/边框/底/表格）；`dangerouslySetInnerHTML` 内容不动。
- [ ] 词汇/语法/练习/推荐视频/上下导航：移动 `p-4|p-5` + 触感 + 整宽按钮，桌面 `md:p-6` + `md:w-fit` 恢复。
- [ ] 变位表 / 对比表 `overflow-x-auto` 保留（移动端横滚不崩）。
- [ ] **不碰** 共享件：`SiteHeader` / `BackLink` / `AudioButton` / `SpanishText` / `EmptyState`；只用其现有 props。
- [ ] **不碰** MOBILE-009 底部 tab / 顶栏 / 头像侧边栏。
- [ ] 全文无 sky / purple / gray-*（用 zinc）；中文正确、文件 UTF-8。

---

## 9. 实现校验（给 Codex1 / Codex2）

375 宽设备模式：
- `/learn`：Hero 矮而精；统计条横排不溢出；起步卡可点；9 单元卡紧凑、单列、每卡 1 条目标 + 时长，扫读流畅、整卡 ≥44px 可点进 `/learn/<slug>`。
- `/learn/<任一 slug>`：Hero 收紧；（若纳入）章节 chip 条横滑可跳；词汇单列；**句型竖排可读**（西/喇叭一行、中文一行）；对话 speaker B **非 sky**；中西对比 **非 sky**、表格横滚不崩；语法变位表横滚；练习折叠开合正常；推荐视频整宽"去观看"跳 `/watch?v=`；上下单元整宽按钮；最后一屏不被底部 tab 遮挡。
- `/learn/foundation`：单列卡、底部不被 tab 遮挡。
- 不触发 error boundary；无乱码。

桌面（≥1280）：`/learn` 与 `/learn/<slug>` 与改造前**视觉一致**（Hero 460/渐变重、单元卡 2/3 列含 chips+3 目标、句型三列、左 sticky 锚点栏、对话双说话人）。**句型桌面三列对齐**重点回归。

`npm test` 全绿 + `npm run build` 通过 + 编码检查通过；无 scratch 文件入仓。

---

## 10. 一句话总结给 Codex1
把 `/learn` 移动端从"长网页"收成"app 课程目录"：两页主容器给底部 tab 留白；总览 Hero 砍矮、统计条做轻量横排、9 单元卡精简成"扫读卡"（移动端藏 verb chips、只留 1 条目标）；详情页 Hero 收紧、补一条移动横滑章节锚点、**句型从挤压三列改竖向堆叠（`md:contents` 还原桌面三列）**、**顺手清掉对话 speaker B 和中西对比两处 sky 改 zinc**、长内容卡统一 `p-4/p-5 md:p-6` + `active:scale` 触感 + 关键按钮移动端整宽；全程 `md:`/`lg:` 隔离，桌面零回退，禁 sky/purple，UTF-8 防乱码。

---

## 11. 需 PM / 用户拍板的开放点
1. **详情页移动端章节锚点条（§5.1）**：设计默认**纳入**（长内容跳转价值高、不违禁区，`lg:hidden`）。PM 若嫌增内容可去。→ 请 PM 选。
2. **中西对比英文小标签颜色（§5.6）**：去 sky 后，标签用**中性 zinc**（设计默认，示意"参考资料"性质）还是与其它区一致用 **brand**？两者都合规。→ 请 PM 选（其余 sky→zinc 改动为必做，不可选）。
3. **单元卡移动端信息取舍（§3.2）**：默认移动端**藏 verb chips + 只留 1 条目标**。若 PM 希望移动端保留全部目标（更全但更长），可改为 `slice(0,2)` 显 2 条。→ 请 PM 确认取舍。
4. **`md:contents` 句型方案（§5.4）**：若 Codex1 实测桌面三列对齐有问题，回退到"移动/桌面双份 DOM"备选。→ 实现层决定，必要时回报。

---

## 12. PM 决议(§11 开放点)— Claude1 2026-06-03
1. **详情页移动端章节锚点条:纳入**(长单元页帮助跳转)。
2. **中西对比英文小标签:去 sky 改中性 zinc**(它是"Compare"提示标签,非品牌强调动作;翡翠绿留给激活/主操作)。
3. **单元卡移动端目标条数:1 条**(扫读卡,简洁)。
4. **md:contents 句型回退:实现层决定**(Codex1 若桌面三列对齐有问题自行回退)。

**附:sky 禁色债清理纳入本票** —— 详情页 对话 speaker B + 中西对比块的 sky 全改 zinc 中性。这是全站翡翠绿统一的补漏(sky 是偏差色),属合规修正;只改颜色、不改结构,桌面外观仅颜色微变,不算回退。

> PM 拍板,Codex1 照此实现;用户真机验收时若有异议再调。

---
## 🔁 v2 视觉对齐(2026-06-03)— 覆盖上文一切视觉描述,以此为准
本设计稿的**布局/交互/范围照旧有效**,但**视觉风格统一改为「干净现代·极简」**,遵守:
- **`docs/tickets/MOBILE-design-language.md`(全站设计语言基准)**
- **`docs/tickets/MOBILE-003-mockup.html`(批准的视觉手感参照)**
要点:纯白/浅色大留白、Plus Jakarta + 思源黑无衬线、翡翠绿仅点缀(禁 sky/purple)、轻卡片(细边或软阴影二选一,别又粗边又重阴影)、数字用几何无衬线、克制。**开发前先开 v3 模型对齐手感,再照本页布局展开。** 若本页上文出现暖纸/宋体/重渐变/通用盒子等描述,一律以本设计语言覆盖。

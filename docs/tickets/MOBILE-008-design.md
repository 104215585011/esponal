# MOBILE-008 — 「语法 `/grammar`」+「句子拆解器 `/dissect`」移动端重设计（设计稿）

**更新时间**: 2026-06-04
**状态**: 设计交付（Ready for Implementation）
**作者**: UI 设计师（接替 Gemini1）
**范围**: 重做两个工具页的移动端（<768px）呈现：
- **语法** `src/app/grammar/page.tsx`（语法主题列表，74 行）+ `src/app/grammar/[slug]/page.tsx`（语法详情，262 行：中文类比 / 变位表 / 判断规则 / ser·estar 对比 / 例句 / 相关链接）。
- **拆解** `src/app/dissect/page.tsx`（薄壳，15 行）+ `src/app/dissect/DissectorClient.tsx`（句子拆解器，459 行：输入框 + 短语 chip + 逐词拆解 + 逐词对照 InterlinearGloss + 查词）。

**桌面端（≥768px）零回退**——本票只加 `md:`/`lg:` 断点收敛移动端，桌面所有尺寸/布局经断点恢复原值。
**强调色统一翡翠绿 `brand`（#10b981），禁 sky 蓝、禁 purple、禁 gray-\*（用 zinc）。**
**不碰** 底部 tab / 顶栏 / `SiteHeader` / `BackLink` / `SpanishText` / `AudioButton` / `LookupCard` / `LookupCardStack` / `GrammarTopicSelect` / `PhraseText` 等共享组件——只用其现有 props。

> 延续 MOBILE-003 / MOBILE-004 同一套移动端语言：主容器给底部 tab 留白 `pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)]`、收紧首屏 `pt-5`、紧凑卡 `p-4 md:p-6`、`active:scale-[0.98]` 触感、横滑出血轨道 `-mx-4 px-4`、`md:` 隔离桌面、修 gray→zinc、UTF-8 防乱码。本票延续，不重造。

---

## 0. 给开发（Codex1）的前置说明 — 必读

### 0.1 心智模型

`/grammar` 和 `/dissect` 都是**工具页**（不是课程流），目标用户是成人 / 学生，要的是**高效查阅 + 克制呈现**。移动端职责：
- 语法列表：单列扫读「这门语法有哪些主题」，点进任一主题。
- 语法详情：把「规则讲解 + 变位表 + 例句」在窄屏里**读得舒服**（表格不挤、例句点词能查）。
- 拆解器：**输入框整宽、不被固定顶栏 / 底部 tab 遮**，拆解结果逐词可读、点词弹查词。

不游戏化、不焦虑文案（对照 `UI-DESIGN-CONSTRAINTS.md`）。

### 0.2 现状摸底（实现前必读）

| 事实 | 影响 |
|---|---|
| 两个 grammar 页都是 server component，渲染 `SiteHeader` + 主容器 `mx-auto flex max-w-5xl gap-8 px-4 py-8`。 | 移动端 `py-8` 开门偏空，且**底部没给底部 tab 留白**（最后一屏被 tab 盖住）。统一改 §1.1。 |
| grammar 桌面有 `hidden lg:block` 左侧 `w-[220px]` 话题侧栏；移动端用 `lg:hidden` 的 `GrammarTopicSelect`（下拉）替代。 | 移动端导航已有方案（下拉），**不重造**。仅微调下拉外间距 §2.1。 |
| 列表卡（`page.tsx` L53–68）整卡 `<Link>`，含 group 标签 / 标题 / intro / `→`，已是单列 `flex flex-col gap-3`。 | 移动端基本可用，间距 / 触感微调即可 §2.2。**注意 L55 有重复 class**（`shadow-sm` 出现两次、`border-gray-100` 与 `border-zinc-200/50` 并存）→ 顺手清理 §2.2。 |
| 详情页变位表 `overflow-x-auto` + `min-w-[560px]` + sticky 首列，已能横滚。 | 移动端横滚可用，但**需补滚动提示 + 安全留白**，且 `bg-gray-50`→改 zinc §3.4。 |
| 详情页 ser/estar 对比 `grid gap-4 sm:grid-cols-2`，移动端已单列。 | 单列已对，间距收紧 §3.5。 |
| 详情页例句 / 中文类比 / 判断规则卡含 `SpanishText`（点词查词）。 | 移动端点词 → 走 MOBILE-000 底部抽屉（`SpanishText` 内部已处理，本票不动）。间距收紧 §3.3 / §3.6。 |
| grammar 多处用 `border-gray-100` / `bg-gray-50` / `from-...`（无）。 | **gray 调试债**：`border-gray-100`（L55, L93 thead, L96, L107, L153, L184, L235）、`bg-gray-50`（L93 thead, L95, L97）→ 全改 `zinc`。详见 §5。 |
| `dissect/page.tsx` 外层 `text-gray-900`（L7）。 | gray 债 → 改 `text-zinc-900` 或删（`bg-app` 已定文字色）。§4.0。 |
| `DissectorClient` 主容器 `mx-auto w-full max-w-3xl px-4 py-10`。 | 移动端 `py-10` 偏空 + 底部无 tab 留白 → §4.1。 |
| `DissectorClient` 的 `textarea` `min-h-[96px]`，下方"拆解 / 恢复示例"按钮 `flex flex-wrap`。 | 移动端**输入区基本可用**，但要确保输入时虚拟键盘 + 底部 tab 不遮（输入区在页面上方、非 sticky，安全）；按钮触感 / 触摸目标微调 §4.2。 |
| `DissectorClient` 逐词拆解：骨架词用**自写内联 popover**（L421–445，`absolute ... w-72`），内容词 / 短语用 `LookupCardStack`（`absolute left-0 top-full`）。 | **移动端痛点**：`absolute w-72` 绝对定位 popover 在窄屏会**溢出右边界 / 被裁切**。本票给 popover 一套移动端约束（不溢出、不被遮）§4.4。`LookupCardStack` 是共享件**不改**，仅约束其外层定位容器。 |
| `InterlinearGloss` 逐词对照：`flex flex-nowrap overflow-x-auto`，已横滚。 | 移动端横滚可用，补滚动提示 + 间距 §4.5。 |
| `gustar` 提示用 `text-gray-400`（L98）、`text-xs`。 | gray 债 → zinc §4.5。 |

### 0.3 禁区合规（本票）
- 语法 / 拆解都是**查阅工具**，天然无进度环 / streak / XP，合规。
- 拆解器结果行"X 词 · Y 个骨架词 · Z%"是**客观静态统计**（非学习进度焦虑）→ 允许保留（同 MOBILE-004 把"约 X 分钟"视为客观信息）。
- `InterlinearGloss` 标题"逐词对照" + 副标"AI 辅助分析"：这是**真实调用 LLM**（`/api/dissect/analyze`），按 `UI-DESIGN-CONSTRAINTS §2` 真 LLM 可标注 → **保留**，不改文案。
- 文案中文优先、正确中文（项目踩过乱码坑，文件 UTF-8）。

### 0.4 复用既有 token / 工具类
`bg-app`、`brand-*`、`zinc-*`、`amber-*`（仅短语 Badge 沿用现状）、`shadow-card|hero|sm`、`shadow-elevated`、`.glass-card`、`.card-hover-lift`、`rounded-card|surface|hero`、`font-display`（标题）、`font-sans`（正文）。触摸目标 ≥44px。**不写死 hex、不发明字号**（用阶梯 `text-xs/sm/base/lg/xl`）。

> ⚠️ **关于 MOBILE-000 的 sky**：MOBILE-000 设计稿成稿早，通篇用 `sky` 蓝。**那是已被废弃的偏差色**——现行权威是 DESIGN-SYSTEM + MOBILE-004（全站翡翠绿 `brand`）。本票引用 MOBILE-000 仅取其**底部抽屉结构 / 安全区 / 交互逻辑**，**颜色一律用 `brand`，不抄 sky**。`SpanishText` / `LookupCard` 的查词抽屉已是现行实现，本票不改它，只复用。

---

## 1. 全局：grammar 两页主容器与节奏（照抄）

### 1.1 主容器 padding（给底部 tab 留白 + 收紧首屏）

两页当前都是：
```jsx
<div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8 sm:px-8">
```
统一改（保留 flex gap-8 给桌面侧栏，移动端 `pt-5` + 底部 tab 留白，桌面 `md:py-8` 恢复）：
```jsx
<div className="mx-auto flex w-full max-w-5xl gap-8 px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-8 md:py-8">
```
- 移动：`pt-5`（顶栏下方起）、底部 `pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)]`（3.5rem = 底部 tab `h-14` + 安全区 + 16px 呼吸）。
- 桌面：`md:py-8` 恢复原 `py-8`，**零回退**。

### 1.2 区标题节奏
详情页各 `section` 现用 `mt-6`/`mt-8` → 移动端收到 `mt-6`，桌面恢复：`className="mt-6 md:mt-8"`（首个"中文类比"区现 `mt-6` 保留）。区内 `h2`（"现在时变位表"等）现 `text-xl` → 移动端保留 `text-xl`（已是合适小标题尺寸，不必再缩）。

---

## 2. 语法列表页 `/grammar`（移动端）

### 2.1 移动端话题下拉（`GrammarTopicSelect`，微调间距）
`lg:hidden` 的下拉块当前：
```jsx
<div className="mb-6 lg:hidden">
```
→ 移动端收一点上间距并与列表拉开：`className="mb-5 lg:hidden"`（其余 label / `GrammarTopicSelect` **不动**，共享件）。确认下拉控件本身高度 ≥44px（若不足由 `GrammarTopicSelect` 内部负责，不在本票范围；如实测过矮回报 PM）。

### 2.2 页头（移动端收紧）
当前 header（L44–50）：`mb-8` + 标题 `text-3xl` + 描述 `text-base`。
- 外层 `mb-8` → `mb-6 md:mb-8`。
- 标题 `text-3xl` → `text-2xl leading-snug md:text-3xl`（窄屏标题略收，桌面恢复）。
- `COURSE-002` 小标签（`text-brand-600`）保留。
- 描述段 `text-base` → 保留 `text-base`，但移动端防过长：加 `line-clamp-2 md:line-clamp-none`。

### 2.3 主题卡（移动端紧凑 + 清 gray 债）
列表容器 `flex flex-col gap-3`（L52）→ 移动端略收：`flex flex-col gap-2.5 md:gap-3`。

单卡（L55）当前 class 有**重复 / gray 债**：
```jsx
className="group rounded-xl shadow-sm border border-gray-100 bg-white/70 dark:bg-zinc-900/70 border-zinc-200/50 dark:border-zinc-800/50 p-5 glass-card card-hover-lift shadow-sm"
```
清理为（去重复 `shadow-sm`、删 `border-gray-100`、移动端 `p-4` + 触感、桌面 `md:p-5` + `card-hover-lift` 恢复）：
```jsx
className="group flex rounded-card border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card p-4 shadow-sm transition-transform active:scale-[0.99] hover:border-brand-300 dark:hover:border-brand-700/50 md:p-5 md:card-hover-lift md:active:scale-100"
```
- 整卡是 `<Link>` → 整卡可点，`p-4` 高度 ≥44px，达标。
- 卡内布局（L59–66：左文案块 + 右 `→`）**保留**；其中：
  - group 小标签 `text-xs ... uppercase tracking-wider`：保留。
  - 标题 `h2 text-lg`：保留（已是合适尺寸）。
  - `intro`（`text-sm ... text-zinc-500`）：移动端防过长加 `line-clamp-2 md:line-clamp-none`。
  - 右侧 `→`（L65）：保留 hover 平移；移动端无 hover 无碍。

> 结果：移动端主题卡 = group 标签 + 标题 + 2 行 intro + 箭头，单列紧凑扫读。

---

## 3. 语法详情页 `/grammar/[slug]`（移动端 — 重点：可读排版）

### 3.1 移动端话题下拉 + 返回
- `lg:hidden` 下拉块（L70–75）：同 §2.1，`mb-6` → `mb-5 md:mb-6`。
- `BackLink`（L77，共享件）**不动**。

### 3.2 页头（移动端收紧）
header（L79–83）：
- `mt-5 mb-6` → `mt-4 mb-6 md:mt-5`。
- 标题 `text-3xl` → `text-2xl leading-snug md:text-3xl`。
- group 小标签 / intro 保留；intro 加 `line-clamp-3 md:line-clamp-none` 防过长占屏。

### 3.3 中文类比区（移动端微调）
当前（L85–88）`border-l-[3px] border-brand-200 bg-brand-50/40 ... p-4`：
- `p-4` 移动端保留（已紧凑）。
- 这是 brand 浅底强调块，符合品牌色，**保留**。仅确认 `mt-6` 节奏与下文一致（保留 `mt-6`）。

### 3.4 现在时变位表（移动端 — 横滚 + 提示 + 清 gray）⭐
当前（L90–145）`overflow-x-auto` + `min-w-[560px]` + sticky 首列已能横滚。问题：①`bg-gray-50` / `border-gray-100` gray 债；②窄屏用户**不知道能横滑**；③表格右侧贴边。

**必做改动：**

**(a) 清 gray → zinc**（表格全部）：
- thead：`bg-gray-50 dark:bg-zinc-800/50` → `bg-zinc-50 dark:bg-zinc-800/50`。
- thead `tr` 边框 `border-gray-100 dark:border-zinc-800/80` → `border-zinc-100 dark:border-zinc-800/80`。
- sticky `th`：`bg-gray-50 dark:bg-zinc-800/50` → `bg-zinc-50 dark:bg-zinc-800/50`。
- tbody `tr` 边框 `border-gray-100` → `border-zinc-100`（L107）。

**(b) 横滚提示**（在表格容器上方加一行，仅移动端）：
区标题行改为标题 + 提示并排：
```jsx
<div className="mb-4 flex items-baseline justify-between gap-3">
  <h2 className="text-xl font-semibold font-display text-zinc-800 dark:text-zinc-200">现在时变位表</h2>
  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 md:hidden">← 左右滑动看全表</span>
</div>
```
（桌面 `md:hidden` 隐藏提示；表格不溢出无需提示。）

**(c) 滚动容器右侧留白 + 提示渐隐**（可选增强，PM 拍 §6-1）：
容器现 `overflow-x-auto rounded-xl border ...`，移动端横滚时为暗示"右侧还有内容"，可在容器加相对定位 + 右缘渐隐遮罩。**默认仅做 (a)(b)，(c) 可选**（实现成本 / 收益 PM 决定）。

**(d) sticky 首列底色**：tbody 内 sticky `td` 现 `bg-white dark:bg-zinc-900`（L108），保留——横滚时首列盖住后列，正确。

表头 / 单元格 `px-4 py-3` / `py-4` 移动端可接受，不改。`min-w-[560px]` 保留（保证列不挤）。

### 3.5 判断规则 + ser/estar 对比（移动端）
**判断规则**（L148–159）：卡 `p-4` 保留；卡间 `space-y-3` 保留；区外 `mt-8` → `mt-6 md:mt-8`。

**ser/estar 对比**（L161–177）：
- 区外 `mt-8` → `mt-6 md:mt-8`。
- `grid gap-4 sm:grid-cols-2` 移动端已单列 → 改 `grid gap-3 sm:grid-cols-2`（移动端两栏间距收一点，桌面 `sm:grid-cols-2` 仍两列）。
- `ComparisonColumn` 卡（L235）`p-5` → `p-4 md:p-5`；含 `SpanishText` 点词查词（走底部抽屉），**不动**逻辑。`border-gray-100` → `border-zinc-200/50 dark:border-zinc-800`（清 gray，与通用卡边框统一）。

### 3.6 例句（移动端）
当前（L179–204）：区 `mt-8` → `mt-6 md:mt-8`；卡 `space-y-4` 保留；单卡（L184）`p-5` → `p-4 md:p-5`，`border-gray-100` → `border-zinc-200/50 dark:border-zinc-800`。卡内 `SpanishText`（西语句，点词查 → 底部抽屉）+ 中文 + "因为：…" 竖向堆叠，**移动端天然可读，保留**。

### 3.7 相关链接（移动端）
当前（L206–218）`mt-8 space-y-2` + inline-flex chip 链接。移动端这些是小号文本链接（`text-xs`），`mr-4` 横排可换行 → 改为横滑 chip 更好按：
```jsx
<section className="mt-6 flex flex-wrap gap-2 md:mt-8" aria-label="相关语法">
  {topic.related.map((item) => (
    <Link
      className="inline-flex rounded-full border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold text-brand-600 transition active:scale-95 hover:border-brand-300 dark:border-zinc-800/60 dark:bg-zinc-900/70 dark:text-brand-400 md:active:scale-100"
      href={`/grammar/${item.slug}`}
      key={item.slug}
    >
      {item.label} →
    </Link>
  ))}
</section>
```
- 由"裸文本链接"升级为 chip：`py-2` ≈ 38px、加 `px-3` 触摸区更友好（纯导航，非主操作，可接受；若 PM 要严格 ≥44px 改 `py-2.5`）。桌面 chip 形态无碍。

---

## 4. 句子拆解器 `/dissect`（移动端 — 重点：输入不被遮 + popover 不溢出）

### 4.0 薄壳页清 gray
`dissect/page.tsx` L7 `<main className="min-h-screen bg-app text-gray-900">` → 去掉 `text-gray-900`（`bg-app` 区域文字色由各处自定，根级 gray 文字色多余且是 gray 债）：
```jsx
<main className="min-h-screen bg-app">
```
其余薄壳（`SiteHeader` + `BackLink` + `DissectorClient`）**不动**。`BackLink` 上方容器 `pt-6` 保留。

### 4.1 主容器留白（`DissectorClient` L204）
当前：
```jsx
<div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
```
改（移动端 `pt-4`、底部 tab 留白，桌面 `md:py-10` 恢复）：
```jsx
<div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10">
```
> 注：`BackLink` 在薄壳页 `pt-6` 容器里、`DissectorClient` 另起 `pt-4`，两者叠加移动端开门约 40px，可接受（顶栏 `h-16` 下方）。

### 4.2 页头 + 输入区（移动端 — 输入整宽、不被遮）⭐
**页头**（L205–211）：
- `mb-8` → `mb-6 md:mb-8`。
- 标题 `text-3xl` → `text-2xl leading-snug md:text-3xl`。
- 描述 `text-base` → 保留；加 `line-clamp-3 md:line-clamp-none`。

**输入区**（L213–291）：
- `label`（L214）保留。
- `textarea`（L217）`min-h-[96px] w-full`：已整宽、`resize-y`、非 sticky、位于页面上方 → 虚拟键盘弹起 / 底部 tab **不会遮输入框**（输入框在视口上半，键盘从下方升起时浏览器自动滚动到聚焦元素）。**结构正确，仅微调**：
  - `rounded-2xl` → `rounded-surface`（用语义 token，等价 16px）。
  - 移动端 `min-h-[96px]` 略增可视行：`min-h-[112px] md:min-h-[96px]`（窄屏多给一行，输入更舒服）。
  - 其余（边框 / focus ring brand）**保留**——已是 brand 焦点色，合规。
- 按钮行（L232 `flex flex-wrap items-center gap-3`）：
  - "拆解"主按钮（L233）`px-6 py-2.5`：高 ≈ 42px → 移动端提到 `py-3 md:py-2.5`（≥44px），并加触感 `active:scale-[0.98] md:active:scale-100`。移动端**整宽更好按**：`flex-1 sm:flex-none`（窄屏占满、`sm` 起恢复自适应宽度）。
  - "恢复示例"次按钮（L277）`px-4 py-2.5`：同样 `py-3 md:py-2.5` + `active:scale-[0.98] md:active:scale-100`；移动端 `flex-1 sm:flex-none`（与主按钮并排各占一半）。
  - 两按钮移动端并排（`flex-wrap` + 各 `flex-1`）填满一行，触摸友好；桌面恢复自然宽度。

### 4.3 拆解结果容器（移动端收紧 + 清 gray）
`section`（L293）`rounded-surface ... p-6`：
- `p-6` → `p-4 md:p-6`；`mt-8` → `mt-6 md:mt-8`。
- `data-testid="dissect-output"` **保留**（QA 依赖）。

短语 chip 区（L295–337）`flex flex-wrap gap-2`：移动端保留换行；chip 用共享 `PHRASE_HIGHLIGHT_CLASSES` **不动**。

### 4.4 逐词拆解 popover（移动端 — 不溢出、不被裁切）⭐⭐ 重点
逐词拆解（L338–449）有**两类弹层**，桌面是 `absolute top-full` 内联浮层，**窄屏会溢出右边界**：

**(A) 骨架词内联 popover**（L421–445，自写 `absolute left-0 top-full mt-2 w-72 rounded-card border ... shadow-elevated`）：
- 问题：`w-72`（288px）在 375 屏，若该词靠右，`left-0` 起的浮层会**超出右边界被裁**。
- **移动端修复**（不改内容、只改定位容器 class）：把外层浮层 div 改为响应式宽度 + 右对齐兜底：
  ```jsx
  <div className="absolute left-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] max-w-[18rem] rounded-card border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-elevated glass-card">
  ```
  - `w-[min(18rem,calc(100vw-2rem))]`：浮层宽度取「18rem」与「视口宽 -2rem（左右各 1rem 边距）」的较小值 → 窄屏自动收窄，**不溢出**。
  - 仍 `left-0`（贴目标词左缘展开）；窄屏因宽度受限不会超右界。
  - 内容（lemma / 词性 / 释义 / "→ 详见 Day N 课程"链接）**全部保留**。`getFoundationDayHref` 链接保留。
- 该 popover 内文字色已是 zinc/brand，合规，不改。

**(B) 内容词 / 短语 `LookupCardStack` 浮层**（L314–333 短语、L368–388 内容词，外层 `absolute left-0 top-full mt-2`）：
- `LookupCardStack` 是**共享件不改**，但其外层定位容器同样可能溢出。给外层加约束：
  ```jsx
  <div className="absolute left-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] max-w-sm">
    <LookupCardStack ... />
  ```
  - 让卡组容器宽度随视口收窄（`max-w-sm` ≈ 20rem 上限，窄屏取 `100vw-2rem`），`LookupCardStack` 内部卡片宽度跟随容器 → 不溢出。
  - 若 `LookupCardStack` 内部写死了固定宽度（如 `w-72`/`w-80`）导致容器约束无效 → 回报 PM/Codex（共享件，本票不改它，§6-2 开放点）。
- **可选更优方案（PM 拍 §6-2）**：移动端把内容词/短语查词也走 **MOBILE-000 底部抽屉**（与 `SpanishText` 点词一致的全局体验），而非内联浮层。但这需要 `DissectorClient` 接入 sheet 逻辑（非纯 class 改动，工作量大）→ **默认本票只做"约束浮层宽度不溢出"的最小修复**，底部抽屉化列为后续票。

> 三类点词（骨架词内联 / 内容词 stack / 短语 stack）移动端共同目标：**浮层不超出屏幕、不被底部 tab 遮**。因浮层是 `top-full` 向下展开，若目标词在末行靠近底部，浮层可能被底部 tab 压住 → 浮层已 `z-20`，底部 tab 通常 `z-40`/`z-50`，**会被 tab 盖**。缓解：结果容器底部已有 §4.1 的 `pb-[...]` 留白，末行词上方仍有空间；如实测末行 popover 被遮严重，回退到底部抽屉方案（§6-2）。

### 4.5 逐词对照 InterlinearGloss（移动端 — 横滚 + 清 gray）
（L39–106）`flex flex-nowrap overflow-x-auto` 已横滚。微调：
- 标题行（L46–49）"逐词对照" + "AI 辅助分析"：保留（真 LLM，合规 §0.3）。移动端补横滚提示，加在标题行右侧或下方：
  ```jsx
  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 md:hidden">← 左右滑动看逐词</p>
  ```
  （放在 loading/error/结果块上方、仅有结果时意义最大；简单起见可常驻 `md:hidden`，桌面隐藏。）
- 横滚轨道（L65）`gap-4 pb-2`：保留；每词块 `min-w-[3.5rem] max-w-[8rem]` 保留。
- `gustar` 提示（L98）`text-gray-400` → `text-zinc-400 dark:text-zinc-500`（清 gray）。
- 省略主语 brand 高亮（L76–80）已是 brand 色，合规，保留。
- 自然英语整句（L93–96）`text-base`：移动端保留可读。

### 4.6 统计行
（L450–452）"X 词 · Y 个骨架词 · Z%" `text-sm text-zinc-500`：客观统计，合规，保留。`mt-6` 保留。

---

## 5. gray 调试债清理清单（本票必清，全改 zinc）

| 文件 / 行 | 现状 | 改为 |
|---|---|---|
| `grammar/page.tsx` L55 | `border-gray-100` + 重复 `shadow-sm` | 见 §2.3（删 gray、去重） |
| `grammar/[slug]/page.tsx` L93 thead | `bg-gray-50` | `bg-zinc-50` |
| 同 L96 thead tr | `border-gray-100` | `border-zinc-100` |
| 同 L97 sticky th | `bg-gray-50` | `bg-zinc-50` |
| 同 L107 tbody tr | `border-gray-100` | `border-zinc-100` |
| 同 L153 规则卡 | `border-gray-100` | `border-zinc-200/50 dark:border-zinc-800` |
| 同 L184 例句卡 | `border-gray-100` | `border-zinc-200/50 dark:border-zinc-800` |
| 同 L235 对比卡 | `border-gray-100` | `border-zinc-200/50 dark:border-zinc-800` |
| `dissect/page.tsx` L7 | `text-gray-900` | 删（§4.0） |
| `DissectorClient.tsx` L98 | `text-gray-400` | `text-zinc-400 dark:text-zinc-500` |

**全文无 sky / purple / gray-\*；强调色只翡翠绿 `brand`；amber 仅短语类型 Badge 沿用现状（语义区分，非强调）。**

---

## 6. 颜色 / 材质 Token 速查（本票所有元素）

| 元素 | Light | Dark |
|---|---|---|
| 页面背景 | `bg-app` | globals |
| 卡片底 | `bg-white/70` / `.glass-card` | `dark:bg-zinc-900/70` |
| 卡片边框（通用） | `border-zinc-200/50` | `dark:border-zinc-800/50` |
| 表头底 | `bg-zinc-50` | `dark:bg-zinc-800/50` |
| 表格分隔线 | `border-zinc-100` | `dark:border-zinc-800/80` |
| 区标题 | `text-zinc-800/900` | `dark:text-zinc-200/50` |
| 辅助 / 提示 | `text-zinc-400/500` | `dark:text-zinc-500/400` |
| 主操作 / 强调 / 链接 | `bg-brand-500` / `text-brand-600` | `dark:bg-brand-500` / `dark:text-brand-400` |
| 中文类比块 | `border-brand-200 bg-brand-50/40`（保留） | `dark:bg-brand-950/20` |
| 输入框焦点 | `focus:border-brand-500 focus:ring-brand-100/50`（保留） | 同 |
| 短语类型 Badge | `amber-*`（沿用现状） | `dark:amber-*` |

---

## 7. 桌面端隔离清单（血泪三戒落地，验收逐条核对）

桌面（≥768px，部分 ≥1024px）**零回退**：
- [ ] grammar 两页主容器：移动 `pt-5 pb-[calc(3.5rem+safe+16px)]`，桌面 `md:py-8` 恢复。
- [ ] grammar 桌面左 `w-[220px]` 话题侧栏 `hidden lg:block` **不动**；移动端 `GrammarTopicSelect` 下拉 `lg:hidden` **不动**（只调外间距）。
- [ ] 列表卡：移动 `p-4` + 触感 + `line-clamp` + 清 gray；桌面 `md:p-5 md:card-hover-lift md:active:scale-100` 恢复。
- [ ] 详情页变位表 / ser·estar 表格 `overflow-x-auto` + `min-w-[560px]` **保留**（横滚不崩）；gray→zinc；补移动端横滚提示 `md:hidden`。
- [ ] ser/estar 对比 `sm:grid-cols-2` 桌面两列不变；卡 `md:p-5` 恢复。
- [ ] 相关链接 chip 化：桌面 chip 无碍（或保留原 inline-flex，二选一，§6-3）。
- [ ] dissect 主容器：移动 `pt-4 pb-[...]`，桌面 `md:py-10` 恢复。
- [ ] dissect 输入框整宽不被遮；按钮移动 `flex-1 py-3 active:scale`，桌面 `sm:flex-none md:py-2.5 md:active:scale-100` 恢复。
- [ ] dissect 三类 popover 移动端 `w-[min(...,calc(100vw-2rem))]` 不溢出；桌面 `w-72`/`max-w-sm` 宽度视觉一致。
- [ ] InterlinearGloss 横滚 `md:hidden` 提示；gray→zinc。
- [ ] **不碰** 共享件：`SiteHeader` / `BackLink` / `SpanishText` / `AudioButton` / `LookupCard` / `LookupCardStack` / `GrammarTopicSelect` / `PhraseText` / `PHRASE_HIGHLIGHT_CLASSES`；只用现有 props。
- [ ] **不碰** MOBILE-009 底部 tab / 顶栏。
- [ ] 全文无 sky / purple / gray-\*；中文正确、文件 UTF-8。

---

## 8. 实现校验（给 Codex1 / Codex2）

375 宽设备模式：
- `/grammar`：页头收紧；话题下拉可用；主题卡单列紧凑、整卡 ≥44px 可点进 `/grammar/<slug>`、intro 不溢出；最后一屏不被底部 tab 遮。
- `/grammar/<任一含变位表的 slug>`（如动词变位）：中文类比块 brand 底；**变位表左右横滑不崩、首列 sticky、有"← 左右滑动看全表"提示**；判断规则 / ser·estar 对比 / 例句单列可读；例句点词弹 **MOBILE-000 底部抽屉**；相关链接 chip 可点；无 gray 残留。
- `/dissect`：**输入框整宽、聚焦时键盘不遮**；"拆解 / 恢复示例"两按钮移动端并排整宽、≥44px、有触感；点骨架词 / 内容词 / 短语 → **浮层不溢出右边界、不被裁切**；逐词对照横滑不崩、有提示；统计行正常；无 gray 残留。
- 三页均不触发 error boundary；无乱码。

桌面（≥1280）：三页与改造前**视觉一致**（grammar 左侧栏 + 主体两栏、变位表完整、dissect 输入区 + 内联 `w-72` 浮层 + `LookupCardStack` 原位）。

`npm test` 全绿 + `npm run build` 通过 + 编码检查通过；无 scratch 文件入仓。

---

## 9. 一句话总结给 Codex1
两个工具页移动端：grammar 两页主容器给底部 tab 留白、列表卡紧凑单列、详情页变位表横滚补提示 + 清 gray、例句点词走底部抽屉；dissect 主容器留白、**输入框整宽不被键盘/tab 遮、两按钮移动端整宽 ≥44px**、**三类点词浮层用 `w-[min(18rem/20rem,calc(100vw-2rem))]` 约束不溢出窄屏**、逐词对照横滚补提示；全程清 gray→zinc、`md:`/`lg:` 隔离桌面零回退、禁 sky/purple、UTF-8 防乱码。

---

## 10. 需 PM / 用户拍板的开放点
1. **变位表横滚右缘渐隐遮罩（§3.4-c）**：默认**不做**（只做提示文字 + 清 gray）。若 PM 想要更强"右侧有更多"的视觉暗示，再加遮罩。→ 请 PM 选。
2. **dissect 内容词/短语查词移动端是否底部抽屉化（§4.4-B 可选方案）**：默认**只做浮层宽度约束**（纯 class、最小改动、不崩）；底部抽屉化（与 `SpanishText` 全局一致体验）工作量大，列为后续票。若 PM 认为内联浮层在真机体验差，可优先排底部抽屉化。→ 请 PM 选。另：若 `LookupCardStack` 内部写死固定宽度导致外层约束无效，Codex1 实测后回报（共享件本票不改）。
3. **相关链接样式（§3.7）**：默认升级为 **chip**（更好按、横滑）。若 PM 想保留原"裸文本链接"也合规。→ 请 PM 选。
4. **`GrammarTopicSelect` / `AudioButton` 等共享控件触摸高度**：本票不改共享件；若实测下拉 / 喇叭 <44px，回报 PM 另开共享件票。
```
---

## 11. PM 决议(§10 开放点)— Claude1 2026-06-03
1. **变位表右缘渐隐遮罩:不做**(横滚 + 提示文字够了)。
2. **dissect 查词:本票只做浮层宽度约束最小修复**(防窄屏溢出,纯 class);**全底部抽屉化列为后续票**(工作量大)。⚠️ 若共享 LookupCardStack 写死固定宽度致外层约束失效,Codex1 实测回报,届时再定。
3. **相关链接:chip 化**。
4. **共享控件(GrammarTopicSelect/AudioButton)触摸高度本票不改共享件**;若 <44px 另开小清理票。

> PM 拍板,Codex1 照此实现。

---
## 🔁 v2 视觉对齐(2026-06-03)— 覆盖上文一切视觉描述,以此为准
本设计稿的**布局/交互/范围照旧有效**,但**视觉风格统一改为「干净现代·极简」**,遵守:
- **`docs/tickets/MOBILE-design-language.md`(全站设计语言基准)**
- **`docs/tickets/MOBILE-003-mockup.html`(批准的视觉手感参照)**
要点:纯白/浅色大留白、Plus Jakarta + 思源黑无衬线、翡翠绿仅点缀(禁 sky/purple)、轻卡片(细边或软阴影二选一,别又粗边又重阴影)、数字用几何无衬线、克制。**开发前先开 v3 模型对齐手感,再照本页布局展开。** 若本页上文出现暖纸/宋体/重渐变/通用盒子等描述,一律以本设计语言覆盖。

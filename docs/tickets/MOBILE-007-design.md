# MOBILE-007 — 发音页 `/phonics` 移动端重设计（设计稿）

**更新时间**: 2026-06-04
**状态**: 设计交付（Ready for Implementation）
**作者**: UI 设计师（接替 Gemini1）
**范围**: 只重做发音页移动端（<768px）的**内容布局**：`src/app/phonics/page.tsx` 及其三个组件 `AlphabetGrid.tsx`（字母网格 + 规则弹层）、`PhonicsIntro.tsx`（元音/辅音/双元音介绍）、`PhonicsProsody.tsx`（重音/连读）。**导航外壳（顶栏、底部 tab、头像侧边栏）由 MOBILE-009 负责，本票一律不碰。桌面端（≥768px）零回退。**
**强调色**: 全站统一翡翠绿 `brand`（#10b981）。**禁 sky 蓝、禁 purple。**

---

## 0. 给开发（Codex1）的前置说明 — 必读

### 0.1 现状摸底（实现前必读）

| 事实 | 影响 |
|---|---|
| `page.tsx` 是 server component，渲染 `SiteHeader` + 标题区 + `PhonicsIntro` + `AlphabetGrid` + `PhonicsProsody`，主容器 `mx-auto max-w-app-shell px-4 py-10 sm:px-6 lg:px-8`。 | 本票重排各区块**移动端**呈现；server 结构（引入内容数据 `SPANISH_ALPHABET`）保留。主容器底部**没给底部 tab 留白** → 必须加（§1.2）。 |
| `AlphabetGrid` 移动端是 `grid-cols-3 gap-3`，每卡 `min-h-[196px] p-4`，含 `font-serif text-[56px]` 大字 + 字母名 + 例词 + 两个胶囊音频按钮 + "查看发音"链接。 | 27 个这样的高卡在窄屏 = 极长滚动（≈9 行 × 196px ≈ 1764px 仅网格）。**移动端要大幅压扁**（§2）。两个并排胶囊按钮在 `grid-cols-3` 的窄列里会换行挤压、文字截断。 |
| `AlphabetGrid` 已有底部抽屉式规则弹层（`renderRuleModal`，`fixed inset-0 ... items-end ... rounded-t-card`），移动端已是 bottom-sheet 形态，桌面 `sm:items-center` 居中。 | 弹层形态已对路，本票**微调**（拖拽手柄、安全区、关闭区 ≥44px、滚动锁定，§2.4），不重写。 |
| `font-serif` 在字母大字与弹层标题使用。设计系统只登记 `font-sans`(Inter) / `font-display`(Outfit)，`font-serif` 是 globals 里的额外族。 | **保留现状 `font-serif`**（字母作为"字形展示"用衬线体有理据，全站 phonics 已统一用它），本票不改字体族，避免牵动视觉基线。 |
| `PhonicsIntro` 元音 chip 用 `flex flex-wrap`，强/弱元音双列 `lg:grid-cols-2`，双元音 `sm:grid-cols-3`。chip 高 `h-9`（36px）。 | 移动端 chip **高度 36px < 44px 触摸目标**，需提到 ≥44px（§3）。双列在移动端是单列堆叠，OK；双元音单列堆叠 OK。 |
| `PhonicsProsody` 用 `max-w-3xl`、`rounded-card bg-gray-50`、`text-gray-900/600/500/400`、`border-gray-200/100`，音频按钮 `h-9`（36px）。 | **大量 `gray-*` 违反设计系统（用 zinc 不用 gray）**，本票顺手全改 `zinc-*`（§4）。按钮 36px → ≥44px。重音示例 `sm:grid-cols-2` 移动端单列 OK。 |
| 三个组件各自有独立 `useRef<HTMLAudioElement>` + `playingKey` 播放逻辑（互不打断对方）。 | 本票**不动播放逻辑**，只动布局/样式/触摸尺寸。 |

### 0.2 禁区合规（对照 `UI-DESIGN-CONSTRAINTS.md`）

发音页是纯教学内容页，天然不涉及游戏化。核对：

- **无打卡/streak/XP/进度环/百分比** — 现状没有，本票不引入。✅
- **无"今天还差""倒计时"焦虑文案** — 标题区 `27 个字母 · 听一遍，就开始` 是中性引导，保留。✅
- **不要伪 AI 标签** — 不加 ✨/"AI"。✅
- **中文母语者第一** — 所有说明中文优先，西语作为目标语言出现；字母名/例词保留西语。✅ 文件存 **UTF-8**，防乱码（项目踩过坑）。
- **Ñ「西语独有」徽标** — 是客观事实标注，非游戏化，保留。✅
- **`hasRules` 的 `animate-pulse` 绿点**：现状给有规则的字母卡右上角一个 `animate-pulse` 常驻呼吸点。设计系统 §6.2 列"自动循环呼吸/闪烁（除非 loading）"为不允许动效。→ **本票移除 `animate-pulse`**，改为**静态**小圆点（见 §2.3），既守动效规范又保留"可展开"暗示。

### 0.3 复用既有 token / 工具类（不要重造）

`bg-app`、`bg-surface`、`brand-*`、`zinc-*`、`shadow-card|elevated|hero`、`.glass-card`、`.card-hover-lift`、`rounded-card|surface|hero`、`font-display`（标题/字母名）、`font-serif`（字母大字，沿用现状）、`font-sans`（正文）。安全区 `env(safe-area-inset-bottom)`。图标统一 `lucide-react`（音频按钮现用 emoji 🔊，**本票统一换 lucide `Volume2`**，见 §5）。**不写死 hex、不发明字号（用阶梯）。**

### 0.4 核心心智模型（一句话）

把发音页移动端从"桌面网格直接缩三列的高卡墙"改成 **app 式的发音学习页**：上面是**安静的基础说明**（元音/双元音可听 chip），中间是**紧凑可扫的字母网格**（一眼扫完 27 个、点谁谁发音、有规则的点开 bottom-sheet 看细节），下面是**重音/连读**示例。全程 `md:` 隔离，桌面零回退。

---

## 1. 移动端整体骨架（从上到下）

```
┌─────────────────────────────────────┐
│  [MOBILE-009 顶栏: 头像 订阅 搜索]    │  ← 不属本票，sticky
├─────────────────────────────────────┤
│                                       │  ← 内容滚动区（本票）
│  西语字母                              │  ← 页标题（§1.3 收紧）
│  27 个字母 · 听一遍，就开始             │
│                                       │
│  发音基础            (PhonicsIntro §3) │  ← 区：元音/强弱元音/双元音
│   Vocales  [a 阿][e 诶][i 衣]…         │     可听 chip（≥44px）
│   ┌强元音┐ ┌弱元音┐                    │     单列堆叠
│   双元音 [bueno][ciudad][aire]         │
│                                       │
│  ───────────────────────────────      │  ← 分隔线
│                                       │
│  字母表             (AlphabetGrid §2)  │  ← 区标题（新增）
│  ┌──┐┌──┐┌──┐┌──┐                     │  ← 紧凑 4 列网格
│  │A ││B·││C·││D·│   ← ·=有规则静态点    │
│  └──┘└──┘└──┘└──┘                     │
│  …（共 27 格，4 列约 7 行）            │
│   点字母卡 → 播放字母名；有规则 → 开抽屉 │
│                                       │
│  ───────────────────────────────      │  ← 分隔线
│                                       │
│  重音 & 连读        (PhonicsProsody §4)│
│   Acentuación  规则卡 + 例词（可听）    │
│   Sinalefa     连读句（可听）          │
│                                       │
│   ↑ 底部留白 pb-[calc(3.5rem+safe+16)] │  ← 给底部 tab 让位
└─────────────────────────────────────┘
│  [底部 tab: 视频 阅读 课程 语料库]    │  ← 不属本票，fixed
└─────────────────────────────────────┘
```

### 1.1 字母网格交互模型（重点先说清）

每张字母卡**有两个动作意图**，移动端要让它们清晰且拇指好点：

1. **听字母名**（如 A 读 "a"、B 读 "be"）—— **点卡片主体**即播放字母名音频（`/audio/phonics/letters/{slug}.mp3`）。卡片整体是主要点击区。
2. **看发音规则**（仅 `hasRules` 的字母）—— 点卡片右下角的**"详情"小按钮**展开 bottom-sheet（含音节 chip、例词、规则）。

> 现状把"听字母名/听例词"做成卡内两个并排胶囊 + 一个"查看发音"文字链接，在 `grid-cols-3` 窄列里换行挤压。移动端改为：**整卡点 = 听字母名**（最高频动作，最大点击区），**右下角一个图标按钮 = 看规则**（次级）。例词从卡面"听例词按钮"降级为**卡面纯展示文字**（例词的音频在规则抽屉里听，避免窄卡塞两个按钮）。无规则的字母（A/E/I/O/U/H 等元音及个别）卡面只有"听字母名"整卡点击，无详情按钮。

### 1.2 主容器与留白（照抄）

`page.tsx` 主容器改为响应式，移动端收紧顶部、底部给 tab 留白；桌面恢复原 `py-10`：

```jsx
<div className="mx-auto max-w-app-shell px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10 lg:px-8">
```

- 移动：`pt-4`、底部 `pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)]`（`3.5rem`=底部 tab `h-14` + 安全区 + 16px 呼吸）。
- 桌面：`md:py-10` 恢复原 `py-10`。**桌面零回退。**

### 1.3 页标题区（移动端收紧）

现状：`mb-8` + `text-4xl sm:text-5xl` + 副标题 `text-base`。移动端字号收一档、间距收紧：

```jsx
<section className="mb-6 md:mb-8">
  <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl md:text-5xl">
    西语字母
  </h1>
  <p className="mt-2 text-sm font-light text-zinc-500 dark:text-zinc-400 md:mt-3 md:text-base">
    27 个字母 · 听一遍，就开始
  </p>
</section>
```

- 移动 `text-2xl`（24px）→ 桌面 `sm:text-4xl md:text-5xl` 恢复。`font-display` 顺序前置（class 顺序不影响结果，保持现状亦可）。

### 1.4 区标题统一样式（照抄，三大区共用）

为让发音页有"分章"层次，三大区用统一区标题（基础说明区现状无独立中文区标题，沿用 `PhonicsIntro` 内的「发音基础」H2；**字母网格区现状无标题，本票新增**；重音连读沿用现有 H2）。统一规格：

```jsx
<h2 className="font-display text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl">
  {/* 区标题 */}
</h2>
```

- 移动 `text-xl`（20px）→ 桌面 `md:text-2xl`（24px，与现状 `text-2xl` 对齐）。

### 1.5 区间分隔（节奏统一）

现状各区用 `border-b border-gray-100 pb-10`（Intro 后）、`mt-12 border-t border-gray-100 pt-10`（Prosody）。移动端收紧间距 + 改 zinc：

- Intro 后分隔：`mb-8 border-b border-zinc-100 pb-8 dark:border-zinc-900 md:mb-10 md:pb-10`
- Prosody 顶部分隔：`mt-8 border-t border-zinc-100 pt-8 dark:border-zinc-900 md:mt-12 md:pt-10`

（把 `gray-100` 改 `zinc-100 dark:border-zinc-900`，符合设计系统"用 zinc 不用 gray"。）

---

## 2. 字母网格移动端（`AlphabetGrid.tsx`）

### 2.1 网格容器：移动 4 列紧凑、桌面零回退

现状：`grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5`。问题：移动 3 列高卡太长、卡内塞不下两个按钮。

新方案——**移动 4 列、卡压扁、间距收紧**；`sm` 及以上完全保留现状：

```jsx
<div className="grid grid-cols-4 gap-2 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
```

- 移动 `grid-cols-4 gap-2`：27 字母 ÷ 4 ≈ 7 行，每行 4 张紧凑卡。`gap-2`（8px）让窄屏列更宽。
- `sm:grid-cols-4 sm:gap-4 lg:grid-cols-5`：与现状一致，**桌面零回退**。

> 区标题（§1.4，新增）放在网格上方：
> ```jsx
> <section className="mb-8 md:mb-10">
>   <div className="mb-3 md:mb-6">
>     <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl">字母表</h2>
>     <p className="mt-1 text-sm font-light text-zinc-500 dark:text-zinc-400">点字母听读音，带圆点的可展开发音规则。</p>
>   </div>
>   <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5"> … </div>
> </section>
> ```

### 2.2 字母卡：移动紧凑形态（整卡点击 = 听字母名）

把现状 `<section min-h-[196px] flex flex-col justify-between p-4>` 改为：**移动端是一个可点击的紧凑方块**（整卡 `<button>`，点击播放字母名），桌面恢复原高卡内的双按钮布局。

为避免桌面回退风险，**推荐做法**：保留现有 `<section>` 结构与桌面 DOM，移动端用响应式类压扁 + 把"整卡点击听字母名"包成移动专属交互层。具体：

**移动端紧凑卡（`md:hidden` 分支或响应式压扁）**——给整卡加点击：

```jsx
<button
  type="button"
  onClick={() => play(`/audio/phonics/letters/${letter.slug}.mp3`, letterKey)}
  className={`group relative flex aspect-square w-full flex-col items-center justify-center rounded-card border p-1 shadow-sm transition active:scale-[0.97] md:hidden ${
    isUnique
      ? "border-brand-200 bg-brand-50/60 dark:border-brand-900/40 dark:bg-brand-950/20"
      : "border-zinc-200/60 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/70"
  } ${playingKey === letterKey ? "ring-2 ring-brand-400 ring-offset-1 ring-offset-app dark:ring-offset-zinc-950" : ""}`}
>
  {/* 有规则的静态圆点（非动画，见 §2.3） */}
  {hasRules ? (
    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden />
  ) : null}
  {/* Ñ 西语独有：移动端用小圆点区分即可，徽标文字太挤 → 省略文字，靠 brand 描边 */}

  {/* 字母大字 */}
  <span className="font-serif text-[34px] leading-none text-zinc-950 dark:text-zinc-50">
    {letter.letter}
  </span>
  {/* 字母名（如 be / efe） */}
  <span className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
    {letter.name}
  </span>

  {/* 播放态图标（可选，右下角）：播放中显示 brand Volume2 */}
  {playingKey === letterKey ? (
    <Volume2 className="absolute bottom-1.5 right-1.5 h-3 w-3 text-brand-500" aria-hidden />
  ) : null}
</button>
```

要点：
- **`aspect-square`**：移动端卡是正方形，4 列 ≈ 每卡 ~84px 宽高（375 屏：(375−32 padding−3×8 gap)/4 ≈ 80px），整卡 ≥44px 触摸目标达标。
- 卡内只有：字母大字 + 字母名 + （有规则）静态圆点 + （播放中）小喇叭。**例词不在移动卡面**（太挤）；例词在规则抽屉里。元音无规则字母（A/E/I/O/U）卡面同样只显字母 + 名。
- 播放态用 `ring-2 ring-brand-400` 高亮整卡（替代现状按钮变色），一眼看出"正在响哪个"。
- `active:scale-[0.97]` 点按微反馈（移动无 hover）。

**有规则字母的"看详情"入口**：紧凑卡整卡点击已占用为"听字母名"。规则入口移动端有两种实现，**推荐做法 A**：

- **做法 A（推荐，单击听音 + 长按/二次入口看规则太隐晦 → 改为：卡下方不放按钮，改"点圆点区"或"卡角小箭头"）**——为避免隐藏交互，给有规则的卡**右下角加一个独立的小详情按钮**（`<button>` 叠在整卡之上，`stopPropagation`），lucide `ChevronRight` 或 `Info`，≥的可点区：

```jsx
{hasRules ? (
  <button
    type="button"
    aria-label={`${letter.name} 发音规则`}
    onClick={(event) => {
      event.stopPropagation();
      setSelectedLetter(letter);
    }}
    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-tl-card rounded-br-card text-brand-500 active:bg-brand-50 dark:active:bg-brand-950/40"
  >
    <ChevronRight className="h-4 w-4" aria-hidden />
  </button>
) : null}
```

> 注意：右下角 7×7（28px）小按钮 < 44px，但它是**叠在 80px 整卡上的次级动作**，整卡主动作（听音）≥44px 达标；次级 chevron 作为"可展开"提示 + 备用入口可接受。**若 PM 要严格 44px**，见 §2.5 做法 B（整卡点开抽屉、抽屉内再听字母名），二选一由 PM 拍（§6 开放点 1）。

- **桌面端保留现状**：原 `<section>`（含双胶囊按钮 + "查看发音"链接 + `min-h-[196px]`）用 `hidden md:flex` 包裹，**桌面零回退**。即移动卡 `md:hidden`、桌面原卡 `hidden md:flex flex-col …`。

### 2.3 静态"有规则"圆点（移除 animate-pulse）

现状 `<span className="… bg-brand-400 rounded-full animate-pulse" />`。**删掉 `animate-pulse`**（§0.2 合规），保留静态圆点 `bg-brand-400`（移动端见 §2.2 卡内 `right-1.5 top-1.5 h-1.5 w-1.5`）。桌面卡的圆点同样去掉 `animate-pulse`，留静态。

### 2.4 规则 bottom-sheet（微调，不重写）

现状 `renderRuleModal` 已是底部抽屉（移动 `items-end rounded-t-card`，桌面 `sm:items-center sm:rounded-card`）。微调：

1. **加拖拽手柄**（顶部居中，纯视觉，对齐 MOBILE-000 规范）：
   ```jsx
   <div className="mx-auto mt-3 mb-1 h-1 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 sm:hidden" aria-hidden />
   ```
   放在面板内容最上方（`sm:hidden`，仅移动端抽屉态显示）。
2. **底部安全区内边距**：面板容器把 `p-5` 调整为 `p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:pb-5`，避免操作区被 Home Bar 遮。
3. **关闭按钮 ≥44px**：现状"关闭"`px-4 py-1.5`（高约 32px）。移动端提到 `min-h-[40px]`：改 `px-4 py-2 min-h-[40px]`（接近 44，文字按钮可接受；或加 `sm:py-1.5` 桌面收回）。
4. **滚动锁定**：抽屉打开时锁主页面滚动。现状未锁。新增：`useEffect`，`selectedLetter` 非空时给 `document.body` 加 `overflow:hidden`，关闭时移除（与 MOBILE-000 §3.3 一致）。仅几行逻辑，归本票。
5. **音节 chip / 例词按钮触摸尺寸**：抽屉内 `AudioButton compact`（`px-3 py-1 text-xs`，高约 26px）在抽屉里偏小。移动端把抽屉内音频按钮**提到 `min-h-[36px]`**（抽屉里密度高、36px 可接受，整卡级 44px 已在卡面满足）；统一见 §5。
6. 抽屉面板宽度/圆角/玻璃质感（`glass-card shadow-elevated rounded-t-card sm:rounded-card`）**保留现状**。

### 2.5 做法 B（备选，严格 44px）

若 PM 要求所有可点元素严格 ≥44px：**整卡点击 = 打开 bottom-sheet**（不在卡面直接听字母名）；听字母名移到抽屉顶部一个大 `Volume2` 按钮。无规则字母也可点开，抽屉只含"听字母名 + 例词"。优点：交互单一、触摸区大；缺点：听个字母名要两步。**设计默认做法 A**（卡面直接听音更高频、更顺手），做法 B 见 §6 开放点 1。

---

## 3. 发音基础（`PhonicsIntro.tsx`）移动端

整体结构（说明 → Vocales chip → 强/弱元音双卡 → 双元音卡）在移动端**单列堆叠已合理**，本票只做：间距收紧、chip 触摸尺寸、emoji→lucide、gray 核查（Intro 现状已用 zinc，无 gray，仅核对）。

### 3.1 区容器间距

现状 `<section className="space-y-8">`。移动端收紧、桌面恢复：`space-y-6 md:space-y-8`。内部各 `space-y-4` → `space-y-3 md:space-y-4`。

### 3.2 标题与说明

「发音基础」H2 套用 §1.4 规格（移动 `text-xl` → `md:text-2xl`，现状是 `text-2xl`，加 `text-xl md:text-2xl`）。说明段 `text-sm` 保留。

### 3.3 元音 chip（`AudioChip`）触摸尺寸

现状 `inline-flex h-9 items-center rounded-full px-4 text-sm`（高 36px < 44px）。移动端提到 ≥44px、桌面可收回：

```jsx
className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-medium transition duration-300 md:min-h-0 md:h-9 ${
  playing ? activeClass : idleClass
}`}
```

- 移动 `min-h-[44px]`（拇指好点）→ 桌面 `md:h-9` 恢复 36px 现状密度。
- chip 间距：`flex flex-wrap gap-2` → 移动 `gap-2.5 md:gap-2`（指间留空）。

### 3.4 强/弱元音双卡 & 双元音卡

- 双卡现状 `grid gap-4 lg:grid-cols-2` → 移动单列堆叠已对。间距 `gap-3 md:gap-4`。卡 `p-5` → `p-4 md:p-5`。
- 双元音卡内 `mt-4 grid gap-3 sm:grid-cols-3`：移动单列、`sm` 三列，保留。卡 `p-6` → `p-4 md:p-6`。
- 卡内 chip 同 §3.3 触摸尺寸。
- **修一处现有 bug（顺手）**：`PhonicsIntro` 弱元音说明 `<p className="… font-light font-light">` 重复了 `font-light`，去重为单个。

### 3.5 「Consonantes…」说明文案

现状用 `hidden sm:block`（桌面）+ `sm:hidden`（移动）两份切换。移动端那份 `mt-4 text-xs text-zinc-400` 保留，仅核对 zinc（已是 zinc）。OK，不动。

---

## 4. 重音 & 连读（`PhonicsProsody.tsx`）移动端

这个组件**全用 `gray-*`**，是本票样式债重点。逐处改 `zinc-*` + 触摸尺寸 + 间距收紧。桌面端视觉等价（gray→zinc 是设计系统要求的统一，不算"桌面回退"，是债务清理；视觉上 gray 与 zinc 几乎一致，桌面不破）。

### 4.1 容器与区标题

- 外层 `mt-12 border-t border-gray-100 pt-10` → `mt-8 border-t border-zinc-100 pt-8 dark:border-zinc-900 md:mt-12 md:pt-10`（§1.5）。
- `max-w-3xl space-y-8` → `max-w-3xl space-y-6 md:space-y-8`。
- H2「重音 & 连读」`text-2xl … text-gray-950` → 套 §1.4：`font-display text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl`。
- 说明 `text-sm text-gray-600` → `text-sm text-zinc-600 dark:text-zinc-400`。

### 4.2 Acentuación / Sinalefa 小标题

- H3 `text-lg font-semibold text-gray-950` → `text-lg font-semibold text-zinc-950 dark:text-zinc-50`。
- 说明 `text-gray-600` → `text-zinc-600 dark:text-zinc-400`。

### 4.3 重音规则卡 & 例词卡

- 规则卡 `rounded-card border border-gray-200 p-4` → `rounded-card border border-zinc-200/60 p-4 dark:border-zinc-800/50`。
- 规则标题 `text-gray-900` → `text-zinc-900 dark:text-zinc-100`；描述 `text-gray-600` → `text-zinc-600 dark:text-zinc-400`。
- 例词卡 `rounded-card bg-gray-50 px-4 py-3` → `rounded-card bg-zinc-50 px-4 py-3 dark:bg-zinc-900/60`。
- 例词内：音节正文 `text-gray-900` → `text-zinc-900 dark:text-zinc-100`；重读音节高亮 `font-bold text-brand-600`（保留 brand，加 `dark:text-brand-400`）；释义 `text-gray-500` → `text-zinc-500 dark:text-zinc-400`。
- 例词卡布局 `flex items-center justify-between gap-3`：移动端窄屏若文字 + 按钮挤 → 已 `gap-3` 够；按钮在右，保留。`sm:grid-cols-2` 移动单列。

### 4.4 连读句卡（Sinalefa）

- `rounded-card bg-gray-50 px-4 py-3` → `… bg-zinc-50 dark:bg-zinc-900/60`。
- 句子正文 `text-gray-900` → `text-zinc-900 dark:text-zinc-100`；合并段 `border-b-2 border-brand-400`（保留 brand）。
- 读音/注释 `text-gray-500` → `text-zinc-500 dark:text-zinc-400`；原文 `text-gray-400` → `text-zinc-400 dark:text-zinc-500`。
- 行布局 `flex items-start justify-between gap-3` 保留（移动端文字左、按钮右）。

### 4.5 Prosody 内 `AudioButton` 触摸尺寸 + 图标

现状 `inline-flex h-9 … px-3 text-xs` + emoji 🔊，且只有 brand 一种 tone。移动端提到 ≥44px、桌面收回、emoji→lucide（§5）：

```jsx
className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-xs font-medium transition md:min-h-0 md:h-9 ${
  playing ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300"
          : "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300"
}`}
```

- 加暗色态（现状 Prosody 的 AudioButton 没写 dark，补上）。
- 图标见 §5。

---

## 5. 音频按钮图标统一：emoji 🔊 → lucide `Volume2`

现状三个组件的音频按钮都用 emoji `🔊 {label}`。设计系统 §5「全站统一 `lucide-react`」。本票统一替换：

```jsx
import { Volume2, ChevronRight } from "lucide-react";

// 按钮内容
<Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
<span className="truncate">{label}</span>
```

- 图标 `h-3.5 w-3.5`（14px，按钮内）。播放中态可换 `Volume2` 保持（不引入额外动画；播放高亮靠底色，不靠图标动）。
- 按钮加 `gap-1`（图标与文字间距）。`<span className="truncate">` 防长例词撑破窄按钮。
- 三个组件的 `AudioButton`/`AudioChip` 都改。`emoji` 全清除（防部分系统 emoji 渲染不一致 / 显示成豆腐块）。

> 这是**三个本票组件内部**的统一，不碰共享组件。若担心改动量，至少移动端按钮必须无 emoji（emoji 在不同安卓机渲染差异大，真机易"乱码感"）。

---

## 6. 颜色 / Token 速查（本票所有新元素）

| 元素 | Light | Dark |
|---|---|---|
| 页面背景 | `bg-app`（main 已有） | globals 处理 |
| 字母卡底（普通） | `bg-white/70` | `dark:bg-zinc-900/70` |
| 字母卡底（Ñ 独有） | `bg-brand-50/60` | `dark:bg-brand-950/20` |
| 字母卡边框（普通） | `border-zinc-200/60` | `dark:border-zinc-800/50` |
| 字母卡边框（Ñ） | `border-brand-200` | `dark:border-brand-900/40` |
| 字母大字 | `text-zinc-950` | `dark:text-zinc-50` |
| 字母名 | `text-zinc-500` | `dark:text-zinc-400` |
| 有规则圆点 | `bg-brand-400` | 同 |
| 播放态高亮 ring | `ring-brand-400` | 同（`ring-offset` 用 `app`/`zinc-950`） |
| 区标题 | `text-zinc-950` | `dark:text-zinc-50` |
| 区说明/辅助 | `text-zinc-500` | `dark:text-zinc-400` |
| 分隔线 | `border-zinc-100` | `dark:border-zinc-900` |
| 音频按钮（idle, brand） | `bg-brand-50 text-brand-700` | `dark:bg-brand-950/40 dark:text-brand-300` |
| 音频按钮（playing） | `bg-brand-100 text-brand-700` | `dark:bg-brand-900/60 dark:text-brand-300` |
| 音频按钮（idle, gray tone） | `bg-zinc-50 text-zinc-700` | `dark:bg-zinc-800/40 dark:text-zinc-300` |
| 重读音节高亮 | `text-brand-600` | `dark:text-brand-400` |
| Prosody 例句卡底 | `bg-zinc-50` | `dark:bg-zinc-900/60` |

**强调色只有翡翠绿 `brand`。全文禁 sky / purple。** 本票四个文件经核查**无 sky/purple**（无需清理 sky）；唯一债务是 `PhonicsProsody` 的 `gray-*` → 全改 `zinc-*`（§4）。

---

## 7. 桌面端隔离清单（血泪三戒落地，验收逐条核对）

桌面端（≥768px）**零回退**：

- [ ] 主容器：移动 `pt-4 pb-[calc(3.5rem+safe+16px)]`，桌面 `md:py-10` 恢复原 `py-10`。
- [ ] 页标题：移动 `text-2xl mb-6`，桌面 `sm:text-4xl md:text-5xl md:mb-8` 恢复。
- [ ] 字母网格：移动 `grid-cols-4 gap-2`，`sm:grid-cols-4 sm:gap-4 lg:grid-cols-5` 保留现状不变。
- [ ] 字母卡：移动紧凑 `aspect-square` 整卡 button（`md:hidden`）；桌面原 `<section min-h-[196px]>` 双按钮卡（`hidden md:flex`）原样。
- [ ] `animate-pulse` 圆点改静态（移动 + 桌面都改，仅去动画，圆点保留）。
- [ ] 规则抽屉：加拖拽手柄（`sm:hidden`）、安全区 pb、滚动锁定、关闭按钮 ≥40px；桌面 `sm:items-center sm:rounded-card` 居中态不变。
- [ ] `PhonicsIntro` chip：移动 `min-h-[44px]`，桌面 `md:h-9` 恢复 36px。修 `font-light font-light` 重复。
- [ ] `PhonicsProsody` 全 `gray-*` → `zinc-*`（+ 补暗色态）；按钮移动 `min-h-[44px]` 桌面 `md:h-9`。
- [ ] 音频按钮 emoji 🔊 → lucide `Volume2`（三组件，移动桌面都改）。
- [ ] **不碰** `SiteHeader` / 底部 tab / 头像侧边栏 / 任何 MOBILE-009 外壳。
- [ ] **不碰**字体族（`font-serif` 沿用现状）、不碰播放逻辑（三组件各自 audioRef）。
- [ ] 中文显示正确、无乱码；文件 UTF-8；无 scratch 文件入仓。

---

## 8. 实现校验（给 Codex1 / Codex2）

- 设备模式 **375 宽**打开 `/phonics`：
  - 不触发 error boundary；页标题矮而清；基础说明 chip ≥44px 可点、点击发音。
  - 字母网格 **4 列**、卡为正方形、一屏可扫多行；点字母卡播放字母名、播放态整卡 ring 高亮；有规则字母右下角 chevron，点击弹出底部抽屉。
  - 抽屉：拖拽手柄可见、内容可滚、底部按钮不被 Home Bar 遮、点关闭/遮罩可关、关闭后主页面可滚（滚动锁定生效又解除）。
  - 重音/连读区例词、连读句可读、可听；无 `gray` 残留（颜色为 zinc/brand）。
  - 页面底部最后一屏不被底部 tab 遮挡（底部留白生效）。
  - 音频按钮**无 emoji**、为 lucide 图标；无乱码。
- 桌面（≥1280）打开 `/phonics`：与改造前**视觉一致**（5 列网格、`min-h-[196px]` 双按钮卡、`py-10`、标题 `text-5xl`、抽屉居中态）。**唯二可见差异**：圆点不再 pulse（静态）、🔊 emoji 变 lucide 图标——二者是设计系统合规修正，桌面可接受。
- 暗色模式：字母卡、抽屉、Prosody 卡、所有文字/边框/按钮都有暗色态。
- `npm test` 全绿 + `npm run build` 通过 + `lint:encoding` 通过。

---

## 9. 需 PM / 用户拍板的开放点

1. **字母卡交互（做法 A vs B）**：默认 **做法 A**——整卡点击 = 听字母名，有规则字母右下角小 chevron（28px）开抽屉看规则。备选 **做法 B**——整卡点击 = 开抽屉，听字母名移到抽屉顶部大按钮（严格全 ≥44px，但听音多一步）。设计推荐 A（听音最高频、最顺手）。→ 请 PM 选。
2. **字母网格列数**：默认移动 **4 列**（紧凑可扫、27 字母≈7 行）。备选 5 列（更密、卡更小、字母大字需降到 ~28px）或 3 列（卡更大但滚动更长）。→ 设计建议 4 列，请 PM 确认。
3. **Ñ「西语独有」徽标移动端处理**：紧凑卡空间小，默认移动端**省略"西语独有"文字徽标**，仅用 `brand` 描边 + 圆点区分（桌面保留文字徽标）。是否接受？或在卡下方加超小字标 → 设计建议省略文字（窄卡塞字易乱）。→ 请 PM 确认。
4. **gray→zinc 顺手清理**：`PhonicsProsody` 全量 gray→zinc 是债务清理（设计系统要求），会轻微改桌面色值（视觉几乎无差）。是否同意在本票一并清理？设计建议**同意**（否则违反设计系统、且暗色态缺失）。→ 请 PM 确认。

---

## 10. 一句话总结给 Codex1

把 `/phonics` 移动端从"三列高卡墙"改成 **app 式发音页**：页标题收矮；基础说明 chip 提到 ≥44px、emoji→lucide；字母网格改**移动 4 列、正方形紧凑卡**——**整卡点击听字母名**（ring 高亮）、有规则字母右下角 chevron 开**底部抽屉**（加拖拽手柄/安全区/滚动锁定）；`animate-pulse` 圆点改静态；重音/连读区把全部 `gray-*` 改 `zinc-*` 并补暗色态、按钮提 ≥44px；全程 `md:` 隔离桌面零回退（桌面唯二变化：圆点不闪、🔊 变 lucide）；底部留 tab 空白；UTF-8 防乱码、禁 sky/purple。

---

## 10. PM 决议(§9 开放点)— Claude1 2026-06-03
1. **字母卡交互:做法 A**(整卡点击听音 + 右下角 chevron 开规则抽屉)。
2. **网格 4 列**。
3. **Ñ「西语独有」:省略文字,用 brand 描边 + 圆点区分**(窄卡)。
4. **PhonicsProsody gray→zinc 债务一并清**(本票做,合规)。
顺带:emoji 🔊→lucide Volume2、修 `font-light font-light` 重复 bug、规则抽屉拖拽手柄/安全区/滚动锁,均纳入。

> PM 拍板,Codex1 照此实现。

---
## 🔁 v2 视觉对齐(2026-06-03)— 覆盖上文一切视觉描述,以此为准
本设计稿的**布局/交互/范围照旧有效**,但**视觉风格统一改为「干净现代·极简」**,遵守:
- **`docs/tickets/MOBILE-design-language.md`(全站设计语言基准)**
- **`docs/tickets/MOBILE-003-mockup.html`(批准的视觉手感参照)**
要点:纯白/浅色大留白、Plus Jakarta + 思源黑无衬线、翡翠绿仅点缀(禁 sky/purple)、轻卡片(细边或软阴影二选一,别又粗边又重阴影)、数字用几何无衬线、克制。**开发前先开 v3 模型对齐手感,再照本页布局展开。** 若本页上文出现暖纸/宋体/重渐变/通用盒子等描述,一律以本设计语言覆盖。

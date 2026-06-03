# CORPUS-001 设计稿 — 语料库三 tab（视频历史 / 单词 / 短语）移动端

> 给 Codex1 照抄的具体 Tailwind class + 交互细节。**本稿只针对移动端（`< 768px`，`md:hidden` 隔离）；桌面端 `/vocab` 现状保留、零回退（用 `hidden md:block` 包裹现有桌面布局即可）。**
> 强调色统一翡翠绿 `brand`（#10b981），**全文禁止 `sky` 蓝**（MOBILE-009 已推翻 MOBILE-000 的 sky 旧稿）。
> 设计师：PM 派子 agent（接替 Gemini1）· 2026-06-03
> 必读伴读：`DESIGN-SYSTEM.md`、`UI-DESIGN-CONSTRAINTS.md`、`MOBILE-009-design.md`、`MOBILE-000-design.md`。

---

## 0. 页面在移动外壳中的位置（实现前必读）

`/vocab` 是底部 4-tab 之一（`BottomTabBar` 标签当前为「词库」，对外展示名统一为**语料库**——是否改 tab 文字见 §8 开放点，**设计稿一律称语料库**）。本页活在两个 fixed 外壳之间：

```text
┌─────────────────────────────────────┐
│  MobileTopBar  (fixed top-0, h-52px) │  ← 头像/订阅/搜索，本页不动它
├─────────────────────────────────────┤
│  ▸ sticky 三 tab 切换器 (本稿新建)     │  ← sticky 在顶栏正下方
│  ┌─────────────────────────────────┐ │
│  │  视频  |  单词  |  短语           │ │
│  └─────────────────────────────────┘ │
│                                       │
│   ▼ 当前 tab 的内容（可滚动）          │
│   · 视频：按日期分组的历史卡片          │
│   · 单词：复用 VocabAccordion          │
│   · 短语：收藏短语卡片                  │
│                                       │
│   （末屏留底部空白，别被 tab 栏遮）      │
├─────────────────────────────────────┤
│  BottomTabBar  (fixed bottom-0, h-56) │  ← 语料库 tab 高亮，本页不动它
└─────────────────────────────────────┘
```

**关键留白（MOBILE-009 §3.3 规则）**：
- `MobileTopBar` 已在自身后渲染一个 `h-[52px]` 的占位 div，正常文档流会自动让位顶栏——**不要再手动加 top padding**，否则会双倍下推。三 tab 切换器用 `sticky top-[52px]` 贴在顶栏下方即可。
- 底部 tab 栏是 `fixed`、不占文档流。**本页最外层主容器必须加底部留白**：`pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0`（`3.5rem` = tab 栏 `h-14`），保证最后一条卡片不被遮。

---

## 1. 页面骨架（容器 + 三 tab 切换）

### 1.1 移动端外层（新建客户端组件，建议 `CorpusMobile.tsx`，`"use client"`）

桌面与移动分流（页面 `page.tsx` 里）：
```jsx
{/* 桌面：现状 vocab 布局，零改动 */}
<div className="hidden md:block">
  {/* 现有 SiteHeader + max-w-2xl 单词列表，原样保留 */}
</div>

{/* 移动：本稿三 tab */}
<div className="md:hidden">
  <CorpusMobile words={serializedWords} />
</div>
```

> `serializedWords` 直接复用 `page.tsx` 已有的序列化结果（喂给 `VocabAccordion`）。视频历史 / 短语两个 tab 的数据由 Codex1 后端补：列表型数据走 client fetch（`/api/watch/history`、`/api/vocab/phrase/list`）或在 `page.tsx` server 端预取后透传 props——两种都可，本稿按 **client fetch + 内部 loading/empty/error 态**写（更解耦，tab 懒加载）。

### 1.2 外层主容器 class（照抄）

```jsx
<div className="md:hidden min-h-screen bg-app text-zinc-900 dark:bg-[#09090B] dark:text-zinc-50 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
  {/* §2 tab 切换器 */}
  {/* §3/§4/§5 当前 tab 内容 */}
</div>
```

### 1.3 状态管理

```ts
const [activeTab, setActiveTab] = useState<"video" | "word" | "phrase">("video");
```
- 默认落地 **视频**（历史是语料库最高频回看入口）。
- tab 切换纯前端 `useState`，不走路由（不刷新、不增加 history 栈）。
- 视频 / 短语两 tab **首次切到时才 fetch**（懒加载，省请求），fetch 结果缓存在组件 state，再切回不重复请求。

---

## 2. 三 tab 切换器（sticky 分段控件）

视觉采用 **iOS 风格分段控件（segmented control）**：一个浅色 pill 轨道，选中项是白底（暗色 zinc-800）浮起的 chip + 翡翠绿文字。克制、专业、非游戏化。

### 2.1 容器（sticky 贴顶栏下方）

```jsx
<div className="sticky top-[52px] z-30 border-b border-zinc-200/50 bg-white/80 px-4 py-2.5 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/80">
  <div
    role="tablist"
    aria-label="语料库分类"
    className="grid grid-cols-3 gap-1 rounded-full bg-zinc-100/80 p-1 dark:bg-zinc-900/80"
  >
    {/* 三个 tab 按钮 */}
  </div>
</div>
```

- `top-[52px]` 精确贴在 `MobileTopBar`（`h-[52px]`）正下方；`z-30` 低于顶栏 `z-50`、低于底部 tab `z-40` 不冲突，高于内容。
- 毛玻璃 `bg-white/80 backdrop-blur-xl` 与全站 glass 调性一致。

### 2.2 单个 tab 按钮（照抄，三个分别 label="视频"/"单词"/"短语"）

**选中态：**
```jsx
<button
  type="button"
  role="tab"
  aria-selected={true}
  onClick={() => setActiveTab("video")}
  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-white text-sm font-semibold text-brand-600 shadow-sm transition-all dark:bg-zinc-800 dark:text-brand-400"
>
  <PlayIcon className="h-4 w-4" />
  <span>视频</span>
</button>
```

**未选态：**
```jsx
<button
  type="button"
  role="tab"
  aria-selected={false}
  onClick={() => setActiveTab("word")}
  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-transparent text-sm font-medium text-zinc-500 transition-all active:scale-[0.97] dark:text-zinc-400"
>
  <BookIcon className="h-4 w-4" />
  <span>单词</span>
</button>
```

差异要点（精致度，别省）：
- 选中：白/zinc-800 浮起 chip + `shadow-sm` + 翡翠绿文字 + `font-semibold`。
- 未选：透明底 + zinc-500 + `font-medium` + 点按 `active:scale-[0.97]` 微反馈。
- 整个轨道 `grid-cols-3` 等宽；每按钮 `min-h-[40px]`（含轨道 `p-1` 后整体高度 ≈48px，触摸目标达标）。
- 三 tab 图标用 `lucide-react`：视频 `Play`、单词 `BookText`（或 `Languages`）、短语 `Quote`（或 `MessageSquareQuote`）。统一 `h-4 w-4`。**不放数字角标 / 红点**（禁区 §1/§5）。

> 可选增强（非必须）：tab 标签右侧可加**静态客观计数**，如「单词 89」「短语 12」，用 `text-xs text-zinc-400 ml-1`。允许（禁区 §1 明确「已收藏 N 词」这类静态展示 OK）。但视频历史 tab **不加计数**（避免"看了 X 个"的打卡暗示）。若加计数，选中态计数色用 `text-brand-500/70`。**默认本稿不加，PM 可拍板开（见 §8）。**

### 2.3 内容区切换动效

切换 tab 时内容区做一次轻微淡入即可（克制，禁弹跳/旋转，禁区动效规范）：
```jsx
<div key={activeTab} className="animate-[fadeIn_0.2s_ease-out]">
  {/* 当前 tab 内容 */}
</div>
```
若项目无 `fadeIn` keyframe，退化为不加动效或用现有 `.animate-shimmer` 之外的简单 `transition-opacity`——**不得新增全局 CSS keyframe 以外的东西**；最稳做法：直接用 `opacity` 过渡或不加，切勿引入新依赖。

---

## 3. 视频 tab —— 按日期分组的浏览历史

### 3.1 数据契约（消费 Codex1 后端 `GET /api/watch/history`）

前端期望每条记录形如：
```ts
type VideoView = {
  id: string;
  videoId: string;        // 用于拼 /watch?v=
  title: string;          // 快照，列表不再调 YouTube
  channelTitle: string;   // 快照
  thumbnail: string | null; // 快照 URL，可能为空 → 用占位
  viewedAt: string;       // ISO，倒序返回
};
```
- 列表**按 `viewedAt` 倒序**返回；前端按本地日期分组。
- **绝不在列表里再调 YouTube**（票面配额硬约束）——所有展示字段都来自记录快照。

### 3.2 日期分组逻辑（照抄）

```ts
// 复用 VocabAccordion 的 getDateKey 思路：本地日期 yyyy-mm-dd 分组
function groupByDate(views: VideoView[]) {
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const fmtHeader = (d: Date) => {
    const day = new Date(d); day.setHours(0,0,0,0);
    if (day.getTime() === today.getTime()) return "今天";
    if (day.getTime() === yesterday.getTime()) return "昨天";
    // 同年只显示「6月1日」，跨年显示「2025年6月1日」
    const sameYear = day.getFullYear() === today.getFullYear();
    return new Intl.DateTimeFormat("zh-CN", {
      year: sameYear ? undefined : "numeric",
      month: "long",
      day: "numeric",
    }).format(day);
  };
  // 返回 [{ header: "今天", items: VideoView[] }, ...]，组内保持倒序
}
```
- 分组头文案：**今天 / 昨天 / 6月1日 / 2025年6月1日**。**正确中文**（项目踩过乱码坑：必须是「今天」「昨天」「月」「日」「年」这些字，实现后过 `lint:encoding` + 真机肉眼核对）。

### 3.3 分组头 class（照抄）

```jsx
<h2 className="sticky top-[108px] z-20 -mx-4 bg-app/90 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 backdrop-blur-sm dark:bg-[#09090B]/90 dark:text-zinc-500">
  今天
</h2>
```
- `top-[108px]` = 顶栏 52 + tab 切换器约 56（py-2.5 + 轨道）——**实现时按真实 tab 切换器测得高度微调**，目标是分组头滚动时吸附在切换器正下方。若不想做二级吸附，去掉 `sticky top-... z-20 backdrop-blur` 改成普通 `block` 也可接受（更简单，第一版推荐普通不吸附）。
- `-mx-4 px-4`：让吸附背景铺满边到边。

### 3.4 视频卡片（照抄，列表项）

横向卡：左缩略图 16:9，右标题/频道/时间。整卡为 `Link` 进 `/watch?v=`。

```jsx
<Link
  href={`/watch?v=${view.videoId}`}
  className="group flex gap-3 rounded-2xl border border-zinc-200/50 bg-white/70 p-2.5 shadow-sm transition active:scale-[0.99] dark:border-zinc-800/50 dark:bg-zinc-900/70"
>
  {/* 缩略图 16:9，固定宽，圆角 */}
  <div className="relative aspect-video w-[120px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
    {view.thumbnail ? (
      <img
        src={view.thumbnail}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-active:scale-105"
      />
    ) : (
      /* 占位：居中 lucide Play 图标，zinc */
      <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
        <PlayIcon className="h-7 w-7" />
      </div>
    )}
  </div>

  {/* 右侧文本 */}
  <div className="flex min-w-0 flex-1 flex-col justify-center">
    <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
      {view.title}
    </p>
    <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
      {view.channelTitle}
    </p>
    <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
      {formatRelativeTime(view.viewedAt)}
    </p>
  </div>
</Link>
```

- 缩略图 `w-[120px] aspect-video`（约 120×68）；`object-cover`；空快照用占位块（禁用破图）。
- 标题 `line-clamp-2`（需 `@tailwindcss/line-clamp` 或 Tailwind 3.3+ 内置，项目已用过 truncate，line-clamp 若不可用退化为 `truncate` 单行）。
- `formatRelativeTime`：组内已按日期分到「今天」组，这里时间显示**当天时刻**，如「14:30」；跨更早组也显示时刻即可（日期信息已在分组头）。用 `Intl.DateTimeFormat("zh-CN",{hour:"2-digit",minute:"2-digit",hour12:false})`。
- 整卡可点 ≥44px（卡高 `aspect-video w-[120px]` ≈ 68px + padding，达标）。点按 `active:scale-[0.99]` 微反馈。
- **不放删除/已看角标/进度条**（禁区 §1：不放观看进度环）。第一版无单条删除；若 PM 要"清除历史"另立小迭代。

### 3.5 列表容器 + 分组渲染

```jsx
<div className="flex flex-col gap-4 px-4 pt-3">
  {groups.map((g) => (
    <section key={g.header} className="flex flex-col gap-2">
      {/* §3.3 分组头 */}
      <h2 ...>{g.header}</h2>
      <div className="flex flex-col gap-2.5">
        {g.items.map((v) => (/* §3.4 视频卡 */))}
      </div>
    </section>
  ))}
</div>
```

### 3.6 视频 tab 空态（照抄，用现有 `EmptyState`）

```jsx
<EmptyState
  kind="empty"
  title="还没有观看记录"
  description="打开任意视频开始学习，看过的视频会按日期归到这里，方便随时回看。"
  action={{ href: "/watch", label: "去看视频" }}
  size="lg"
/>
```
- 文案克制、无压力（禁区 §5）。`EmptyState` 的主按钮已是 `bg-brand-500`，符合翡翠绿。

### 3.7 视频 tab 加载态（骨架屏）

fetch 进行中显示 3 条骨架卡（用现有 `.animate-shimmer`）：
```jsx
<div className="flex flex-col gap-2.5 px-4 pt-3">
  {[0,1,2].map((i) => (
    <div key={i} className="flex gap-3 rounded-2xl border border-zinc-200/50 bg-white/70 p-2.5 dark:border-zinc-800/50 dark:bg-zinc-900/70">
      <div className="aspect-video w-[120px] shrink-0 animate-shimmer rounded-xl" />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <div className="h-3.5 w-4/5 animate-shimmer rounded" />
        <div className="h-3 w-1/2 animate-shimmer rounded" />
      </div>
    </div>
  ))}
</div>
```

### 3.8 视频 tab 错误态

fetch 失败用 `EmptyState kind="loading-failed"`：
```jsx
<EmptyState
  kind="loading-failed"
  title="历史记录加载失败"
  description="检查网络后重试。"
  action={{ label: "重试", onClick: refetch }}
  size="md"
/>
```

---

## 4. 单词 tab —— 复用 VocabAccordion（移动端重排）

**核心原则：直接复用现有 `VocabAccordion`，不重写、不动其内部一行**（它已含搜索/筛选/排序/手风琴/分页，且筛选项已用 `brand` 色，移动端基本可用）。

### 4.1 容器 class（移动端外边距收紧）

```jsx
<div className="px-4 pt-3">
  <VocabAccordion words={words} />
</div>
```
- 现有 `VocabAccordion` 的控制面板（搜索框 + `grid-cols-2 sm:grid-cols-4` 筛选）在窄屏已是 `grid-cols-2`，移动端可用，**不改**。
- 现有卡片是 `rounded-xl glass-card`，与本页其它 tab 调性一致。

### 4.2 点词查词抽屉（复用 MOBILE-000）

- `VocabAccordion` 当前展开项里的例句、出处是静态展示，**本票不要求给它接点词抽屉**（单词 tab 主要是回看已收藏词，词条本身已展开释义）。
- 若后续要在单词 tab 里点例句单词查词：复用 `LookupCardStack`（移动端自动走 `MobileLookupSheet` 底部抽屉），**不改 LookupCard 一行**。本票范围内**不做**，列为后续可选（§8）。

### 4.3 单词 tab 空态

`VocabAccordion` 内部已自带空态（`words.length===0` → `EmptyState`：「生词本还空着 / 去看视频」）。**直接复用，不另写**。

---

## 5. 短语 tab —— 收藏短语列表

### 5.1 数据契约（消费 Codex1 后端 `GET /api/vocab/phrase/list`）

> 注：收藏写入路径 `POST /api/vocab/phrase/add` 与查词卡里的「收藏短语」按钮**已存在**（见 `LookupCard.tsx` 的 `handleSavePhrase` + `phraseKind`）。本 tab 只需**列出**已收藏短语。Codex1 补 list 接口即可。

前端期望每条：
```ts
type SavedPhrase = {
  id: string;
  lemma: string;                              // 短语本体，如 "darse cuenta"
  kind: "collocation" | "phrase" | "idiom";
  translationZh?: string | null;             // 中文释义（add 时已存）
  explanationZh?: string | null;             // 用法说明（可空）
  createdAt: string;                          // ISO，倒序
};
```

### 5.2 短语卡片（照抄，列表项）

每条短语卡：左侧短语 + 中文 + 类型 badge，整卡可点 → **弹查词抽屉看完整释义/用法**（复用 MOBILE-000）。

```jsx
<button
  type="button"
  onClick={() => openPhraseLookup(p.lemma, p.kind)}
  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200/50 bg-white/70 p-4 text-left shadow-sm transition active:scale-[0.99] dark:border-zinc-800/50 dark:bg-zinc-900/70"
>
  <div className="min-w-0 flex-1">
    <p className="truncate text-base font-semibold text-zinc-900 transition group-active:text-brand-600 dark:text-zinc-50 dark:group-active:text-brand-400 font-display">
      {p.lemma}
    </p>
    {p.translationZh ? (
      <p className="mt-1 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
        {p.translationZh}
      </p>
    ) : null}
  </div>
  <span className="shrink-0 rounded-full border border-amber-200/40 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800/30 dark:bg-amber-950/40 dark:text-amber-400">
    {phraseKindLabel(p.kind)}
  </span>
</button>
```

- 类型 badge 沿用 LookupCard 既定的**琥珀色（amber）**短语标识体系（`getPhraseKindLabel`：习语/短语/固定搭配），保持全站短语语义色一致。**这是唯一允许的非翡翠绿强调**，因为它是 LookupCard 既有的短语语义色，不是装饰性蓝。
- `phraseKindLabel(kind)`：照搬 `LookupCard` 的 `getPhraseKindLabel`——`idiom→习语`、`phrase→短语`、其它→`固定搭配`。**复用相同中文标签**避免歧义。
- 整卡 `p-4`（高 ≈ 56px+）触摸目标达标；点按 `active` 微反馈。

### 5.3 点击 → 弹查词抽屉（复用 MOBILE-000，不改 LookupCard）

短语卡 `onClick` 复用 `LookupCardStack`（移动端自动 `MobileLookupSheet` 底部抽屉）：

```ts
// 在 CorpusMobile 里维护一个查词卡栈，点击短语压入一张 phrase 卡
const [cards, setCards] = useState<LookupCardStackCard[]>([]);

function openPhraseLookup(lemma: string, kind: "collocation"|"phrase"|"idiom") {
  setCards((prev) => [...prev, {
    id: `${lemma}-${Date.now()}`,
    form: lemma,
    lookupKind: "phrase",
    phraseKind: kind,
    originalSentence: "",
    translatedSentence: "",
    onClose: () => {},          // 由 LookupCardStack.onCloseCard 接管
  }]);
}
// 渲染：<LookupCardStack cards={cards} onCloseCard={(id)=> setCards(c=>c.filter(x=>x.id!==id))} />
```

- `lookupKind="phrase"` + `phraseKind` 会让抽屉走短语形态（琥珀色顶条 + 「收藏短语」按钮，已收藏会显示 already_saved 态）。**LookupCard 内部已支持，零改动。**
- 抽屉里短语已是收藏态 → 底部按钮显示「已加入词库/已收藏」灰态，符合预期。
- 抽屉的滚动锁定 / 安全区 / 拖拽关闭 MOBILE-000 已实现，**不碰**。

### 5.4 短语 tab 列表容器

```jsx
<div className="flex flex-col gap-2.5 px-4 pt-3">
  {phrases.map((p) => (/* §5.2 短语卡 */))}
</div>
```

### 5.5 短语 tab 空态（照抄）

```jsx
<EmptyState
  kind="empty"
  title="还没有收藏短语"
  description="查词时遇到固定搭配、短语或习语，点查词卡里的「收藏短语」即可存到这里。"
  size="lg"
/>
```
- 文案点明收藏入口（教用户怎么来），无压力、无打卡（禁区 §5）。无主按钮（短语收藏发生在查词流程中，这里给不出单一跳转目标；不强加按钮）。

### 5.6 短语 tab 加载/错误态

- 加载：3 条短语骨架（同 §3.7 思路，但单行高度）：
  ```jsx
  <div className="rounded-2xl border border-zinc-200/50 bg-white/70 p-4 dark:border-zinc-800/50 dark:bg-zinc-900/70">
    <div className="h-4 w-1/2 animate-shimmer rounded" />
    <div className="mt-2 h-3 w-2/3 animate-shimmer rounded" />
  </div>
  ```
- 错误：`EmptyState kind="loading-failed" title="短语加载失败" action={{label:"重试", onClick: refetch}}`。

---

## 6. 暗色模式（逐 tab 已内联）

所有 class 上方已带 `dark:` 变体。核对清单：
- 背景：`bg-app` / `dark:bg-[#09090B]`；卡片 `bg-white/70` / `dark:bg-zinc-900/70`。
- 文字：主 `text-zinc-900 / dark:text-zinc-50`，次 `text-zinc-500 / dark:text-zinc-400`，淡 `text-zinc-400 / dark:text-zinc-500`。
- 强调：`text-brand-600 / dark:text-brand-400`。
- 短语 badge：amber light/dark 两套已给。
- 不用纯白文字、不用纯黑背景（DESIGN-SYSTEM §4.4）。

---

## 7. 实现核对清单（Codex1 收尾对照）

- [ ] 桌面 `/vocab` 用 `hidden md:block` 包裹，**现状零改动**；移动用 `md:hidden` 新组件。
- [ ] 三 tab 切换 `sticky top-[52px]`，不被顶栏遮、不遮内容；选中翡翠绿，未选 zinc。
- [ ] 外层加 `pb-[calc(3.5rem+env(safe-area-inset-bottom))]`，末屏不被底部 tab 栏遮。
- [ ] 视频 tab 列表**不调 YouTube**，全用后端快照字段；空快照用占位，不破图。
- [ ] 视频按日期分组，分组头中文「今天/昨天/6月1日」正确无乱码（过 `lint:encoding` + 真机肉眼）。
- [ ] 单词 tab 直接复用 `VocabAccordion`，内部不改一行；其自带空态保留。
- [ ] 短语卡点击复用 `LookupCardStack`（移动端底部抽屉），`lookupKind="phrase"` + `phraseKind`；**不改 LookupCard 一行**。
- [ ] 三 tab 各有 空态 / 加载态 / 错误态。
- [ ] 全部颜色用 token（无写死 hex）；图标全 `lucide-react`；圆角用 `2xl/xl/full`；阴影用 `shadow-sm`（或 token）。
- [ ] 触摸目标 ≥44px；点按 `active:scale` 微反馈；禁弹跳/旋转/confetti。
- [ ] 禁区七条核查：无打卡/进度环/XP；无伪 AI 标签；无已掌握删除线；无 SRS 术语；无压力提醒；无徽章；中文优先。
- [ ] 真机逐 tab 打开 + 来回切：不崩、不乱码、排版舒适；`npm test` + `npm run build` + `lint:encoding` 全绿。

---

## 8. 需 PM 拍板的开放点

1. **底部 tab 文字**：`BottomTabBar` 当前 label 是「词库」，对外名要统一「语料库」。是否在本票一并把 tab label 改成「语料库」？（改动 `BottomTabBar.tsx` 一处字符串，但要确认是否牵动测试断言；本设计稿统一称语料库。）→ **建议改**，与页面对外名一致。
2. **tab 切换器是否显计数**：单词/短语 tab 标签右侧是否加静态计数「单词 89」「短语 12」？禁区允许（静态客观）。视频 tab 不加。→ **设计默认不加，留白更克制；PM 可拍板开。**
3. **默认落地 tab**：本稿默认「视频」（历史回看最高频）。是否改为「单词」（沿用旧 vocab 心智）？→ **建议视频**（语料库的差异化价值在历史）。
4. **日期分组头是否二级吸附**：`sticky` 吸附更精致但要测高度；第一版可先不吸附（普通 block）。→ **建议第一版不吸附，跑通后再加。**
5. **视频历史单条删除 / 清空历史**：本稿第一版不做。是否需要？→ **建议后续小迭代**，本票先只读列表。
6. **短语 tab 是否给筛选**（按 kind 习语/短语/搭配筛）：短语量少时不必要。→ **建议量大后再加**，第一版纯列表。

---

## 9. PM 决议(§8 开放点)— Claude1 2026-06-03
1. **统一用「语料库」**:全站(底部 tab、页面标题、文案)一律"语料库",清掉残留"词库"。注意同步相关测试断言(BottomTabBar 已是"语料库",清查其它处"词库")。
2. **tab 切换器不显计数**(避免数字压力/进度焦虑,符合禁区;也更简洁)。
3. **默认落地 tab = 视频**(最新活动流,便于"接着看";顺序 视频/单词/短语 也对得上)。
4. **日期分组头不做二级吸附**(v1 从简)。
5. **视频历史单条删除/清空 → 后续迭代**(本票不做)。
6. **短语 tab 不加 kind 筛选**(量大后再说)。

> PM 拍板,Codex1 照此实现;用户真机验收时若对 1/3 有异议再调。

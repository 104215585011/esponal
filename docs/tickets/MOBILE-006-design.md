# MOBILE-006 设计稿 — Talk（AI 对话）移动端重设计

> 给 Codex1 照抄的具体 Tailwind class + 交互。**只改移动端（`md:hidden` / `md:` 隔离）；桌面端布局一律不动（`<768px` 才生效）。** 强调色统一翡翠绿 `brand`（#10b981），全文禁止 `sky` 蓝。复用 MOBILE-000 查词底部抽屉，不重造、不动 `LookupCard` / `SpanishText`。
>
> 设计师注记（接替 Gemini1）：talk 代码现状已**不含 `sky`**，气泡/按钮已用 `brand`——这一点保持，不要在新代码里引入 `sky`。

---

## 0. 现状摸底（实现前必读，决定本稿所有约束）

| 事实（已核对源码） | 对设计的影响 |
|---|---|
| `BottomTabBar.shouldHideTabBar()`：只有 `/watch /lectura /learn /vocab` 是主 tab，**其余路径（含 `/talk`、`/talk/[id]`）一律隐藏底部 tab 栏**。 | **关键**：talk 是经"头像侧边栏 → 对话"进入的次级区，移动端**没有底部 tab 栏**。⇒ 角色列表页是普通滚动页（顶部 `MobileTopBar` + 正文，**无需** `pb-[3.5rem]` tab 留白）；聊天页输入条只与**键盘 / iOS Home Bar** 抢底部，不与 tab 栏打架。 |
| `MobileTopBar`（`md:hidden`，`fixed top-0 h-[52px]`，下面跟一个 `h-[52px]` 占位 div）已全站可用：左头像抽屉 / 中订阅占位 / 右搜索。 | talk 两页移动端复用它做顶栏。但 talk 详情页（聊天）应换成 **MOBILE-009 §2.2 返回态**（返回 + 居中角色名），不要订阅/搜索那套——见 §3.0。 |
| `talk/page.tsx`：`SiteHeader` + `max-w-app-shell` 网格卡（`sm:grid-cols-2 lg:grid-cols-3`）。卡含 旗帜 / 推荐 badge / 名 / 语言 / bio(`line-clamp-3`) / style。 | 移动端 `SiteHeader` 是桌面网站头（含整排导航），与 app 外壳不一致。移动端用 `MobileTopBar`；桌面继续 `SiteHeader`。卡片单列流见 §2。 |
| `talk/[characterId]/page.tsx`：`SiteHeader` + `h-[calc(100vh-64px)]` 两栏（`lg:flex`，左 260px `TalkSidebar`，右聊天）。`BackLink` + 角色头。 | `100vh - 64px` 用的是**桌面** 64px 头高，移动端顶栏是 52px 且 `100vh` 在移动浏览器会被地址栏吞高 ⇒ **移动端必须改 `100dvh` 且减 52px**。见 §3.1。 |
| `TalkSidebar`：`lg:` 桌面常驻侧栏；移动端是 `lg:hidden` 的"☰ 会话"按钮 + 左侧 `fixed inset-0 z-40` 抽屉（`w-[80vw]`）。归档确认弹窗 `z-50`。 | 断点从 `lg` 收敛到 **`md`**（与 MOBILE-009 一致，平板竖屏也走移动壳）。会话入口从正文里的"☰ 会话"按钮**移到返回态顶栏右槽**，更像成熟聊天 app。见 §4。 |
| `TalkClient`：消息流 `space-y-4 overflow-y-auto` + 表单输入条（textarea `min-h-[48px]` + 🎤 + ➤，都 `h-11`=44px）。气泡 `max-w-[85%] rounded-2xl`，AI 气泡内 `SpanishText` 点词走查词。录音态/识别态/错误用 `text-[12px]` 文本提示。空态是虚线卡。 | 触摸目标已 44px，保留。本稿重排底部输入区使其**贴底固定 + 安全区 + 键盘不遮**，气泡视觉升级，emoji 图标换 SVG/lucide 风格，空态/录音态重做。见 §3、§5、§6。 |
| `.pb-safe`、`glass-card`、`glass-header`、`shadow-elevated`、`shadow-hero`、`rounded-card`(12)、`rounded-hero`(24)、`brand-*` token 已就绪。 | 直接复用，不新造 token、不加全局 CSS。 |

### 0.1 范围与铁律
- **只动**：`talk/page.tsx`、`talk/[characterId]/page.tsx`、`TalkClient.tsx`、`TalkSidebar.tsx` 的**移动端表现**（`md:` 断点隔离）。
- **不动**：`LookupCard`、`SpanishText`、`MobileTopBar`、`BottomTabBar`、`SiteHeader` 桌面主体、任何共享导航、后端 API、SSE/录音逻辑。
- **桌面零回退**：所有新移动样式用 `md:hidden` 或在 `md:` 处复位回现状值。

---

## 1. 视觉基调

成人 / 学生向，高效克制，像一个**安静、精致的母语者聊天室**——不是游戏。参考成熟 IM（Telegram/iMessage 的克制版）：清晰的气泡分区、贴底输入、拇指可达的语音键。无连胜、无 XP、无 confetti、无伪 AI ✨ 标签（talk 是真 LLM，可不标也别游戏化）。

- 主强调：`brand-500/600`（用户气泡、发送键、录音激活、活跃会话）。
- 中性层：`zinc` 系（AI 气泡、次要文本、边框）。
- 修正建议保留琥珀 `amber`（已存在，属"温和提示"非错误红）；真错误才 `red`。
- 字体沿用：标题 `font-display`，正文默认；轻量描述 `font-light`。

---

## 2. 角色选择页（`/talk`）移动端

### 2.1 页面骨架（移动端）
桌面保留现状 `SiteHeader` + 网格。移动端改用 app 壳：

```jsx
<main className="min-h-screen bg-app">
  {/* 桌面头：保留 */}
  <div className="hidden md:block"><SiteHeader /></div>
  {/* 移动头：app 壳，§MOBILE-009 §2.1 极简态（logo + 头像）足够；talk 列表是次级区，用区标题态亦可 */}
  <MobileTopBar session={session} />   {/* 已自带 md:hidden + 顶部 52px 占位 */}

  <section className="mx-auto max-w-app-shell px-4 py-6 md:py-10">
    {/* header + 卡流，见下 */}
  </section>
</main>
```
- talk 列表**无底部 tab 栏**（§0），所以**不要**加 `pb-[3.5rem]` 留白；普通 `pb-6` 即可（让 `min-h-screen` 自然滚动）。
- `MobileTopBar` 需要 `session`：`/talk/page.tsx` 现为 server 组件且未取 session——实现时 `getServerSession(getAuthOptions())` 取一下传入（与 `[characterId]/page.tsx` 同款），未登录传 `null` 即可，`MobileNav` 自处理登录态。

### 2.2 标题区
```jsx
<header className="mb-5 md:mb-8">
  <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
    选一位 AI 老师
  </h1>
  <p className="mt-1.5 text-[13px] md:text-sm font-light leading-relaxed text-zinc-500 dark:text-zinc-400">
    用真人般的对话练口语。Carlos 是西语母语者——Esponal 的默认推荐。
  </p>
</header>
```
- 移动端标题缩到 `text-2xl`，副文 `text-[13px]`；`md:` 复位现状。

### 2.3 角色卡 — 单列卡流（移动端核心）
网格容器：移动单列，`md` 起恢复多列。
```jsx
<div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
```
单卡（用 `<Link>`，整卡可点；卡内**横向**排布更适合窄屏单列，左头像右信息）：
```jsx
<Link
  href={`/talk/${character.id}`}
  key={character.id}
  className="group relative flex items-start gap-3.5 rounded-hero border border-zinc-200/60 bg-white/70 p-4
             glass-card card-hover-lift active:scale-[0.99] transition
             hover:border-brand-300 dark:border-zinc-800/60 dark:bg-zinc-900/70 dark:hover:border-brand-700/50
             md:flex-col md:items-stretch md:gap-3 md:p-5"
>
  {/* 头像：旗帜放进圆形底，比裸 emoji 更"卡片感" */}
  <span
    aria-hidden
    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full
               bg-brand-50 text-2xl ring-1 ring-brand-100
               dark:bg-brand-950/40 dark:ring-brand-900/40
               md:h-14 md:w-14 md:text-3xl"
  >
    {LANG_FLAG[character.id] ?? "🌐"}
  </span>

  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2">
      <p className="truncate font-display text-[15px] font-semibold text-zinc-900 transition-colors
                    group-hover:text-brand-600 dark:text-zinc-50 dark:group-hover:text-brand-400 md:text-base">
        {character.name}
      </p>
      {character.id === "carlos" ? (
        <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold
                         text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
          推荐
        </span>
      ) : null}
    </div>
    <p className="mt-0.5 text-[12px] italic text-zinc-400 dark:text-zinc-500">
      {character.language}
    </p>
    <p className="mt-1.5 line-clamp-2 text-[13px] font-light leading-relaxed text-zinc-600 dark:text-zinc-400 md:line-clamp-3">
      {character.bio}
    </p>
    {/* style 在移动端隐藏（单列横排太挤），桌面恢复 */}
    <p className="mt-2 hidden text-[11px] text-zinc-400 dark:text-zinc-500 md:block">
      {character.style}
    </p>
  </div>

  {/* 进入箭头：移动端给个明确的"可进入"指示 */}
  <svg aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-zinc-300 transition group-hover:text-brand-500 dark:text-zinc-600 md:hidden"
       fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M9 6l6 6-6 6" />
  </svg>
</Link>
```
要点：
- 移动端 = 横排（头像 / 信息 / 箭头），`bio` 收到 `line-clamp-2`，`style` 隐藏 ⇒ 窄屏不挤、扫读快。
- `md:` 段把卡恢复成现状竖排（`md:flex-col` / `md:line-clamp-3` / `style` 显示），桌面观感不变。
- `active:scale-[0.99]` 给触摸微反馈（非游戏化动画）。
- 旗帜包进 `brand-50` 圆底，提升精致度且统一品牌色。

---

## 3. 聊天页（`/talk/[characterId]`）移动端 — **本票重点**

### 3.0 顶栏（返回态，MOBILE-009 §2.2）
聊天是二级详情页 ⇒ 移动端**不要**列表页那套 `MobileTopBar`（订阅/搜索无意义），换返回态顶栏：左返回、中角色名+语言、**右槽放会话列表入口**（见 §4）。

```jsx
{/* 移动返回态顶栏：固定，h-[52px] 对齐 MobileTopBar */}
<header className="md:hidden fixed inset-x-0 top-0 z-50 grid h-[52px] grid-cols-[44px_1fr_44px] items-center
                   border-b border-zinc-200/50 bg-white/70 backdrop-blur-xl
                   dark:border-zinc-800/50 dark:bg-zinc-950/70">
  <button onClick={() => router.push("/talk")} aria-label="返回对话列表"
    className="flex h-11 w-11 items-center justify-center text-zinc-600 active:scale-90 transition-transform dark:text-zinc-300">
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
  <div className="min-w-0 text-center">
    <h1 className="truncate font-display text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{characterName}</h1>
    <p className="truncate text-[11px] font-light text-zinc-400 dark:text-zinc-500">{character.language}</p>
  </div>
  {/* 右槽：会话列表入口（§4 触发抽屉） */}
  <button onClick={openSessions} aria-label="对话记录"
    className="flex h-11 w-11 items-center justify-center text-zinc-600 active:scale-90 transition-transform dark:text-zinc-300">
    {/* 列表/历史图标 */}
    <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
  </button>
  <div aria-hidden className="h-[52px]" />{/* 注意：fixed 头需占位，见 3.1 处理 */}
</header>
{/* 桌面头保留 */}
<div className="hidden md:block"><SiteHeader /></div>
```
- 用 `router.push("/talk")` 比 `router.back()` 稳（避免从外链直进时 back 跳出站）。
- 返回态顶栏的右槽**取代**原 `TalkSidebar` 里那个正文中的"☰ 会话"按钮（§4 会让 `TalkSidebar` 的移动触发按钮隐藏，由这里统一触发）。

### 3.1 整页布局（移动端：固定头 + 可滚消息 + 固定输入）
现状 `page.tsx` 用 `h-[calc(100vh-64px)]` 两栏，移动端不成立。移动端改为**三段纵向**：固定顶栏（§3.0，52px）/ flex-1 滚动消息 / 固定底部输入条（§5）。

`page.tsx` 容器（移动端）：
```jsx
<main className="min-h-screen bg-app">
  {/* §3.0 两个头 */}
  <section className="mx-auto flex w-full max-w-app-shell
                      h-[calc(100dvh-52px)] md:h-[calc(100vh-64px)]
                      pt-[52px] md:pt-0
                      md:flex">
    {/* 桌面侧栏：保留，移动端隐藏 */}
    <div className="hidden border-r border-zinc-200 px-4 pt-4 dark:border-zinc-800/80 md:block md:w-[260px] md:shrink-0">
      <TalkSidebar characterId={character.id} characterName={character.name} />
    </div>

    <div className="min-w-0 flex-1 md:px-4 md:pt-4">
      <div className="mx-auto flex h-full max-w-3xl flex-col">
        {/* 桌面 BackLink + 角色头：保留，移动端隐藏（移动靠 §3.0 顶栏） */}
        <div className="hidden md:block">
          <BackLink href="/talk" label="对话" />
          <header className="mb-3 mt-2 flex items-center gap-3">{/* ...现状角色头... */}</header>
        </div>
        {/* 移动端仍需 TalkSidebar 的抽屉部分（受 §3.0 顶栏触发）——见 §4 */}
        <TalkClient ... />
      </div>
    </div>
  </section>
</main>
```
关键数值：
- 移动端高度 **`h-[calc(100dvh-52px)]`**（`dvh` 跟随移动浏览器动态视口；减去 52px 固定顶栏）；`pt-[52px]` 把内容推到固定头下方。`md:` 复位 `h-[calc(100vh-64px)] pt-0`（桌面现状）。
- 移动端去掉 `section` 的左右 `px-4`（让消息流贴边更像 IM），改在消息流内部给气泡留白；`md:px-4` 复位。

### 3.2 消息流容器
```jsx
<div
  ref={listRef}
  data-testid="talk-message-list"
  className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 md:space-y-4 md:px-0 md:py-0 md:pb-3"
>
```
- `overscroll-contain`：移动端避免滚到底/顶时把整页/页面背景一起拖动（橡皮筋外溢）。
- 移动端 `px-4` 给气泡边距；`space-y-3` 稍紧凑。`md:` 复位现状。

---

## 4. 多会话列表（移动端入口与抽屉）

复用 `TalkSidebar` 现有的"抽屉 + 归档 + 确认弹窗"逻辑，仅改**断点**与**触发源**：

1. **断点 `lg` → `md`**（与全站移动壳统一）：
   - 正文里的"☰ 会话"触发按钮 `lg:hidden` → **删除/隐藏**（改由 §3.0 顶栏右槽 `openSessions` 触发）。把 `TalkSidebar` 的 `open` 状态上提为受控（导出 `open` / `onOpenChange`），或在 `TalkSidebar` 内监听一个自定义事件 `talk:sessions:open`（与现有 `talk:sessions:changed` 同风格）由顶栏 `dispatchEvent` 打开。**首选受控**：`page.tsx` 持有 `sessionsOpen` state，传给顶栏的 `openSessions` 和 `TalkSidebar`。
   - 桌面常驻侧栏 `lg:block` → `md:block`；移动抽屉 `lg:hidden` → `md:hidden`。
2. **抽屉面板（移动端）class 升级**（更像 app 的右/左滑抽屉，对齐 MOBILE-000 抽屉质感）：
   ```jsx
   {isOpen ? (
     <div className="fixed inset-0 z-[60] flex md:hidden">{/* 高于 §3.0 顶栏 z-50 */}
       <div className="h-full w-[82vw] max-w-sm border-r border-zinc-200/50 bg-white shadow-hero
                       dark:border-zinc-800/40 dark:bg-[#09090B]
                       flex flex-col
                       pt-[calc(env(safe-area-inset-top)+8px)]">
         {/* renderContent() 现有内容 */}
       </div>
       <button aria-label="关闭会话列表" onClick={() => onOpenChange(false)}
         className="h-full flex-1 bg-black/40 backdrop-blur-[2px]" />
     </div>
   ) : null}
   ```
   - 提到 `z-[60]` 盖住固定顶栏（`z-50`）。
   - 抽屉顶部补 `safe-area-inset-top`，避免刘海/状态栏遮住"+ 新对话"。
3. **会话行 / 新对话按钮 / 归档区**：移动端沿用现状结构即可，仅微调触摸目标——
   - "+ 新对话"按钮 `h-9` → 移动端 `h-11`（44px）：`className="flex h-11 md:h-9 w-full items-center gap-2 rounded-card bg-brand-50 ..."`。
   - 归档按钮（🗑）移动端始终可见（现状已 `opacity-100 ... lg:opacity-0 lg:group-hover:opacity-100`，把 `lg:` 改 `md:`），触摸区 `px-2 py-1` 提到 `px-2.5 py-2`。
4. **归档确认弹窗**：`z-50` → **`z-[70]`**（要盖住 `z-[60]` 抽屉）；其余样式保留。

> 实现注记：受控化是唯一"逻辑"改动，范围小。若 Codex1 觉得状态上提牵连大，退路是事件方案（顶栏 `window.dispatchEvent(new CustomEvent("talk:sessions:open"))`，`TalkSidebar` `useEffect` 监听 `setIsOpen(true)`）。两者皆可，**首选受控**。

---

## 5. 底部输入区（移动端核心 — 不被键盘 / Home Bar 遮挡）

现状输入条在表单里随消息流之后流动。移动端改为**贴底固定条**，并预留安全区。

### 5.1 容器
```jsx
<form
  onSubmit={handleSubmit}
  className="shrink-0 border-t border-zinc-100 bg-white/85 backdrop-blur-xl
             px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)]
             dark:border-zinc-800/80 dark:bg-zinc-950/80
             md:bg-transparent md:px-0 md:pt-3 md:pb-4 md:backdrop-blur-none"
>
```
- **不用 `fixed`**：输入条是 §3.1 flex 列的最后一段（`shrink-0`），消息流 `flex-1` 占满中间。整页高 `100dvh-52px` 已锁定，输入条自然贴在可视区底部，**键盘弹起时浏览器收缩 `dvh`、flex 列重排，输入条上移到键盘上方**（比 `position:fixed` 更不易被键盘盖住，iOS Safari 尤其）。
- `pb-[calc(env(safe-area-inset-bottom)+10px)]`：撑过 iOS Home Bar。
- 移动端加毛玻璃底色（与消息流分层）；`md:` 复位为现状透明无 padding 样式。

### 5.2 状态提示行（录音 / 识别 / 错误）— 放在输入框上方
```jsx
{statusMessage ? (
  <p className="mb-2 text-[12px] text-red-500">{statusMessage}</p>
) : null}
{recording ? (
  <div className="mb-2 flex items-center gap-2 text-[12px] text-brand-600 dark:text-brand-400">
    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
    <span>正在聆听 {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</span>
    {interimTranscript ? <span className="truncate italic text-zinc-500 dark:text-zinc-400">{interimTranscript}</span> : null}
  </div>
) : null}
{recognizing ? (
  <p className="mb-2 text-[12px] text-brand-600 dark:text-brand-400">识别中…</p>
) : null}
```
- 文案"正在聆听"比"正在录音"更克制友好；中文用全角省略号 `…`，**禁止乱码**（实现时确认文件 UTF-8，省略号别写成 `...` 之外的坏字符）。
- 颜色统一 `brand-600`（现状有 `brand-650` 这种非标值，移动端用标准 `brand-600`）。

### 5.3 输入框 + 语音键 + 发送键
```jsx
<div className="flex items-end gap-2">
  <textarea
    value={input}
    rows={1}
    disabled={streaming || recognizing}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={/* 现状 Enter 发送逻辑 */}
    placeholder={streaming ? "对方正在回复…" : "输入消息，或按住麦克风说话"}
    className="min-h-[44px] max-h-32 flex-1 resize-none rounded-[22px] border border-zinc-200
               bg-zinc-50 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-800 outline-none transition
               placeholder:text-zinc-400
               focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100
               dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:focus:border-brand-400 dark:focus:bg-zinc-900 dark:focus:ring-brand-900/20"
  />

  {/* 语音键 */}
  <button
    type="button"
    aria-label={recording ? "停止录音" : "开始语音输入"}
    disabled={streaming || recognizing}
    onClick={recording ? stopRecording : () => void startRecording()}
    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
      recording
        ? "border-red-400 bg-red-50 text-red-600 animate-pulse dark:bg-red-950/30"
        : "border-zinc-200 bg-white text-zinc-500 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
    }`}
  >
    {recording ? (
      /* 方形停止图标 */
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
    ) : (
      /* 麦克风图标（替换裸 emoji 🎤，跨机渲染稳定、无乱码风险） */
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /><path d="M8 21h8" />
      </svg>
    )}
  </button>

  {/* 发送键 */}
  <button
    type="submit"
    aria-label="发送"
    disabled={!input.trim() || streaming || recognizing}
    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition active:scale-95
               hover:bg-brand-600
               disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
  >
    {/* 纸飞机/上箭头 SVG，替换 ➤ */}
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
  </button>
</div>
```
要点：
- 三键 / 框全 **44px 触摸目标**（`min-h-[44px]` / `h-11 w-11`）。
- textarea 圆角 `rounded-[22px]`（胶囊）、`bg-zinc-50` 填充感，更像 IM；`text-[15px]` 移动端易读。
- **emoji → SVG**：现状 🎤 / ➤ / ■ 在部分安卓机渲染不一致甚至缺字（潜在"乱码"风险）；统一 inline SVG（lucide 风格路径）杜绝。
- 语音键激活态红色脉冲（保留现状语义），停止用方形 SVG。

---

## 6. 消息气泡（移动端视觉升级）

结构沿用现状（用户右 / AI 左，AI 走 `SpanishText` 点词查词、修正建议、生词 chip、重播）；移动端调间距与气泡形态：

### 6.1 用户气泡
```jsx
<div className="flex justify-end">
  <div className="max-w-[82%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-white shadow-sm dark:bg-brand-500">
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{content}</p>
  </div>
</div>
```
- `rounded-br-md`：右下角收一点，IM 常见的"尾巴"暗示，区分发送方。

### 6.2 AI 气泡
```jsx
<div className="flex justify-start">
  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-zinc-200/60 bg-white/80 px-3.5 py-2.5 text-zinc-800 shadow-sm glass-card
                  dark:border-zinc-800/50 dark:bg-zinc-900/70 dark:text-zinc-100">
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
      {/* canLookupAssistantMessage ? <SpanishText .../> : content || <span>…</span> */}
    </p>
    {/* 修正建议块：现状 amber 卡，保留，间距 mt-2.5 */}
    {/* 生词 chip：现状 brand chip，保留 */}
    {/* 重播按钮：见 6.3 */}
  </div>
</div>
```
- `rounded-bl-md` 左下收角，与用户气泡镜像。
- **点词查词不变**：`SpanishText` + `source={{type:"talk",...}}` 原样传递，点词弹的是 MOBILE-000 共享底部抽屉——**不改 `SpanishText`/`LookupCard`**。

### 6.3 重播按钮（AI 气泡内，emoji → SVG）
```jsx
<button type="button" onClick={() => void playTTS(content)}
  className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-400 transition hover:text-brand-600 dark:text-zinc-500 dark:hover:text-brand-400">
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  重播
</button>
```
- 现状 `▶ 重播` 的 `▶` 字符渲染不稳，换 SVG 三角。

### 6.4 流式占位 / 加载态
- AI 流式中（`content === ""`）：现状显示省略号 `…`。升级为**三点跳动**，更像"对方输入中"：
  ```jsx
  <span className="inline-flex gap-1 py-1" aria-label="对方正在输入">
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s] dark:bg-zinc-600" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s] dark:bg-zinc-600" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 dark:bg-zinc-600" />
  </span>
  ```

### 6.5 空态（移动端）
现状虚线卡保留，移动端居中、给点呼吸：
```jsx
<div className="flex h-full flex-col items-center justify-center px-6 text-center">
  <span aria-hidden className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl ring-1 ring-brand-100 dark:bg-brand-950/40 dark:ring-brand-900/40">
    {LANG_FLAG[characterId] ?? "💬"}
  </span>
  <p className="font-display text-[15px] font-medium text-zinc-700 dark:text-zinc-200">和 {characterName} 开始对话吧</p>
  <p className="mt-1.5 max-w-xs text-[13px] font-light leading-relaxed text-zinc-500 dark:text-zinc-400">
    打字或按麦克风说话。{characterName} 会用对应语言回复并朗读，气泡里点任意词可查词。
  </p>
</div>
```
- 空态作为消息流内的居中块（`messages.length === 0` 分支）；提示"点词查词"帮助用户发现核心功能。无游戏化、无"今天还差…"。

---

## 7. 桌面隔离清单（血泪三戒落地，逐项核对）

- [ ] `talk/page.tsx`：`SiteHeader` 包 `hidden md:block`；新增 `MobileTopBar`（自带 `md:hidden`）；网格 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`；卡 `md:flex-col` 复位竖排，`style` `hidden md:block`，bio `line-clamp-2 md:line-clamp-3`。
- [ ] `talk/[characterId]/page.tsx`：返回态顶栏 `md:hidden`；`SiteHeader` + `BackLink` + 角色头包 `hidden md:block`；`section` 高度 `h-[calc(100dvh-52px)] md:h-[calc(100vh-64px)]`、`pt-[52px] md:pt-0`、`px-0 md:px-4`。
- [ ] `TalkSidebar`：常驻侧栏 `md:block`（原 `lg:block`）；移动抽屉 `md:hidden`（原 `lg:hidden`）；正文"☰ 会话"触发按钮移除（改顶栏触发，受控 `open`）；抽屉 `z-[60]` + `safe-area-inset-top`；确认弹窗 `z-[70]`；归档按钮可见断点 `lg:`→`md:`；新对话 `h-11 md:h-9`。
- [ ] `TalkClient`：输入条 `shrink-0` + 安全区 padding（移动）`md:` 复位；emoji 图标全换 SVG；气泡 `rounded-br-md/bl-md` + `text-[15px]`；流式三点动画；空态居中块；状态色 `brand-600`（清掉 `brand-650`）。
- [ ] **全文无 `sky`**；**无 `LookupCard`/`SpanishText` 改动**；**无新全局 CSS**；**无伪 AI ✨ / 连胜 / XP / 进度环 / confetti**。
- [ ] 真机核对：键盘弹起输入框不被遮；iOS Home Bar 不压发送键；点词弹底部抽屉正常；多会话抽屉开合不崩；返回回到 `/talk`。

---

## 8. 开放点（需 PM 拍板）

1. **录音交互：点按切换 vs 长按说话（push-to-talk）。** 现状是"点开始 / 点停止"两次点击（本稿沿用，最省改动）。成熟 IM 多用"按住说话、松开发送"。若要 push-to-talk，需改 `TalkClient` 录音键事件（`onPointerDown/Up`）——**建议先沿用点按，push-to-talk 另开小迭代**。请 PM 确认是否本票就做。
2. **聊天页移动顶栏右槽放"会话列表"是否合适。** 本稿把多会话入口放返回态顶栏右槽（取代正文里的"☰ 会话"）。也可考虑放在角色名下方做一个"当前会话标题 + 切换"条。建议顶栏右槽（更省空间、像 app），请 PM 确认。
3. **`/talk` 列表移动顶栏形态。** 本稿用通用 `MobileTopBar`（含订阅/搜索图标）。talk 列表用不到"订阅/搜索"，是否给 talk 列表也用"区标题"极简态（只 logo + 头像）？建议沿用 `MobileTopBar` 保持全站一致，但 PM 若嫌"订阅"在 talk 语境怪可改极简态。
4. **`/talk` 列表是否需要 `session`/登录态。** 现状 `/talk/page.tsx` 是公开可看（点进角色才要登录）。`MobileTopBar` 需要 `session` 渲染头像抽屉——实现时补 `getServerSession`，未登录传 `null`。确认这不改变"列表页公开"的现状。

---

## 9. 实现顺序建议（给 Codex1）

1. `talk/page.tsx`：双头隔离 + 单列横排卡（§2）——独立、低风险，先做。
2. `talk/[characterId]/page.tsx`：返回态顶栏 + `100dvh-52px` 三段布局 + 头隔离（§3）。
3. `TalkClient`：底部固定输入条 + 安全区 + SVG 图标 + 气泡升级 + 空态/流式动画（§5、§6）。
4. `TalkSidebar`：断点 `lg→md` + 顶栏受控触发 + 抽屉 z 层/安全区（§4）——最后做，依赖 §3 顶栏。

每步后真机（或 `md` 以下窄视口）自查：不崩、不乱码、输入框不被键盘/Home Bar 遮、点词抽屉正常。

---

## 9. PM 决议(§8 开放点)— Claude1 2026-06-03
1. **录音:点按(tap 开始/停止)**,不做长按 push-to-talk(简单、通用)。
2. **多会话入口:放顶栏右槽**(返回态顶栏),确认。
3. **/talk 列表用通用 MobileTopBar**(含订阅/搜索),与全站一致,不做极简特例。
4. **给 /talk 列表补 getServerSession 喂 MobileTopBar 头像**(顶栏头像一致);保持"列表公开"现状不变。
- 附:聊天高度 `100vh-64px` → 改 `100dvh-52px`(移动 52px 头高 + dvh 避键盘),纳入实现。emoji 图标全换 inline SVG 防乱码,纳入。

> PM 拍板,Codex1 照此实现。

---
## 🔁 v2 视觉对齐(2026-06-03)— 覆盖上文一切视觉描述,以此为准
本设计稿的**布局/交互/范围照旧有效**,但**视觉风格统一改为「干净现代·极简」**,遵守:
- **`docs/tickets/MOBILE-design-language.md`(全站设计语言基准)**
- **`docs/tickets/MOBILE-003-mockup.html`(批准的视觉手感参照)**
要点:纯白/浅色大留白、Plus Jakarta + 思源黑无衬线、翡翠绿仅点缀(禁 sky/purple)、轻卡片(细边或软阴影二选一,别又粗边又重阴影)、数字用几何无衬线、克制。**开发前先开 v3 模型对齐手感,再照本页布局展开。** 若本页上文出现暖纸/宋体/重渐变/通用盒子等描述,一律以本设计语言覆盖。

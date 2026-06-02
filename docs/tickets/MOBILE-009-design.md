# MOBILE-009 设计稿 — 移动端 app 外壳：底部 tab 导航 + 精简顶栏

> 给 Codex1 照抄的具体方案。**只改移动端（`md:hidden` 隔离）；桌面端导航/顶栏一律不动。** 强调色统一翡翠绿 `brand`（#10b981），全文禁止 `sky` 蓝。
>
> 设计师注记：MOBILE-000 旧稿用了 `sky` 蓝，已被 MOBILE-009 票面推翻——本外壳一切高亮用 `brand` 绿。

---

## 0. 现状摸底（实现前必读）

| 事实 | 影响设计的点 |
|---|---|
| `SiteHeader` 是**逐页**引入的（不在 `layout.tsx`），各 `page.tsx` 各自渲染 | 底部 tab 栏要"全站常驻"，**放进 `src/app/layout.tsx`** 的 `<body>` 内，一次接入全站；顶栏保持各页自管。 |
| 现有移动导航是 `SiteNav` 里 `lg:hidden` 的汉堡 `MobileNav` | 票面要求断点是 `md`。**本设计统一用 `md` 断点**（`md:hidden` 显示移动 tab，`hidden md:flex` 桌面）。汉堡的 `lg:hidden` 维持不动（见 §4），避免牵动桌面。 |
| `WatchMobileLayout` 是自包含 `h-[100dvh]` 全屏沉浸层，自带底部播放控制条 | watch 不是"页头+滚动正文"，是整屏接管。**tab 栏在 watch 详情态必须隐藏**（见 §3）。 |
| `LecturaReader` 移动控制条：`fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] ... md:hidden` 悬浮胶囊 | 会和底部 tab 栏在同一区域打架。**规则见 §3。** |
| `.pb-safe { padding-bottom: env(safe-area-inset-bottom) }` 已存在；可直接用 | tab 栏安全区直接复用。 |
| `brand` 绿、`glass-header`、`shadow-elevated` 等 token 已就绪 | 直接复用，不新造。 |

---

## 1. 底部 Tab 栏（核心交付物）

### 1.1 Tab 项提案（4 个 + 1 个"更多"= 5 格）

> **最终 tab 项需 PM/用户确认。** 下表是设计提案。约束：watch、lectura 为 T1 核心，必须在 tab。

| # | 标签 | 路由 | lucide 图标 | 理由 |
|---|---|---|---|---|
| 1 | 首页 | `/` | `Home` | app 落地/导流中枢，原生范式必备首项。 |
| 2 | 视频 | `/watch` | `Play`（或 `Clapperboard`） | T1 核心输入引擎，硬占位。 |
| 3 | 阅读 | `/lectura` | `BookOpen` | T1 核心、留存引擎（依记忆：lectura 是留存核心），硬占位。 |
| 4 | 生词本 | `/vocab` | `Sparkles`（或 `BookMarked`） | 词库定位是"我的生词本"，高频回看入口，放 tab 合理。用 `vocabHref`（未登录跳登录）。 |
| 5 | 更多 | （打开抽屉，不跳路由） | `LayoutGrid`（或 `Menu`） | 收纳课程/发音/对话/语法/拆解等次级区，复用现有汉堡抽屉（见 §4）。 |

被收进"更多"的区：`/learn` 课程、`/phonics` 发音、`/talk` 对话、`/grammar` 语法、`/dissect` 拆解。

> 备选：若 PM 想把"课程 `/learn`"提到 tab，可把"生词本"降回"更多"。设计上 4 主区 + 更多最稳，不建议放满 5 个真路由（挤、无"更多"出口）。

### 1.2 Tab→路由 / 高亮判定映射

```ts
// 建议放在新组件 src/app/components/web/BottomTabBar.tsx ("use client")
type Tab = {
  label: string;
  href: string;          // "更多" 用空 href，onClick 开抽屉
  match: (pathname: string) => boolean;
  icon: LucideIcon;
};

// 高亮判定（沿用现有 isActivePath 思路，保持一致）
const startsWith = (p: string, base: string) =>
  p === base || p.startsWith(`${base}/`);

const TABS = [
  { label: "首页",   href: "/",        icon: Home,      match: (p) => p === "/" },
  { label: "视频",   href: "/watch",   icon: Play,      match: (p) => startsWith(p, "/watch") || p === "/search" },
  { label: "阅读",   href: "/lectura", icon: BookOpen,  match: (p) => startsWith(p, "/lectura") },
  { label: "生词本", href: vocabHref,  icon: Sparkles,  match: (p) => startsWith(p, "/vocab") },
  // "更多" 无 match 高亮（抽屉打开态可自管），点击开抽屉
];
```

- `pathname` 用 `usePathname()`。
- `/watch` 详情态虽隐藏 tab 栏（§3），但 `/search`、`/watch` 列表态仍高亮"视频"。

### 1.3 容器 class（照抄）

```jsx
<nav
  aria-label="主导航"
  className="
    fixed inset-x-0 bottom-0 z-40 md:hidden
    border-t border-zinc-200/60 dark:border-zinc-800/60
    bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl
    shadow-[0_-1px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_-1px_12px_rgba(0,0,0,0.4)]
    pb-safe
  "
>
  <ul className="flex h-14 items-stretch">
    {/* 每个 tab 一个 li，flex-1 */}
  </ul>
</nav>
```

- 高度 `h-14`（56px）正文 + `pb-safe` 撑安全区；每格 `flex-1`，图标+文字整体可点区域 ≥44px（`h-14` 已满足）。
- 毛玻璃：`bg-white/80 ... backdrop-blur-xl`，与顶栏 `glass-header` 调性一致。

### 1.4 单个 Tab class（照抄）

**选中态（active）**
```jsx
<Link
  href={tab.href}
  aria-current="page"
  className="
    group flex flex-1 flex-col items-center justify-center gap-0.5
    min-h-[44px] select-none
    text-brand-600 dark:text-brand-400
    transition-colors
  "
>
  <Icon className="h-[22px] w-[22px]" strokeWidth={2.4} aria-hidden="true" />
  <span className="text-[10px] font-semibold leading-none tracking-tight">{tab.label}</span>
</Link>
```

**未选态（inactive）**
```jsx
<Link
  href={tab.href}
  className="
    group flex flex-1 flex-col items-center justify-center gap-0.5
    min-h-[44px] select-none
    text-zinc-500 dark:text-zinc-400
    hover:text-zinc-700 dark:hover:text-zinc-200
    active:scale-95 transition-[color,transform] duration-150
  "
>
  <Icon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
  <span className="text-[10px] font-medium leading-none tracking-tight">{tab.label}</span>
</Link>
```

差异要点（精致度，别省）：
- 选中：绿色 + `font-semibold` + 图标 `strokeWidth={2.4}`（略粗）。
- 未选：`zinc-500` + `font-medium` + 点按 `active:scale-95` 微反馈。
- **不做**徽章/红点/连胜数字等游戏化元素（遵 UI-DESIGN-CONSTRAINTS）。
- "更多" tab 用 `<button>` 而非 `<Link>`，`onClick` 触发抽屉（§4）。

---

## 2. 精简顶栏（两种形态）

> 顶栏改造**只影响移动端**：在 `md:hidden` 范围内提供精简形态；`hidden md:flex` 段落保留现有 `SiteHeader` 桌面布局原样。
>
> 实现建议：新增小组件 `MobileTopBar`（`md:hidden`），各页按需传 props。现有 `SiteHeader` 的桌面主体加 `hidden md:flex` 包裹即可（**只加隔离类，不删桌面内容**）。

### 2.1 首页态（极简：只有 logo + 头像/登录）

```jsx
<header className="md:hidden sticky top-0 z-30 h-13 flex items-center justify-between px-4
                   border-b border-zinc-200/50 dark:border-zinc-800/50
                   bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
  {/* 左：品牌字标（复用 SiteHeader 里的 logo 块，缩小） */}
  <Link href="/" className="flex items-center gap-2">
    {/* 现有 8.5×8.5 渐变 logo 方块 + "Esponal" 字标 */}
  </Link>
  {/* 右：头像/登录入口（复用现有 avatar 逻辑） */}
</header>
```
- 不放搜索框、不放整排导航文字（导航交给底部 tab）。"网站感"消失。
- `h-13`（52px）比桌面 `h-16` 矮。

### 2.2 详情态（返回 + 居中标题）

适用：`/lectura/[slug]`、`/learn/[slug]`、`/grammar/[slug]`、`/talk/[characterId]` 等二级页（**watch 详情态除外，它整屏接管、无顶栏**）。

```jsx
<header className="md:hidden sticky top-0 z-30 h-13 grid grid-cols-[44px_1fr_44px] items-center
                   border-b border-zinc-200/50 dark:border-zinc-800/50
                   bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
  {/* 返回按钮 */}
  <button onClick={() => router.back()} aria-label="返回"
    className="flex h-11 w-11 items-center justify-center text-zinc-600 dark:text-zinc-300
               active:scale-90 transition-transform">
    <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
  </button>
  {/* 居中标题，单行省略 */}
  <h1 className="truncate text-center text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
    {title}
  </h1>
  {/* 右槽：占位或操作（收藏/分享），无则空 div 保持居中 */}
  <div className="h-11 w-11" />
</header>
```
- 返回用 `useRouter().back()`；若无历史，fallback 到该区列表页（如 `/lectura`）。
- `grid-cols-[44px_1fr_44px]` 保证标题真正居中、左右触控区 44px。

---

## 3. 底部控件协调规则（关键，必须照此实现）

**总原则：底部 tab 栏是"区间导航层"，沉浸阅读/观看时让位给页面自己的控制条——不叠加、不打架。**

### 3.1 watch 详情态 → **隐藏 tab 栏**（硬规则）
- `WatchMobileLayout` 是 `h-[100dvh]` 全屏接管、自带底部播放控制条。tab 栏出现只会挤压视频区且与播放条重叠。
- 实现：tab 栏组件读取 `usePathname()`，命中 watch 详情（`pathname === "/watch"` 且处于播放/有 video 参数，或简单地 `startsWith("/watch")` 且非纯列表）时 **不渲染**。
  - 最简稳妥判定：**`/watch` 路由一律隐藏 tab 栏**（watch 页本就是单一沉浸入口，列表与播放同页）。返回主区靠 watch 页自己的返回/首页逻辑或系统返回。
  - 代码：
    ```ts
    const HIDE_TAB_ON = (p: string) => p === "/watch" || p.startsWith("/watch/");
    if (HIDE_TAB_ON(pathname)) return null;
    ```
- 若 PM 希望 watch 也保留 tab：则改为 watch 全屏态加 `z-[80]`（已有 `isFullscreen` 用 `z-[80]`）盖住 `z-40` 的 tab 栏即可——但默认建议直接隐藏。

### 3.2 lectura 详情态 → **tab 栏隐藏，阅读控制条上位**（硬规则）
- `LecturaReader` 已有悬浮控制胶囊（`fixed ... bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 ... md:hidden`）。它和 tab 栏（`bottom-0 z-40`）会上下打架。
- 规则：**进入 `/lectura/[slug]` 阅读详情时隐藏底部 tab 栏**，把底部完全交给阅读控制条（沉浸阅读，符合"lectura 是留存引擎"的专注定位）。`/lectura` 列表页**保留** tab 栏。
  - 判定：
    ```ts
    // 列表页 /lectura 显示 tab；详情 /lectura/xxx 隐藏
    const isLecturaReader = /^\/lectura\/[^/]+/.test(pathname);
    if (isLecturaReader) return null;
    ```
- 顶栏：lectura 详情用 §2.2 返回态顶栏。

### 3.3 通用滚动页（首页/词库/课程列表等）→ **tab 栏常驻，正文留底部空白**
- 这些页有可滚动正文、无底部固定控制条，tab 栏常驻。
- **正文容器底部留白**：在 `md:hidden` 生效的主内容外层加
  ```
  pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0
  ```
  （`3.5rem` = tab 栏 `h-14`），避免最后一屏内容被 tab 栏盖住。桌面 `md:pb-0` 归零，不影响桌面。

### 3.4 隐藏规则汇总表（Codex1 实现核对）

| 路由 | 顶栏形态 | 底部 tab 栏 | 备注 |
|---|---|---|---|
| `/` | §2.1 首页态 | 显示 | 正文加底部留白 §3.3 |
| `/watch`、`/watch/*` | 无（整屏接管） | **隐藏** | §3.1 |
| `/lectura` | §2.1 极简或区标题 | 显示 | 列表 |
| `/lectura/[slug]` | §2.2 返回态 | **隐藏** | §3.2，阅读控制条上位 |
| `/vocab` | §2.1/区标题 | 显示 | 生词本高亮 |
| `/learn`、`/grammar`、`/talk` 列表 | §2.1/区标题 | 显示 | 留白 §3.3 |
| `/learn/[slug]` 等详情 | §2.2 返回态 | 显示（无底部冲突控件时） | 若该详情页后续加底部控件，按 §3.2 同理隐藏 |
| `/phonics`、`/dissect` | §2.1/区标题 | 显示 | 留白 §3.3 |

> 实现提示：把"隐藏 tab 的路由判定"收成一个纯函数 `shouldHideTabBar(pathname)`，集中维护，避免散落。

---

## 4. 汉堡抽屉 `MobileNav` 去留建议

**建议：弱化保留，复用为"更多"抽屉的内容来源。**

- 有了底部 tab，汉堡作为"主导航入口"已多余 → **移除 `SiteHeader`/精简顶栏里的汉堡按钮触发**（顶栏不再出现汉堡）。
- 但抽屉里的次级区列表（课程/发音/对话/语法/拆解 + 主题切换 + 登录态）仍有价值 → **保留 `MobileNav` 的抽屉面板**，改由底部 tab 的"更多"按钮触发：
  - 把 `MobileNav` 的 `open` 状态上提，或导出一个受控版（`open` / `onClose` 由 `BottomTabBar` 控制）。
  - 抽屉里**移除已进入 tab 的项**（首页/视频/阅读/词库），只留"更多"区：课程、发音、对话、语法、拆解 + 外观设置 + 登录态。
- 断点：抽屉现为 `lg:hidden`；与底部 tab 的 `md:hidden` 对齐改成 `md:hidden`，使 md~lg 区间也走移动外壳。**这是唯一需要动到现有移动导航的点，改动仅限断点字符串与触发源，桌面 `hidden lg:flex` 主导航不动。**

> 若 PM 想最小改动：可第一版"更多"直接 `<Link href="/learn">` 跳一个聚合页，暂不接抽屉；抽屉接入作为后续小迭代。设计上首选受控抽屉。

---

## 5. 桌面隔离清单（血泪三戒落地）

实现时逐项核对，**桌面端零回退**：

- [ ] `BottomTabBar` 容器带 `md:hidden`——桌面绝不出现。
- [ ] 新 `MobileTopBar` 带 `md:hidden`；现有 `SiteHeader` 桌面主体用 `hidden md:flex` 包裹，**只加隔离类、不删内容**。
- [ ] `SiteNav` 的 `hidden lg:flex` 桌面主导航**保持原样**（不要因为对齐断点去动它）。
- [ ] `MobileNav` 改动仅限：触发源（顶栏汉堡 → 底部"更多"）、断点 `lg:hidden`→`md:hidden`、抽屉项裁剪。其余结构/样式不动。
- [ ] 全局正文底部留白用 `md:pb-0` 归零，桌面无多余空白。
- [ ] `tests/` 里依赖的字符串（如 `border-brand-500`、各 nav `label`）尽量保留；新增 tab 标签若与测试断言冲突，先与 Codex2 对齐。

---

## 6. 接入位置与防崩提示

- **接入点**：`BottomTabBar` 加到 `src/app/layout.tsx` 的 `<body>` 内（`{children}` 之后），全站一次接入；组件内部用 `shouldHideTabBar(pathname)` 自管显隐。
- 因为是 `"use client"` 组件读 `usePathname()`，放在 `layout.tsx`（server component）里没问题——Next 允许 server layout 渲染 client 子组件。
- **防崩**：tab 用 `next/link`，切换不整页刷新；"更多"用 `<button>` 不触发导航；详情态 `router.back()` 做 fallback。多页切换、来回点 tab 不应触发 error boundary——验收须真机逐 tab + 来回点验证（票面血泪二戒）。
- 不新增全局 CSS（`.pb-safe`、`glass-*` 已有）；不引入 scratch 文件。

---

## 7. 开放点（需 PM/用户拍板）

1. **tab 第 4 项**："生词本 `/vocab`" vs "课程 `/learn`"——设计建议生词本（高频回看），但若课程是主转化路径可换。
2. **watch 是否完全隐藏 tab**：设计默认"`/watch` 全隐藏"。若希望 watch 列表态也能切 tab，需 watch 页区分列表/播放态再决定（成本更高）。
3. **"更多"形态**：受控抽屉（首选）vs 暂跳聚合页（最小改动）。
4. **断点统一**：把移动导航从 `lg` 收敛到 `md`（本设计采用 `md`）是否 OK——会让平板竖屏也走移动外壳。

---

## 11. PM 最终决定(覆盖前文 tab 提案)— Claude1 2026-06-02

用户拍板,以下为准:

1. **底部 tab = 4 个等宽(grid-cols-4),无首页、无"更多"tab**:
   | tab | 路由 | 图标(lucide 建议) |
   |---|---|---|
   | 视频 | `/watch` | Play / Video |
   | 阅读 | `/lectura` | BookOpen |
   | 课程 | `/learn` | GraduationCap |
   | 语料库 | `/vocab` | Library / Sparkles |
   - 选中态翡翠绿 brand,未选 zinc;≥44px;安全区;`md:hidden`;接入 `layout.tsx` 全站常驻。
2. **不要首页 tab**:app 开门即进内容。`/` 首页在移动端去留 + 默认落地 tab 放到 MOBILE-003 再定;本票底部栏先不含首页。
3. **次级区(发音/对话/语法/拆解/设置/个人)→ 顶部精简汉堡抽屉**(弱化保留的 MobileNav)。顶栏:左汉堡 + 上下文标题/返回 + 搜索图标,精简、像 app。
4. **沿用前文已定**:watch/lectura 详情页隐藏底部 tab(沉浸,让位各自控制条);断点统一 `md`;`shouldHideTabBar(pathname)` 纯函数集中管。
5. 桌面端导航一律不动(`md:hidden`/`hidden md:flex` 隔离)。

---

## 12. PM 最终 IA 闭环(覆盖 §11 顶栏部分)— Claude1 2026-06-02

经与用户讨论,**导航最终形态(以此为准)**:

### 顶栏(精简)
- 左:上下文——tab 根页显 logo/极简;详情页显 返回 + 标题。
- 右(三件):**[管理订阅] [搜索] [头像]**。
- **不要汉堡按钮**(次级区改由头像侧边栏承载)。

### 头像 → 右侧滑出侧边栏(drawer)
- 即把现有 `MobileNav` 抽屉**改由头像触发**(原汉堡触发废弃),右侧滑出(沿用 w-72/毛玻璃/遮罩/锁滚动)。
- 内容:**个人信息**(头像/昵称/会员状态) · **其他功能**(发音 `/phonics`、对话 `/talk`、语法 `/grammar`、拆解 `/dissect`) · **设置/账号** · **Esponal 积分/订阅管理**(对接积分制度 spec)。

### 「管理订阅」= YouTube 订阅频道(注意:非 Esponal 付费)
- 含义:用户 YouTube 登录后,拉取其**订阅的频道**展示。**这是独立新功能**(需 YouTube OAuth `youtube.readonly` scope + `subscriptions.list`),**不在 MOBILE-009 范围**。
- 本票只放**入口图标**,先链占位页/禁用态;真功能 PM 另立 ticket(YT-SUBSCRIPTIONS,待排)。

### 底部 4 tab(不变)
视频/watch · 阅读/lectura · 课程/learn · 语料库/vocab;watch/lectura 详情隐藏;`md:hidden`;接 layout.tsx。

### Esponal 自身积分/会员管理
→ 放**头像侧边栏**内(非顶栏"管理订阅",那个是 YouTube 的)。

---

## 13. 顶栏布局微调(覆盖 §12 顶栏右侧三件)— Claude1 2026-06-02

用户定顶栏三件**位置**(以此为准):
- **最左:头像** → 点击从**左侧**滑出侧边栏(头像在左,抽屉随之改为左滑;内容同 §12:个人信息/发音对话语法拆解/设置/Esponal 积分订阅)。
- **中间:订阅**(YouTube 订阅频道入口,功能见 YT-SUBSCRIPTIONS,本票占位)。
- **最右:搜索**。
- 顶栏整体 `justify-between` 三区布局;精简、无汉堡;`md:hidden`,桌面不动。

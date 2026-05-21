# VOCAB-009 — 全站西语文本统一可点查词

**优先级**：P1（用户体验一致性 + 防止未来新页面遗漏）
**区域**：vocabulary / web / refactor
**依赖**：VOCAB-007 ✅（AI 词形还原）、VOCAB-008 ✅（已学词标记 + CourseLookupText 模式）

---

## 背景

PM 反馈：

> "我建议，在正文里的词我们都尽量让所有西语词汇可以点击查询。"

我们已经在 `/lectura`（VOCAB-008）和 `/learn/[slug]`（VOCAB-008 CourseLookupText）实现了"点词查释义+加词库"。COURSE-005 的 P0 又把这能力带到 `/dissect` 和 `/learn/foundation/[day]`。但还有遗漏，且实现散落在多个文件，**没有统一组件**。

### 当前可点查词的页面

| 页面 | 实现方式 |
|------|---------|
| `/lectura/[slug]` | LecturaReader 内嵌 LookupCard |
| `/learn/[slug]` 课程详情 | `CourseLookupText` 组件 |
| `/learn/foundation/[day]` 七天课例句 | `CourseLookupText`（COURSE-005 P0 复用） |
| `/dissect` 拆解器内容词 | DissectorClient 内嵌 LookupCard（COURSE-005 P0 内联） |
| `/watch` 字幕 | SubtitlePanel + LookupCard |

### 当前**不能**点查的西语文本

| 页面 | 哪些西语文本现在是死的 |
|---|---|
| `/grammar` 语法列表 | 卡片描述里的西语示例（如"el/la/un/una"） |
| `/grammar/[slug]` 语法详情 | 解释正文里的西语例句、变位表、对照表 |
| `/learn/foundation/[day]` contrastBlocks | "Veo a Ana. / I see Ana. / 我看见 Ana..." 这类混合字符串里的西语段 |
| `/learn/foundation` 总览页 | 卡片 subtitle 里的"yo / tú / él / ella..."等 |
| `/learn` 首页 hero / banner 中的任何西语 | 通常没有但要留心 |
| 未来任何新页面 | **没有 default 行为**，每次新加页面要专门接入 |

---

## 目标

1. **抽出统一组件 `<SpanishText>`**：所有"显示西语文本且应该让用户点词查释义"的位置 default 用它
2. **覆盖现有遗漏页面**：`/grammar`、`/grammar/[slug]`、foundation contrastBlocks 等
3. **建立惯例**：未来新页面 default 用 `<SpanishText>`，**不再有"死西语文本"**
4. **分阶段替代散落实现**：Phase A 只替代 `CourseLookupText`；`/lectura`、`/watch` 和 DissectorClient 已有稳定实现，本票不在 Phase A 里重构它们，避免把已验收链路卷进回归面

---

## 技术方案

### 1. 新建 `src/app/components/vocab/SpanishText.tsx`

把 `CourseLookupText` 的逻辑提升、扩展，做成更通用的版本：

```tsx
"use client";

type SpanishTextProps = {
  text: string;
  translation?: string;          // 可选，用于 LookupCard 上下文
  source?: {                     // 可选，决定 vocab 来源类型
    type: "course" | "lectura" | "video" | "dissect" | "grammar";
    url?: string;
    courseRef?: string;
    storySlug?: string;
    paragraphIndex?: number;
    sentence?: string;
  };
  className?: string;
  /** 内嵌单词的额外 className */
  wordClassName?: string;
  /** 交互密度：inline 短例句 / dense 表格 cell / readOnly 只渲染 span 不渲染 button */
  interactionDensity?: "inline" | "dense" | "readOnly";
  /** 词是否进入 Tab 顺序。短例句和变位表 cell 设 true，长正文设 false */
  enableKeyboard?: boolean;
};

export function SpanishText({
  text,
  translation = "",
  source,
  className,
  wordClassName,
  interactionDensity = "inline",
  enableKeyboard = false
}: SpanishTextProps) { /* ... */ }
```

### 1b. 视觉与可达性约束（Claude2 二审吸收）

**桌面端**：
- 默认零装饰：不下划线、不底色、不变文字色、不改 padding（避免行内重排）
- cursor `pointer`（唯一可发现性提示）
- hover：`bg-brand-50` + `text-brand-700`；**绝不再加 `hover:underline`** —— 已学词有 `.saved-word` 虚线，hover 实线会"换线"很闹

**移动端（`@media (hover: none)`）必须破例**：
- 给词加**极轻**底纹 `bg-brand-50/40`，**不加下划线、不改字色、不撑行高**
- 这是"默认就有微弱可发现性"，不是装饰
- active/pressed 反馈强一档 `bg-brand-100`，但仍不撑行高

**已学词**：
- 复用 VOCAB-008 `.saved-word`（深灰虚线下划线 `#4b5563`）
- 桌面 hover 时只改背景和文字色，**不动**下划线
- 移动端 `.saved-word` + `bg-brand-50/40` 叠加（虚线在 baseline 下方、底色在 box 背景，不冲突）

**interactionDensity 三档语义**（必须写死，否则 Codex1 跑偏）：
- `inline`（默认）：词间无额外间距，按钮 padding `px-0.5`，纯依赖父级 leading
- `dense`：表格 cell / 变位表用，按钮 padding `px-1 py-0.5`，自带 `rounded`，hover 命中区更大
- `readOnly`：**只渲染 `<span>`，不渲染 button**（不是 disabled button）。语义=只要文本不要交互

**砍掉冗余 `readOnly` prop** —— 顶层 `readOnly` 和 `interactionDensity="readOnly"` 重复，只保留后者。

**键盘策略**（必须由 component user 显式声明，不要黑盒判断）：
- **短例句（< 12 词）和变位表 cell 必须 `enableKeyboard={true}`**
- **长正文段落、对照表整段必须 `enableKeyboard={false}`**（默认）
- 组件源码顶部留 TODO：未来用 roving tabindex 统一处理

### 2. 词识别策略

- 复用 `CourseLookupText` 现有的 `wordPattern = /([\p{L}áéíóúüñÁÉÍÓÚÜÑ]+)/gu`
- 复用 `normalizeLookupWord` 标准化逻辑
- 复用 `loadSavedForms` 已学词加载（VOCAB-008 `.saved-word` 下划线）

### 3. LookupCard source 类型扩展

`src/app/watch/LookupCard.tsx` 当前 `LookupSource` 枚举只支持 `video | course | lectura`。**新增两个**：

```ts
type LookupSource =
  | { type: "video"; ... }
  | { type: "course"; ... }
  | { type: "lectura"; ... }
  | { type: "dissect"; url: "/dissect"; sentence: string }                    // 新
  | { type: "grammar"; url: string; topicSlug: string; sentence: string };    // 新
```

新增类型在 `/api/vocab/add` 路由里也要识别并存入 `WordEncounter.sourceType`（VOCAB-004 schema 已有 sourceType 字段；这里只是新增枚举值）。同时同步 `src/lib/vocab.ts` 的输入类型/保存逻辑，避免 route 接受了 `dissect | grammar` 但数据层类型仍然收窄或误存。

### 4. 迁移现有调用方

- `src/app/learn/[slug]/CourseLookupText.tsx` → **删除**，调用方改为 `<SpanishText source={{ type: "course", ... }} />`
- `src/app/learn/foundation/[day]/page.tsx` → 把 P0 临时的 `CourseLookupText` 调用换成 `SpanishText`
- **Phase A 明确不动**：`/lectura`、`/watch`、`src/app/dissect/DissectorClient.tsx`。它们都已经通过各自 QA 或 P0 验证，暂时保持稳定。
- Dissector 后续如要迁移，只迁移"内容词查词"部分；骨架词 popover 继续保留 COURSE-005 P0 的视觉和逻辑。

### 5. 接入新页面（字段死清单）

#### `/grammar/[slug]` 字段决策（Codex1 照搬，不要犹豫）

**包**：
- `row.pronoun`、`row.form`（变位表的代词列和变位列，用 `interactionDensity="dense"` + `enableKeyboard={true}`）
- `example.spanish`（例句西语行，用 `interactionDensity="inline"` + `enableKeyboard={true}`）
- comparison `item.spanish`

**不包**：
- `topic.title`（含"现在时变位"等中文）
- `topic.intro`、`topic.analogy`（中文为主，可能含 inline 西语词如"el 表示 the"，混排不抽取）
- `row.person`、`row.chinese`、`example.chinese`、`example.reason`、`rule`（纯中文）
- 侧栏导航 title 链接（纯中文）

#### `/grammar/page.tsx`（列表）

**Phase B 不接入**。所有字段（`group` / `title` / `intro`）都是中文为主，硬抽 inline 西语词破坏阅读流。如未来数据加 `inlineSpanishTokens` 标记再考虑。验收标准 #10 已写明。

#### `/learn/foundation/[day]/page.tsx` contrastBlocks

当前是混合字符串如 `"Veo a Ana. / I see Ana. / 我看见 Ana。a 不翻成..."`。Phase C 改数据结构为 `{ es, en, zh, note }[]`。

**运行时 split 已否决**（中文也用 "/"，note 可能被切断，容错性差）。

#### 视口边界处理（必做）

`CourseLookupText` 现有 `<LookupCard>` 用 `absolute left-0 top-full`——长正文里靠左词贴左屏边、靠右词溢出右屏。SpanishText 还要在窄表格 cell 里用，**必须**给 LookupCard wrapper 加：

```
max-w-[min(20rem,calc(100vw-2rem))]
```

或视口边界检测调整 `left`。Phase A 必须包含这一处修复，否则手机端变位表 cell 弹卡会溢出。

#### savedForms 缓存失效（必做）

`CourseLookupText` 现有 `savedFormsPromise` 是模块单例——用户"加入词库"成功后，同页其他词的 `.saved-word` 状态**不更新**。SpanishText 抽出后必须解决：
- 最小方案：LookupCard onSuccess 后 invalidate savedFormsPromise + 触发 SpanishText 重新加载
- 更稳方案：用 React Context + 订阅机制

Phase A 至少加 TODO 注释 + 最小 invalidate 方案。

#### `/learn/foundation` 总览页

subtitle 字段是西语词列表，**Phase A 不接入**——不要优先把卡片列表变成密集交互区。验收标准 #7 删除。

### 6. 设计原则（完整版见 1b 节）

简要：桌面默认零装饰 + hover 改色不改下划线；移动端默认极轻 `bg-brand-50/40` 提供可发现性；已学词只靠 VOCAB-008 `.saved-word` 虚线；键盘策略由 component user 显式声明。

---

## 验收标准

| # | 检查项 |
|---|---|
| 1 | `src/app/components/vocab/SpanishText.tsx` 存在，导出 `SpanishText` 组件 |
| 2 | LookupCard `LookupSource` 类型新增 `dissect` 和 `grammar` 两个变体 |
| 3 | `/api/vocab/add` 与 `src/lib/vocab.ts` 都接受新两类 sourceType |
| 4 | `CourseLookupText.tsx` 删除，所有调用方迁移到 `SpanishText` |
| 5 | Phase A 不动 `/lectura`、`/watch`、DissectorClient；若后续迁移 Dissector，只迁移内容词查词部分，保留骨架词 popover |
| 6 | `/learn/foundation/[day]` 例句使用 `SpanishText`（替换 P0 的 CourseLookupText 临时方案） |
| 7 | `/learn/foundation` 总览页 subtitle **Phase A 不接入**（已删原计划） |
| 8 | `/learn/foundation/[day]` contrastBlocks 数据结构改为对象数组（选 A），渲染器使用 `SpanishText` 渲染西语部分；Phase C 做，且需要 PM content readthrough |
| 9 | `/grammar/[slug]` 明确西语字段（例句、对照表、词条、变位 cell）可点；不包中文说明或混排正文 |
| 10 | `/grammar` 列表页 Phase B **不接入**（中文为主，混排不抽取） |
| 11 | 已学词在所有接入点都正确显示 `.saved-word` 下划线 |
| 12 | 点击后弹 LookupCard，可"加入词库"，保存时 sourceType 字段正确 |
| 13 | 移动端：不得破坏行高；active/pressed 有反馈；LookupCard 可关闭且不遮挡当前词 |
| 14 | `npm test` 通过，`npm run build` 通过 |
| 15 | UI 视觉过 Claude2 评审（2026-05-21 二审：PASS WITH CHANGES，全部 7 个 P1 已吸收） |
| 16 | Phase A 必含：LookupCard 视口边界处理 + savedForms 缓存失效（最小 invalidate 方案 + TODO） |
| 17 | 移动端 SpanishText 词带极轻 `bg-brand-50/40` 默认可发现性；桌面 hover 不再加 `hover:underline` |

---

## 不在本票范围

- **重新设计 LookupCard 本身**——只扩展 source 枚举，UI 不变
- **/watch 字幕渲染重构**——SubtitlePanel 已经有自己的实现且工作良好，本票不动
- **离线缓存机制**——LookupCard 已有，沿用
- **拆解器骨架词 popover 改造**——保持 COURSE-005 P0 的实现
- **西语**词性识别**升级**——继续靠后端 AI lookup（VOCAB-007）

---

## 文件触动清单

| 文件 | 改动 |
|------|------|
| `src/app/components/vocab/SpanishText.tsx` | **新建** |
| `src/app/watch/LookupCard.tsx` | 扩展 LookupSource 类型 |
| `src/app/api/vocab/add/route.ts` | sourceType 枚举接受新两类 |
| `src/lib/vocab.ts` | sourceType 输入类型/保存逻辑接受新两类 |
| `src/app/learn/[slug]/CourseLookupText.tsx` | **删除** |
| `src/app/learn/[slug]/page.tsx` | 改用 SpanishText |
| `src/app/dissect/DissectorClient.tsx` | **Phase A 不动**；后续如迁移，只改内容词查词部分 |
| `src/app/learn/foundation/[day]/page.tsx` | 替换 CourseLookupText 为 SpanishText |
| `src/app/learn/foundation/page.tsx` | subtitle 字段用 SpanishText（低优先级/可选） |
| `src/content/foundation.ts` | contrastBlocks 结构改为 `{ es, en, zh, note }[]` |
| `src/app/grammar/page.tsx` | 西语示例改用 SpanishText |
| `src/app/grammar/[slug]/page.tsx` | 正文西语全部改用 SpanishText |
| `src/app/lectura/LecturaReader.tsx` | **不动**，避免阅读页回归 |
| `tests/vocab009.test.mjs` | **新建** —— 契约 + 至少一处端到端 |
| `feature_list.json` | 新增 VOCAB-009 |
| `session-handoff.md` | Dev Report |

---

## 测试要点

`tests/vocab009.test.mjs`：

1. `SpanishText` 组件存在，props 含 `text` / `translation?` / `source?` / `className?` / `wordClassName?` / `interactionDensity?` / `enableKeyboard?`（注：**砍掉了顶层 `readOnly`**，由 `interactionDensity="readOnly"` 取代）
2. `LookupCard` `LookupSource` 类型源码含 `"dissect"` 和 `"grammar"` 字符串
3. `CourseLookupText.tsx` 不存在（已删）
4. `/learn/[slug]/page.tsx`、`/learn/foundation/[day]/page.tsx` 都 import `SpanishText`
5. `/grammar/[slug]/page.tsx` import `SpanishText`，且测试要约束只包明确西语字段
6. `src/content/foundation.ts` 的 contrastBlocks 是对象数组（含 es/en/zh 字段），不是字符串数组
7. `/api/vocab/add/route.ts` 和 `src/lib/vocab.ts` 含 `dissect` 和 `grammar` 字符串
8. SpanishText 包含 `max-w-[min(20rem,calc(100vw-2rem))]` 视口边界处理（grep 验证）
9. SpanishText 实现包含已学词缓存 invalidate 路径（grep `savedFormsPromise = null` 或类似）
10. SpanishText 含 `@media (hover: none)` 移动端 `bg-brand-50/40` 样式
11. SpanishText 源码**不含** `hover:underline`（避免和 `.saved-word` 冲突）

---

## 阶段建议

按风险递增分 3 段执行，每段独立 commit：

1. **Phase A（基础抽取，收窄版）**：建 SpanishText 组件 + 扩展 LookupSource 枚举 + 同步 `/api/vocab/add` 与 `src/lib/vocab.ts` + 删 CourseLookupText + 只迁移 `/learn/[slug]` 和 `/learn/foundation/[day]` 中已经使用 CourseLookupText 的位置。**不动 `/lectura`、`/watch`、DissectorClient**。
2. **Phase B（新接入）**：`/grammar/[slug]` 和 `/grammar/page.tsx` 接入 SpanishText。这是新增能力，需要 Codex1 仔细判断哪些位置是"真正的西语文本"。
3. **Phase C（数据结构升级）**：foundation 的 contrastBlocks 改对象数组。这一步要改数据 + 渲染器，最后做，并且需要 PM content readthrough。

每段做完 PM review 再开下一段。

---

## 给 Codex1 的提醒

- 这是**重构 + 接入**双重任务，Phase A 失败回滚成本高，**先确保 CourseLookupText 迁移行为完全一致后再做 Phase B/C**
- `CourseLookupText` 已经过 VOCAB-008 QA 通过，是稳定参考实现。`SpanishText` 行为应该是它的超集（多了 source 类型选项 + 更通用的 props），**不要降级现有行为**
- foundation contrastBlocks 改数据结构会让 7 个 day 的内容文件都要更新，PM 需要再 readthrough 一遍——**Phase C 必须确认 PM 时间**再做

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
  /** 内嵌单词的额外 className（默认无装饰，hover 加亮） */
  wordClassName?: string;
  /** 控制交互密度：inline 用于短例句，dense 用于表格，readOnly 只显示文本 */
  interactionDensity?: "inline" | "dense" | "readOnly";
  /** 是否允许每个词进入 Tab 顺序；长正文和密集表格默认关闭，避免超长 Tab 链 */
  enableKeyboard?: boolean;
  /** 是否禁用查词（仅显示文本，无交互）—— 通常为 false */
  readOnly?: boolean;
};

export function SpanishText({
  text,
  translation = "",
  source,
  className,
  wordClassName,
  interactionDensity = "inline",
  enableKeyboard = false,
  readOnly = false
}: SpanishTextProps) { /* ... */ }
```

### 1b. 视觉与可达性约束（Claude2 P1）

- **默认无装饰**：默认状态不得有下划线、底色、文字颜色变化，也不得加额外 padding 导致行内文本重排。
- **hover/active 轻提示**：hover 只允许轻量 `bg-brand-50` + `text-brand-700`；移动端 active/pressed 需要有反馈，但不得撑高行高。
- **已学词标记**：`.saved-word` 只保留 VOCAB-008 的深灰虚线/下划线，不加底色，不改原有阅读节奏。
- **键盘策略**：逐词 `<button>` 可以支持键盘，但默认不要让长正文每个词都进入 Tab 顺序。`enableKeyboard` 只在短例句、关键表格 cell 或明确需要键盘逐词操作的区域开启。长篇正文后续如需要完整键盘浏览，应另做 roving tabindex，不在本票范围。

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

### 5. 接入新页面

- **`src/app/grammar/page.tsx`**：只包明确的西语示例字段；如果 `topic.intro` 是中文混排，不要整段包 `SpanishText`
- **`src/app/grammar/[slug]/page.tsx`**：只包明确西语字段，例如 `row.pronoun`、`row.form`、`example.spanish`、comparison `item.spanish` 等；不要包中文说明、导航标题或中西混排段落
- **`/learn/foundation/[day]/page.tsx` contrastBlocks**：当前是混合字符串（"Veo a Ana. / I see Ana. / 我看见 Ana..."），需要做轻量解析：
  - 选项 A：调整数据结构，把 contrastBlocks 改成 `{ es, en, zh, note }` 对象数组
  - 选项 B：在渲染时按 `/` 分割，识别第一段为西语
  - 推荐 A（更可靠，但要改 `src/content/foundation.ts` 数据 + 渲染器）
- **`/learn/foundation` 总览页**：subtitle 字段是西语词列表，可作为低优先级接入；不要优先把卡片列表变成密集交互区

### 6. 设计原则

- **默认无装饰**：词不加 hover 前不显示下划线、底色或颜色变化（不要污染阅读节奏）
- **hover 高亮**：hover 时词变 `bg-brand-50` + `text-brand-700`
- **已学词标记**：复用 VOCAB-008 `.saved-word` 类（深灰虚线/下划线），不加底色
- **键盘可达**：短例句/关键 cell 可启用逐词 Tab；长正文和密集表格默认避免超长 Tab 链
- **触摸优化**：移动端 active 状态高亮（点击有反馈），但不得破坏行高

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
| 7 | `/learn/foundation` 总览页卡片 subtitle 用 `SpanishText` 为低优先级可选项，不强制 Phase A 做 |
| 8 | `/learn/foundation/[day]` contrastBlocks 数据结构改为对象数组（选 A），渲染器使用 `SpanishText` 渲染西语部分；Phase C 做，且需要 PM content readthrough |
| 9 | `/grammar/[slug]` 明确西语字段（例句、对照表、词条、变位 cell）可点；不包中文说明或混排正文 |
| 10 | `/grammar` 列表卡片里如有独立西语示例可点；中文混排 intro 不整段包 |
| 11 | 已学词在所有接入点都正确显示 `.saved-word` 下划线 |
| 12 | 点击后弹 LookupCard，可"加入词库"，保存时 sourceType 字段正确 |
| 13 | 移动端：不得破坏行高；active/pressed 有反馈；LookupCard 可关闭且不遮挡当前词 |
| 14 | `npm test` 通过，`npm run build` 通过 |
| 15 | UI 视觉过 Claude2 评审（2026-05-21：PASS WITH CHANGES，本票已吸收 P1/P2 修改） |

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

1. `SpanishText` 组件存在，props 含 `text` / `translation?` / `source?` / `className?` / `readOnly?` / `interactionDensity?` / `enableKeyboard?`
2. `LookupCard` `LookupSource` 类型源码含 `"dissect"` 和 `"grammar"` 字符串
3. `CourseLookupText.tsx` 不存在（已删）
4. `/learn/[slug]/page.tsx`、`/learn/foundation/[day]/page.tsx` 都 import `SpanishText`
5. `/grammar/[slug]/page.tsx` import `SpanishText`，且测试要约束只包明确西语字段
6. `src/content/foundation.ts` 的 contrastBlocks 是对象数组（含 es/en/zh 字段），不是字符串数组
7. `/api/vocab/add/route.ts` 和 `src/lib/vocab.ts` 含 `dissect` 和 `grammar` 字符串
8. `/learn/foundation/page.tsx` 卡片 subtitle 区域用 SpanishText（低优先级，可推迟；若接入必须保持无装饰）

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

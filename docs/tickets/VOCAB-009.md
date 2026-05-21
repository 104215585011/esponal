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
4. **替代散落实现**：把 `CourseLookupText`、DissectorClient 的内联实现都迁移到新组件

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
  /** 是否禁用查词（仅显示文本，无交互）—— 通常为 false */
  readOnly?: boolean;
};

export function SpanishText({
  text,
  translation = "",
  source,
  className,
  wordClassName,
  readOnly = false
}: SpanishTextProps) { /* ... */ }
```

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

新增类型在 `/api/vocab/add` 路由里也要识别并存入 `WordEncounter.sourceType`（VOCAB-004 schema 已有 sourceType 字段；这里只是新增枚举值）。

### 4. 迁移现有调用方

- `src/app/learn/[slug]/CourseLookupText.tsx` → **删除**，调用方改为 `<SpanishText source={{ type: "course", ... }} />`
- `src/app/dissect/DissectorClient.tsx` → 内容词渲染部分改用 `<SpanishText>`（仍然只在内容词渲染时用，骨架词的 popover 逻辑保留）
- `src/app/learn/foundation/[day]/page.tsx` → 把 `CourseLookupText` 调用换成 `SpanishText`
- `src/app/lectura/LecturaReader.tsx` → 把内联 tokenize 换成 `SpanishText`（如果改动太大可保留，但要确认行为一致）

### 5. 接入新页面

- **`src/app/grammar/page.tsx`**：卡片 description 里的西语示例字段（如有），用 `SpanishText` 包
- **`src/app/grammar/[slug]/page.tsx`**：所有正文里的西语词条、例句、变位表的西语 cell，用 `SpanishText` 包
- **`/learn/foundation/[day]/page.tsx` contrastBlocks**：当前是混合字符串（"Veo a Ana. / I see Ana. / 我看见 Ana..."），需要做轻量解析：
  - 选项 A：调整数据结构，把 contrastBlocks 改成 `{ es, en, zh, note }` 对象数组
  - 选项 B：在渲染时按 `/` 分割，识别第一段为西语
  - 推荐 A（更可靠，但要改 `src/content/foundation.ts` 数据 + 渲染器）
- **`/learn/foundation` 总览页**：subtitle 字段是西语词列表，可以 SpanishText 包

### 6. 设计原则

- **默认无装饰**：词不加 hover 前不显示下划线（不要污染阅读节奏）
- **hover 高亮**：hover 时词变 brand-50 背景 + brand-700 文字
- **已学词标记**：复用 VOCAB-008 `.saved-word` 类（深灰虚线下划线）
- **键盘可达**：每个词包成 `<button>`，可 Tab 聚焦 + 回车触发
- **触摸优化**：移动端 active 状态高亮（点击有反馈）

---

## 验收标准

| # | 检查项 |
|---|---|
| 1 | `src/app/components/vocab/SpanishText.tsx` 存在，导出 `SpanishText` 组件 |
| 2 | LookupCard `LookupSource` 类型新增 `dissect` 和 `grammar` 两个变体 |
| 3 | `/api/vocab/add` 接受新两类 sourceType |
| 4 | `CourseLookupText.tsx` 删除，所有调用方迁移到 `SpanishText` |
| 5 | DissectorClient 内容词渲染部分改用 `SpanishText` |
| 6 | `/learn/foundation/[day]` 例句使用 `SpanishText`（替换 P0 的 CourseLookupText 临时方案） |
| 7 | `/learn/foundation` 总览页卡片 subtitle 用 `SpanishText`（可选高亮） |
| 8 | `/learn/foundation/[day]` contrastBlocks 数据结构改为对象数组（选 A），渲染器使用 `SpanishText` 渲染西语部分 |
| 9 | `/grammar/[slug]` 正文里所有西语文本（例句、对照表、词条）都可点 |
| 10 | `/grammar` 列表卡片里如有西语示例也可点 |
| 11 | 已学词在所有接入点都正确显示 `.saved-word` 下划线 |
| 12 | 点击后弹 LookupCard，可"加入词库"，保存时 sourceType 字段正确 |
| 13 | 移动端：词按钮触控区 ≥44px（如有困难可妥协，但 hover 状态明确） |
| 14 | `npm test` 通过，`npm run build` 通过 |
| 15 | UI 视觉过 Claude2 评审（重点：默认无装饰 + hover 高亮的视觉是否舒服） |

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
| `src/app/learn/[slug]/CourseLookupText.tsx` | **删除** |
| `src/app/learn/[slug]/page.tsx` | 改用 SpanishText |
| `src/app/dissect/DissectorClient.tsx` | 内容词渲染部分改用 SpanishText |
| `src/app/learn/foundation/[day]/page.tsx` | 替换 CourseLookupText 为 SpanishText |
| `src/app/learn/foundation/page.tsx` | subtitle 字段用 SpanishText |
| `src/content/foundation.ts` | contrastBlocks 结构改为 `{ es, en, zh, note }[]` |
| `src/app/grammar/page.tsx` | 西语示例改用 SpanishText |
| `src/app/grammar/[slug]/page.tsx` | 正文西语全部改用 SpanishText |
| `src/app/lectura/LecturaReader.tsx` | （可选）迁移到 SpanishText 统一行为 |
| `tests/vocab009.test.mjs` | **新建** —— 契约 + 至少一处端到端 |
| `feature_list.json` | 新增 VOCAB-009 |
| `session-handoff.md` | Dev Report |

---

## 测试要点

`tests/vocab009.test.mjs`：

1. `SpanishText` 组件存在，props 含 `text` / `translation?` / `source?` / `className?` / `readOnly?`
2. `LookupCard` `LookupSource` 类型源码含 `"dissect"` 和 `"grammar"` 字符串
3. `CourseLookupText.tsx` 不存在（已删）
4. `/learn/[slug]/page.tsx`、`/learn/foundation/[day]/page.tsx`、`/dissect/DissectorClient.tsx` 都 import `SpanishText`
5. `/grammar/[slug]/page.tsx` import `SpanishText`
6. `src/content/foundation.ts` 的 contrastBlocks 是对象数组（含 es/en/zh 字段），不是字符串数组
7. `/api/vocab/add/route.ts` 含 `dissect` 和 `grammar` 字符串
8. `/learn/foundation/page.tsx` 卡片 subtitle 区域用 SpanishText（或保留无装饰但仍可点）

---

## 阶段建议

按风险递增分 3 段执行，每段独立 commit：

1. **Phase A（基础抽取）**：建 SpanishText 组件 + 扩展 LookupSource 枚举 + 删 CourseLookupText + 迁移 `/learn/[slug]` 和 `/learn/foundation/[day]` 和 DissectorClient 三个调用方。这 3 个调用方都已经在 P0 接入了类似行为，迁移到新组件不应该有行为变化。
2. **Phase B（新接入）**：`/grammar/[slug]` 和 `/grammar/page.tsx` 接入 SpanishText。这是新增能力，需要 Codex1 仔细判断哪些位置是"真正的西语文本"。
3. **Phase C（数据结构升级）**：foundation 的 contrastBlocks 改对象数组。这一步要改数据 + 渲染器，最后做。

每段做完 PM review 再开下一段。

---

## 给 Codex1 的提醒

- 这是**重构 + 接入**双重任务，Phase A 失败回滚成本高，**先确保所有现有调用方行为完全一致后再做 Phase B/C**
- `CourseLookupText` 已经过 VOCAB-008 QA 通过，是稳定参考实现。`SpanishText` 行为应该是它的超集（多了 source 类型选项 + 更通用的 props），**不要降级现有行为**
- foundation contrastBlocks 改数据结构会让 7 个 day 的内容文件都要更新，PM 需要再 readthrough 一遍——**Phase C 必须确认 PM 时间**再做

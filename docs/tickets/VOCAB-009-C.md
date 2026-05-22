# VOCAB-009-C — foundation contrastBlocks 改对象数组 + 接入 SpanishText

**优先级**：P3（体验完整性，不阻塞任何主流程）
**类型**：从 VOCAB-009 Phase C 拆出
**依赖**：VOCAB-009 ✅（SpanishText 已就绪）

---

## 背景

VOCAB-009 已经把全站大部分西语文本接入 SpanishText 查词。唯一遗留是 `/learn/foundation/[day]` 的 **西英差异** 引用块——当前数据是混合字符串如：

```
"Veo a Ana. / I see Ana. / 我看见 Ana。a 不翻成"到"，它标记具体的人。"
```

混合字符串直接渲染时无法把"Veo a Ana."这段西语单独抽出来包 SpanishText。

## 为什么不在 VOCAB-009 主票里做

PM 必须重新校对 7 天 × ~3 条/天 = ~21 条 contrastBlocks 的拆解（es/en/zh/note 4 字段），属于内容工作量，PM 时间未确认前不强推。

---

## 方案

### 1. 改数据结构 `src/content/foundation.ts`

```ts
type FoundationContrastBlock = {
  es: string;
  en: string;
  zh: string;
  note?: string;  // 可选解释（如"a 不翻成'到'，它标记具体的人"）
};

// FoundationLesson 类型里
contrastBlocks: FoundationContrastBlock[];
```

7 个 day 的 contrastBlocks 全量改写，PM **必须通读校对**。

### 2. 渲染器 `src/app/learn/foundation/[day]/page.tsx`

```tsx
{lesson.contrastBlocks.map((block, i) => (
  <blockquote
    className="border-l-2 border-brand-200 pl-3 text-sm leading-7 text-gray-700"
    key={i}
  >
    <SpanishText
      className="block font-medium text-gray-900"
      enableKeyboard={true}
      source={{ type: "course", url: sourceUrl, courseRef, sentence: block.es }}
      text={block.es}
      translation={block.zh}
    />
    <p className="text-gray-500">{block.en}</p>
    <p>
      {block.zh}
      {block.note ? <span className="text-gray-500"> · {block.note}</span> : null}
    </p>
  </blockquote>
))}
```

保持现有 `border-l-2 border-brand-200 pl-3` 引用块样式。3 行紧凑（es / en / zh+note），不要变 4 行。

---

## 验收

| # | 检查 |
|---|---|
| 1 | `src/content/foundation.ts` 的 `FoundationLesson.contrastBlocks` 类型从 `string[]` 改为 `FoundationContrastBlock[]` |
| 2 | 7 个 day 的 contrastBlocks 全部填充新结构（es/en/zh + 可选 note）并经 PM 校对 |
| 3 | `/learn/foundation/[day]/page.tsx` 用 SpanishText 渲染 es 行 |
| 4 | 引用块视觉：3 行紧凑（es/en/zh+note），保留 `border-l-2 border-brand-200 pl-3` |
| 5 | npm test 通过，npm run build 通过 |

---

## 不在范围

- 改 `usageExamples` 结构（已经是对象数组，VOCAB-009 已接入）
- 改 `comparisonRows` 结构（已经是对象数组）
- 七天课内容字数补充（独立内容质量 ticket 才做）

---

## 文件触动清单

| 文件 | 改动 |
|------|------|
| `src/content/foundation.ts` | 类型 + 7 个 day 数据迁移 |
| `src/app/learn/foundation/[day]/page.tsx` | contrastBlocks 渲染器改 |
| `tests/vocab009c.test.mjs` | 新建：契约 + 至少一条 SpanishText 包裹检测 |
| `feature_list.json` | 更新 VOCAB-009-C 状态 |
| `session-handoff.md` | Dev Report |

---

## 给 Codex1 的提醒

- 数据迁移时**保留原 note 内容**（如"a 不翻成'到'，它标记具体的人"），不要丢
- 拆字符串时小心 `/` 分隔——中文也用 `/`，最好手工拆，不要自动 split
- 完成后 PM 必须通读 7 天 contrastBlocks 才能 ready_for_qa

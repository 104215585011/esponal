# PHRASE-001 — 阅读/字幕里的固定搭配高亮 + 短语 lookup + 嵌套查询

**类型**：前端 + 后端 + UI 设计
**前置依赖**：LEX-001 完成（数据已在）
**预估**：4-6 天
**优先级**：高（让 LEX-001 的 436 条短语对用户可见 + 可点）

---

## 背景与价值

LEX-001 已经攒了 436 条 A1-A2 固定搭配（collocation/phrase/idiom）在 LexiconEntry 里。但目前**用户在阅读文章 / 看字幕时看不到任何短语提示**——只能逐词点击查询单词。

PHRASE-001 让短语「浮现」出来：在西语文本中识别固定搭配 → 视觉提示 → 点击弹短语 lookup card → 例句里的西语词可继续点击叠加单词卡。

---

## 用户体验目标

读到 `Tengo que comer ahora` 时：

1. `Tengo que` 这段有**暖色淡底**视觉提示（不刺眼，不破坏阅读流）
2. 点击该区域 → 弹**短语 lookup card** 显示「tener que / 必须 / 用法说明 / 例句」
3. 短语卡里的例句西语词都可点 → 弹**单词 lookup card 叠在上方**（最多 2 层）
4. 单字 `Tengo / comer / ahora` 单独点击仍弹单词卡（行为不变）

---

## PM 已拍板决策

| 决策 | 选项 |
|---|---|
| 匹配策略 | **混合**：名词性短语字面匹配；动词性 collocation 接 `tryConjugateVerb` 做归并（`Tengo que → tener que`）|
| 视觉样式 | 背景填充类（不用下划线，避免和已收藏词 `.saved-word` 撞车）；具体由 Gemini1 出 mock |
| 单字点击 | 不变，单击 token = 单词 lookup |
| 短语点击 | 高亮区域整体点击 = 短语 lookup card |
| 叠卡模式 | Stack（不是 replace）|
| 叠卡深度上限 | **2 层**（第 3 层及以上禁止打开）|
| 适用页面 | `/lectura` + `/watch` + `/dissect` + `/grammar`（不含 `/talk`）|
| 不加「拆字提示」 | 用户自然探索 |

---

## 实施三段

### 段 1：UI 设计（Gemini1，先做）

输出 `docs/tickets/PHRASE-001-design.md`，含 4 个 mock：

| Mock | 内容 |
|---|---|
| 1 | 短语高亮在文章中的样子（light + dark mode 各一张）|
| 2 | 短语 lookup card vs 单词 lookup card 的视觉对比（同框架 + 微差异：顶部 amber accent + `[固定搭配]` badge）|
| 3 | 双层叠卡的视觉关系（第 2 层阴影更深 / z-index 更高，视觉层级清晰）|
| 4 | 短语高亮 ∩ 已收藏词下划线叠加（验证两个视觉信号不冲突）|

**约束**：
- 沿用 `docs/DESIGN-SYSTEM.md` 的 token，**不引入新色**（用现有 `brand-gold` / `amber-*` 即可）
- 通过 `docs/UI-DESIGN-CONSTRAINTS.md` 七条禁区核查
- 暗色模式下 amber 不要过亮，建议 `dark:bg-amber-950/30`

### 段 2：后端短语检测（Codex1，可与段 1 并行）

#### 2.1 新增 `src/lib/lexicon-phrases.ts`

`detectPhrasesInText(text: string): Promise<PhraseSpan[]>`：

```ts
type PhraseSpan = {
  start: number;       // 字符级起始 offset
  end: number;         // 字符级结束 offset (exclusive)
  surface: string;     // 文本中实际出现的字符串（如 "Tengo que"）
  lemma: string;       // 匹配到的 LexiconEntry.lemma（如 "tener que"）
  kind: "collocation" | "phrase" | "idiom";
  lexiconEntryId: string;
};
```

#### 2.2 匹配算法

```
1. 一次性加载所有 kind in (collocation,phrase,idiom) 的 lemma 到内存（约 436 条）
2. 按 lemma 第一个 token 建索引：
   { "por": ["por favor", "por supuesto", ...],
     "tener": ["tener que", "tener ganas de", ...],
     ... }
3. 对输入文本做 token 化（沿用 SpanishText 已有的 tokenizer 规则）
4. 对每个 token 位置：
   a. 取其 lowercase 作为 key 在索引里查
   b. 对候选短语，尝试从该 token 开始向后匹配
      - 字面匹配（name phrase / idiom）
      - 动词归并匹配（如 "Tengo" → 用 tryConjugateVerb 反查 → "tener"，再匹 "tener que"）
   c. 命中 → 加入 PhraseSpan
   d. 多个候选匹中同位置 → 取最长 match（greedy）
5. 返回 spans 数组
```

#### 2.3 新增 API endpoint `/api/lexicon/detect-phrases/route.ts`

- POST，body `{ text: string }`
- 认证 + 限流（复用 `addLimiter` 或新建轻量限流器）
- 返回 `{ spans: PhraseSpan[] }`
- 响应头：`X-Phrase-Detect-Latency-Ms`

#### 2.4 测试

- 测字面匹配：`"Por favor, ven aquí"` → 检出 `por favor`
- 测动词归并：`"Tengo que comer"` → 检出 `tener que`（surface "Tengo que"）
- 测多个短语同句：`"Voy a hacer la compra"` → 检出 `ir a` + `hacer la compra`
- 测嵌入式：`"Acabo de tener ganas de salir"` → 检出 `acabar de` + `tener ganas de`
- 测无匹配：`"Hola mundo"` → 空数组

### 段 3：前端集成（Codex1，blocked by 段 1 + 段 2）

#### 3.1 修改 `src/app/components/SpanishText.tsx`（或现有 tokenizer）

```
1. 组件 mount 时调 /api/lexicon/detect-phrases 拿 spans
2. 渲染时：tokens 与 spans 做合并
   - 普通 token → 单独 <span> 可点击 → 单词 lookup
   - phrase span 覆盖的 tokens → 包成一个外层 <span class="phrase-highlight"> 可点击 → 短语 lookup
   - phrase span 内的 token 仍保留可点击能力（saved-word 标识等）
3. 短语 lookup 触发时调 /api/vocab/lookup?lemma=<phrase.lemma>
```

#### 3.2 LookupCard 加 stack 支持

```
LookupCardStack（新组件 / 改造）
├─ 维护 cards 数组：[{ id, kind:"word"|"phrase", lemma, payload }]
├─ 渲染时按数组顺序叠加（后入更高 z-index）
├─ 关闭顶层 → pop 数组最后一项
├─ 第 2 层卡片 z-index 更高，阴影更深（视觉层级）
├─ 上限 2 层：cards.length >= 2 时拒绝新增（短暂闪一下提示「关闭顶层后再查」即可）
└─ 短语卡的 examples.es 用 SpanishText 渲染，词点击 onClick 触发新增卡到 stack
```

#### 3.3 卡片视觉差异（按 Gemini1 设计稿）

```jsx
// 短语卡
<LookupCardShell amberAccent={true}>
  <Header>
    <Badge>{kind === "collocation" ? "固定搭配" : kind === "phrase" ? "短语" : "习语"}</Badge>
    <Lemma>tener que</Lemma>
  </Header>
  <Translation>必须</Translation>
  <Explanation>{entry.explanationZh}</Explanation>
  <Examples>
    {examples.map(ex => (
      <Example>
        <SpanishText text={ex.es} />  ← 关键：可点击触发叠卡
        <span className="zh">{ex.zh}</span>
      </Example>
    ))}
  </Examples>
</LookupCardShell>
```

#### 3.4 适用页面接入

- `/lectura/[slug]` 阅读：默认开启
- `/watch` 字幕：默认开启，字号小用更轻的样式
- `/dissect` 拆解器：默认开启
- `/grammar/[slug]` 例句：默认开启
- `/talk` 暂不开启

---

## 不在本 ticket 范围（明确排除）

- ❌ 短语收藏到用户个人词库（独立 ticket，未来 PHRASE-002）
- ❌ 短语 SRS 复习（独立 ticket）
- ❌ 短语在词库 dashboard 里的显示（独立 ticket）
- ❌ 让用户自由拖选文本另存为短语（独立 ticket）

---

## 验收标准

### 段 1 设计（Gemini1）
- [ ] 4 个 mock 完成，PM 选定一套
- [ ] 通过禁区清单核查
- [ ] 不引入新设计 token

### 段 2 后端（Codex1 + Codex2）
- [ ] `/api/lexicon/detect-phrases` 上线，5 个测试场景全过
- [ ] 单文本检测 < 200ms（含动词归并）
- [ ] 复用 LexiconEntry 不引入新表

### 段 3 前端（Codex1 + Codex2 + Gemini1 视觉验收）
- [ ] 4 个适用页面短语高亮渲染
- [ ] 点击短语区域弹短语 lookup card
- [ ] 短语卡例句西语词可点击 → 叠加单词卡
- [ ] 2 层上限工作（第 3 层禁止打开）
- [ ] 关闭顶层卡自动回到底层卡
- [ ] 与已收藏词下划线叠加无冲突
- [ ] Light / Dark mode 均正常
- [ ] `npm test` 通过、`npm run build` 通过

### 整体 PM 验收
- [ ] 实测 5 个真实阅读页：能看到短语高亮
- [ ] 点击短语 → 弹卡 → 例句点字 → 叠卡 → 关闭 → 回到短语卡（流程完整）
- [ ] 阅读体验观感：背景填充不刺眼、不打断阅读流

---

## 执行流程

```
Gemini1 出设计稿（PHRASE-001-design.md）
  → PM 选定视觉方向
    → Codex1 段 2（后端）+ 段 3（前端实施按设计稿）
      → Codex2 端到端测试
        → Gemini1 视觉评审
          → Claude1 最终验收 → passing
```

后端段 2 和段 1 可以并行（互不依赖）。

# LEX-CLEANUP-001 — 清理 phrase-kind 中的单 token 误分类

**类型**：数据清洗
**实现**：Codex1
**测试**：Codex2
**前置依赖**：无（独立任务）
**预估**：0.5 天
**优先级**：中（PHRASE-001 已用临时过滤器规避，不阻塞用户体验，但数据应清理）

---

## 背景

LEX-001 Phase 3 用 LLM 生成 phrase 候选 CSV 时，模型把单个动词如 `poder` / `querer` / `gustar` / `comer` 误归类为 `verb_collocation` 写入了 LexiconEntry。

**当前状态**：DB 中 436 条 phrase-kind 里有 **135 条**实际上是单 token 词。

PHRASE-001 已在 `detectPhrasesInText` 加 `lemma: { contains: " " }` 过滤兜底，所以前端高亮不受影响。但数据本身需要清理。

---

## 待处理列表

```sql
SELECT id, lemma, kind, translation_zh
FROM lexicon_entries
WHERE kind IN ('collocation', 'phrase', 'idiom')
  AND lemma NOT LIKE '% %'
ORDER BY kind, lemma;
```

预计 135 条。三种处理方案：

### 方案 A：合并到 kind=word

对每条单 token phrase-kind 条目：
1. 检查是否已存在 `(lemma, kind=word)` 的同 lemma 条目
2. 已存在 → **删除 phrase-kind 条目**（避免重复）
3. 不存在 → **迁移**：把 kind 改成 word，partOfSpeech 按 LLM 补一次（gustar → verb，etc.）

### 方案 B：全部删除

直接删 135 条。代价：失去一些"特殊构式动词"的标注（gustar / soler / encantar 这些倒装动词学习者特别需要知道用法）。

### 方案 C：迁移到新的 `kind=construction`（推荐）

新增 enum 值 `LexiconKind.construction`，专门表示「单动词但有特殊用法」（gustar 倒装、soler+inf、acabar de + inf 等）。这些条目在 lookup 时可以特别展示用法说明，但不参与 phrase 高亮。

**PM 建议方案 C**——既保留了语言学价值，又不污染短语高亮。但 schema 改动稍大，需要 prisma migration。

---

## 实施（如选方案 A）

1. 写脚本 `scripts/lexicon/cleanup-single-token-phrases.mjs --dry-run/--write`
2. 默认 dry-run，输出 will-delete + will-migrate 清单
3. PM 抽检后 --write 执行
4. 完成后 lexicon-phrases.ts 里的 `lemma: { contains: " " }` 过滤可保留作为防御层

## 实施（如选方案 C）

1. Prisma migration 加 `construction` 到 `LexiconKind` enum
2. 写迁移脚本 `scripts/lexicon/migrate-to-construction.mjs --dry-run/--write`
3. 把 135 条单 token 短语 kind 改成 `construction`
4. 给 `/api/vocab/lookup` 加 `construction` kind 的特殊渲染（用法说明优先）
5. PHRASE-001 的 detect 函数维持现状（只查 collocation/phrase/idiom）

---

## 验收

- [ ] PM 选定方案（A / B / C）
- [ ] 脚本支持 --dry-run + --write
- [ ] 执行后 SQL `SELECT count(*) FROM lexicon_entries WHERE kind IN ('collocation','phrase','idiom') AND lemma NOT LIKE '% %'` 返回 0
- [ ] `npm test` 通过
- [ ] PM 实测一个之前误分类的词（如 `gustar`）查询体验

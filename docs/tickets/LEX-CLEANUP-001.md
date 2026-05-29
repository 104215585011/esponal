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

---

## ⚠️ PM 复核结论（2026-05-29，必读，覆盖上面的方案 C 原始描述）

Codex1 首版脚本字面执行了方案 C「把 135 条单 token 全迁 construction」。PM 抽检 dry-run 清单后发现**这是误判**：135 条里只有 10 条真正配得上 `construction`，其余 120+ 条是普通名词/动词被误分类，迁成 construction 会让 `casa`/`comer` 显示莫名其妙的用法说明。

**修正：脚本改为读取 PM 复核决策清单 `data/lexicon-cleanup-001.reviewed.csv`，按 `decision` 列分类执行**，不再无脑全迁。

### 决策清单四类（合计 135）

| decision | 数量 | 脚本动作 |
|---|---|---|
| `construction` | 10 | 见下方特殊处理 |
| `delete-dup` | 60 | 已存在同名 `kind=word` 条目 → **删除**这条 phrase-kind 重复行 |
| `migrate-word` | 61 | 无同名 word → 把该行 `kind` 改成 `word`（保留 lemma/translation 等数据）|
| `delete` | 4 | 命令式变位形态（escriban/lean/repitan/siéntense）→ **删除**（原型 escribir/leer/repetir/sentarse 已存在）|

### construction 的 10 条特殊处理

gustar, encantar, doler, faltar, importar, interesar, parecer, quedar, sobrar, soler

- **8 条无 word 双胞胎**（encantar/doler/faltar/importar/interesar/parecer/sobrar/soler）：把现有 collocation 行 `kind` 改成 `construction`，并把 CSV 的 `usage_note_zh` 写入 `explanationZh`（lookup 已从 explanationZh 暴露 usageNote）。
- **2 条有 word 双胞胎**（gustar, quedar，`has_word_dup=yes`）：删除 collocation 行；把**已存在的 word 行**升级为 `kind=construction`，并写入对应 `usage_note_zh` 到其 `explanationZh`。这样 gustar/quedar 是唯一权威条目且带用法说明。

### 脚本要求（修订版 `scripts/lexicon/cleanup-single-token-phrases.mjs`）

1. 读 `data/lexicon-cleanup-001.reviewed.csv`（lemma, current_kind, has_word_dup, decision, usage_note_zh）
2. 默认 dry-run；输出按 decision 分组的 will-delete / will-migrate / will-construction 清单 + 计数
3. `--write` 才落库；包在事务里，逐条按 decision 执行
4. 跑完自检：`SELECT count(*) FROM lexicon_entries WHERE kind IN ('collocation','phrase','idiom') AND lemma NOT LIKE '% %'` 必须返回 **0**
5. construction 的 10 条写入后，`SELECT count(*) ... WHERE kind='construction'` 应为 10
6. CSV 里的 lemma 若在 DB 找不到对应单 token phrase-kind 行 → 报警不静默跳过（防 CSV 与 DB 漂移）

---

## 验收

- [x] PM 选定方案（C，但修正为按决策清单分类执行，非全迁 construction）
- [x] PM 复核决策清单 `data/lexicon-cleanup-001.reviewed.csv`（已生成，PM 已认可 2026-05-29）
- [ ] 脚本改为读 CSV 按 decision 执行，支持 --dry-run + --write
- [ ] dry-run 计数：construction=10 / delete-dup=60 / migrate-word=61 / delete=4
- [ ] 执行后 SQL `SELECT count(*) FROM lexicon_entries WHERE kind IN ('collocation','phrase','idiom') AND lemma NOT LIKE '% %'` 返回 0
- [ ] `SELECT count(*) FROM lexicon_entries WHERE kind='construction'` 返回 10，且 10 条均有 explanationZh
- [ ] `npm test` 通过
- [ ] PM 实测 `gustar`（应显示 usageNote）、`casa`（应是普通 word，无用法说明）查询体验

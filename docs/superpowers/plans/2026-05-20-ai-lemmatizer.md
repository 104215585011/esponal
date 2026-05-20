# AI Lemmatizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `lookupDictionary` correctly identify the lemma (base form) of any Spanish conjugated verb or inflected word by asking the AI to do it, instead of relying on broken suffix rules.

**Architecture:** Rewrite the `fetchAIEntry` prompt in `src/lib/dictionary.ts` so the AI receives the surface form and returns both the lemma and the dictionary entry in one call. Use the AI-returned lemma as the Redis cache key (`vocab:dict:v3:`). Add a second cache check after the AI call to avoid duplicate writes when multiple forms of the same lemma are looked up.

**Tech Stack:** TypeScript, Next.js API routes, Redis (via `@/lib/redis`), DashScope/GLM-5 API, Node test runner

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `tests/vocab007.test.mjs` | **Create** | 5 source-contract tests for VOCAB-007 |
| `src/lib/dictionary.ts` | **Modify** | `RawAIEntry` type, `fetchAIEntry` prompt + lemma extraction, `lookupDictionary` cache logic |

No other files change. `/api/lemmatize`, `LookupCard`, `VocabAccordion`, and `VocabPage` all consume `entry.lemma` already — they benefit automatically.

---

### Task 1: Write the failing tests

**Files:**
- Create: `tests/vocab007.test.mjs`

- [ ] **Step 1: Create the test file**

```javascript
// tests/vocab007.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = (p) => readFile(p, "utf8");

test("VOCAB-007 AI lemmatizer prompt identifies lemma from surface form", async () => {
  const src = await readText("src/lib/dictionary.ts");
  // Prompt must ask AI to identify the lemma (not assume it's known)
  assert.match(src, /Identify its lemma/);
  // Prompt must include a verb example showing the lemma field in the response shape
  assert.match(src, /"lemma":"tener"/);
});

test("VOCAB-007 RawAIEntry type includes lemma and morphInfo fields", async () => {
  const src = await readText("src/lib/dictionary.ts");
  assert.match(src, /lemma\?:\s*string/);
  assert.match(src, /morphInfo\?:\s*string/);
});

test("VOCAB-007 lookupDictionary uses v3 cache namespace and AI-returned lemma", async () => {
  const src = await readText("src/lib/dictionary.ts");
  assert.match(src, /vocab:dict:v3:/);
  assert.doesNotMatch(src, /vocab:dict:v2:/);
  // Code must read parsed.lemma from AI response
  assert.match(src, /parsed\.lemma/);
  // Code must use a variable called aiLemma
  assert.match(src, /aiLemma/);
});

test("VOCAB-007 falls back to hintLemma when AI returns no lemma field", async () => {
  const src = await readText("src/lib/dictionary.ts");
  // Must reference hintLemma as the fallback variable name
  assert.match(src, /hintLemma/);
  // Must guard against non-string or empty AI lemma
  assert.match(src, /typeof parsed\.lemma/);
});

test("VOCAB-007 second cache check uses AI-returned lemma before writing", async () => {
  const src = await readText("src/lib/dictionary.ts");
  // Two separate safeCacheGet calls: one for hintLemma, one for aiLemma
  const getCalls = (src.match(/safeCacheGet/g) ?? []).length;
  assert.ok(getCalls >= 2, `Expected >=2 safeCacheGet calls, got ${getCalls}`);
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```
node --test tests/vocab007.test.mjs
```

Expected: 5 failures. Typical messages:
- `Expected values to be strictly equal` (regex not matched)
- `Expected >= 2 safeCacheGet calls, got 1`

If any test passes already, re-read the test — it may be checking the wrong thing.

- [ ] **Step 3: Commit the failing tests**

```
git add tests/vocab007.test.mjs
git commit -m "test(VOCAB-007): add failing tests for AI lemmatizer"
```

---

### Task 2: Update `RawAIEntry` type

**Files:**
- Modify: `src/lib/dictionary.ts` (lines around `type RawAIEntry`)

This makes the type tests pass (test 2).

- [ ] **Step 1: Find and replace the `RawAIEntry` type**

Current (around line 46):
```typescript
type RawAIEntry = {
  pos?: string;
  meanings?: string[];
  example?: { es?: string; zh?: string };
  forms?: unknown;
};
```

Replace with:
```typescript
type RawAIEntry = {
  lemma?: string;
  morphInfo?: string;
  pos?: string;
  meanings?: string[];
  example?: { es?: string; zh?: string };
  forms?: unknown;
};
```

- [ ] **Step 2: Run the targeted test to confirm test 2 passes**

```
node --test tests/vocab007.test.mjs
```

Expected: test 2 passes, tests 1/3/4/5 still fail.

---

### Task 3: Rewrite `fetchAIEntry`

**Files:**
- Modify: `src/lib/dictionary.ts` — `fetchAIEntry` function

This makes tests 1 and 4 pass (prompt shape + lemma extraction fallback).

- [ ] **Step 1: Replace the entire `fetchAIEntry` function**

Find the function starting with `async function fetchAIEntry(` and replace it entirely with:

```typescript
async function fetchAIEntry(
  word: string,
  hintLemma: string,
  morphInfo: string | null
): Promise<DictionaryEntry | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  const model = process.env.DASHSCOPE_MODEL?.trim() || "glm-5";
  if (!apiKey) return null;

  const promptLines = [
    "You are a Spanish morphological analyzer and dictionary assistant.",
    `The learner saw the word "${word}" in a Spanish text.`,
    "Step 1: Identify its lemma (infinitive for verbs; singular nominative for nouns/adjectives).",
    "Step 2: Generate a concise dictionary entry for that lemma in Chinese.",
    "Return JSON only, no markdown fences.",
    "",
    'Verb example: {"lemma":"tener","morphInfo":"yo presente indicativo","pos":"v.","meanings":["有","拥有","持有"],"example":{"es":"Tengo hambre.","zh":"我饿了。"}}',
    'Noun example: {"lemma":"libro","pos":"n.m.","meanings":["书"],"example":{"es":"Leo un libro.","zh":"我读一本书。"},"forms":{"singular":"libro","plural":"libros"}}',
    'Adjective example: {"lemma":"rojo","pos":"adj.","meanings":["红色的"],"example":{"es":"La rosa es roja.","zh":"玫瑰是红色的。"},"forms":{"ms":"rojo","fs":"roja","mp":"rojos","fp":"rojas"}}',
    morphInfo ? `Morphology context: ${morphInfo}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptLines }],
        temperature: 0.1
      })
    }
  );

  if (!res.ok) return null;

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned) as RawAIEntry;

  // Use AI-identified lemma; fall back to hintLemma if AI didn't return one
  const aiLemma =
    typeof parsed.lemma === "string" && parsed.lemma.trim().length > 0
      ? parsed.lemma.trim().toLowerCase()
      : hintLemma;

  const partOfSpeech = normalizePartOfSpeech(parsed.pos);
  const meanings = normalizeMeanings(parsed.meanings);
  if (meanings.length === 0) {
    return null;
  }

  const aiMorphInfo =
    typeof parsed.morphInfo === "string" && parsed.morphInfo.trim().length > 0
      ? parsed.morphInfo.trim()
      : morphInfo;

  return {
    word,
    lemma: aiLemma,
    partOfSpeech,
    meanings,
    examples: normalizeExample(parsed.example),
    phonetic: null,
    morphInfo: aiMorphInfo,
    nounForms: validateNounForms(aiLemma, partOfSpeech, parsed.forms),
    adjectiveForms:
      partOfSpeech?.toLowerCase().startsWith("adj")
        ? validateAdjectiveForms(parsed.forms)
        : undefined
  };
}
```

- [ ] **Step 2: Run the targeted tests**

```
node --test tests/vocab007.test.mjs
```

Expected: tests 1 and 4 now pass. Tests 3 and 5 still fail (cache logic not updated yet). Test 2 already passes from Task 2.

---

### Task 4: Update `lookupDictionary` cache logic

**Files:**
- Modify: `src/lib/dictionary.ts` — `lookupDictionary` function

This makes tests 3 and 5 pass (v3 namespace + two safeCacheGet calls + aiLemma variable).

- [ ] **Step 1: Replace the entire `lookupDictionary` function**

Find the function starting with `export async function lookupDictionary(` and replace it entirely with:

```typescript
export async function lookupDictionary(wordInput: string): Promise<DictionaryEntry | null> {
  const word = normalizeWord(wordInput);
  if (!word) return null;

  const lemmaDict = await loadLemmaDict();
  const dictEntry = lemmaDict[word];
  const hintLemma = inferLemma(word, dictEntry);
  const morphInfo = isPlaceholder(dictEntry?.morphInfo) ? null : (dictEntry?.morphInfo ?? null);

  // Step 1: Check cache with hintLemma (fast path for words already known)
  const hintCacheKey = `vocab:dict:v3:${hintLemma}`;
  const hintCached = await safeCacheGet(hintCacheKey);
  if (hintCached) {
    return { ...(JSON.parse(hintCached) as DictionaryEntry), word, cached: true };
  }

  // Step 2: Ask AI to identify lemma + generate dictionary entry
  const aiEntry = await fetchAIEntry(word, hintLemma, morphInfo).catch((error) => {
    reportLookupFailure(word, error);
    return null;
  });

  if (aiEntry) {
    const aiLemma = aiEntry.lemma;
    const aiCacheKey = `vocab:dict:v3:${aiLemma}`;

    // Step 3: Check cache with AI-returned lemma — another form may have cached this already
    const aiCached = await safeCacheGet(aiCacheKey);
    if (aiCached) {
      return { ...(JSON.parse(aiCached) as DictionaryEntry), word, cached: true };
    }

    // Step 4: Attach conjugations for verbs, write cache, return
    if (isVerbPos(aiEntry.partOfSpeech)) {
      aiEntry.conjugations = tryConjugateVerb(aiLemma) ?? undefined;
    }
    await safeCacheSet(aiCacheKey, aiEntry);
    return aiEntry;
  }

  // Step 5: Degraded fallback — AI unavailable, use lemma-dict data
  const partOfSpeech = isPlaceholder(dictEntry?.partOfSpeech)
    ? null
    : (dictEntry?.partOfSpeech ?? null);

  return {
    word,
    lemma: hintLemma,
    partOfSpeech,
    meanings: isPlaceholder(dictEntry?.translation)
      ? []
      : [dictEntry?.translation ?? ""].filter(Boolean),
    examples: [],
    phonetic: null,
    morphInfo,
    conjugations: isVerbPos(partOfSpeech)
      ? (tryConjugateVerb(hintLemma) ?? undefined)
      : undefined,
    degraded: true
  };
}
```

- [ ] **Step 2: Run all VOCAB-007 tests**

```
node --test tests/vocab007.test.mjs
```

Expected: **5/5 pass**.

- [ ] **Step 3: Run the full suite**

```
npm test
```

Expected: **153/153 pass** (148 existing + 5 new). No regressions.

If `npm test` fails on any existing test, check whether `vocab004.test.mjs` references `vocab:dict:v2:` — it might need updating to `vocab:dict:v3:`. Find the assertion and update it.

- [ ] **Step 4: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors. If you see `Property 'lemma' does not exist on type 'RawAIEntry'`, the Task 2 type update wasn't saved — recheck `src/lib/dictionary.ts`.

- [ ] **Step 5: Build check**

```
npm run build
```

Expected: build succeeds. Only existing `<img>` lint warnings and Sentry instrumentation warnings are acceptable.

- [ ] **Step 6: Commit**

```
git add src/lib/dictionary.ts tests/vocab007.test.mjs
git commit -m "feat(VOCAB-007): AI lemmatizer — identify lemma from conjugated forms

Rewrite fetchAIEntry prompt to ask the AI to identify the lemma from
any surface form before generating the dictionary entry. Use the
AI-returned lemma as the Redis cache key (vocab:dict:v3:). Add a second
cache check after AI call to avoid duplicate writes when multiple forms
of the same lemma are looked up concurrently.

Fixes lookup of conjugated verbs: tengo→tener, fue→ser/ir, vamos→ir,
hablaron→hablar, etc."
```

---

### Task 5: Update `feature_list.json` and `session-handoff.md`

**Files:**
- Modify: `feature_list.json`
- Modify: `session-handoff.md`

- [ ] **Step 1: Add VOCAB-007 entry to `feature_list.json`**

Open `feature_list.json` and append this object inside the top-level array (after the VOCAB-006 entry, before the closing `]`):

```json
,
  {
    "id": "VOCAB-007",
    "priority": 41,
    "area": "vocabulary",
    "title": "AI 词形还原（变位词查词修复）",
    "user_visible_behavior": "用户点击任意西班牙语变位词（如 tengo/fue/vamos/hablaron）时，查词卡正确显示原形（tener/ser·ir/ir/hablar）及对应释义，不再查询变位形式本身。",
    "status": "ready_for_qa",
    "verification": [
      "tests/vocab007.test.mjs 5/5 通过",
      "npm test 153/153 通过",
      "npm run build 通过",
      "src/lib/dictionary.ts 使用 vocab:dict:v3: 缓存命名空间",
      "fetchAIEntry prompt 含 Identify its lemma 指令"
    ],
    "evidence": "",
    "notes": "依赖 VOCAB-004（dictionary.ts 基础结构）。改动只在 src/lib/dictionary.ts 一个文件。v2 缓存条目被抛弃，v3 首次查询会重新向 AI 请求，之后命中缓存。"
  }
```

- [ ] **Step 2: Add handoff note to `session-handoff.md`**

Prepend the following block at the top of `session-handoff.md` (after the `# Session Handoff` heading):

```markdown
## Codex1 Dev Report — VOCAB-007 (2026-05-20)

### 完成
- 实现 AI 词形还原：`src/lib/dictionary.ts` 的 `fetchAIEntry` prompt 重写，让 AI 在返回词典条目的同时识别 lemma。
- `RawAIEntry` 类型新增 `lemma?: string` 和 `morphInfo?: string`。
- `lookupDictionary` 缓存命名空间从 `v2` 升到 `v3`，使用 AI 返回的 lemma 作为 key。
- 新增 `tests/vocab007.test.mjs`（5 个测试）。

### 验证
- `node --test tests/vocab007.test.mjs`：5/5 通过
- `npm test`：153/153 通过
- `npm run build`：通过

### 效果
- "tengo" → lemma "tener"，释义正确
- "fue" → AI 判断为 "ser" 或 "ir"（无上下文时可接受）
- "vamos" → lemma "ir"
- "hablaron" → lemma "hablar"
- 同一 lemma 的任意变位形式第二次查词时命中 Redis 缓存

### 下一步
- Codex2：QA VOCAB-007（验证 prompt 含 lemma 指令、v3 cache key、fallback 路径）
- PM：部署后人工点击几个变位词确认显示正确原形
```

- [ ] **Step 3: Commit**

```
git add feature_list.json session-handoff.md
git commit -m "chore(VOCAB-007): update tracker and handoff"
```

---

## Self-Review

**Spec coverage:**
- ✅ Prompt asks AI to identify lemma — Task 3
- ✅ AI returns `lemma` field in response shape — Task 3 (example in prompt)
- ✅ `RawAIEntry` includes `lemma?: string` — Task 2
- ✅ `aiLemma` used as cache key — Task 4
- ✅ Cache bumped to `v3` — Task 4
- ✅ Second `safeCacheGet` with `aiLemma` before writing — Task 4
- ✅ Fallback to `hintLemma` when AI returns no lemma — Task 3 (the `typeof parsed.lemma` guard)
- ✅ Degraded path unchanged — Task 4 (Step 5 in the function)
- ✅ `morphInfo` from AI response used when available — Task 3
- ✅ Tests cover all 5 scenarios from spec — Task 1

**Placeholder scan:** No TBD, TODO, or "similar to" references. All code blocks are complete.

**Type consistency:**
- `hintLemma` — introduced in Task 4 (`lookupDictionary`), referenced in Task 3 (`fetchAIEntry` signature unchanged — it still takes `hintLemma` as second param)
- `aiLemma` — defined in both `fetchAIEntry` (return value sets `lemma: aiLemma`) and `lookupDictionary` (reads `aiEntry.lemma`)
- `safeCacheGet` / `safeCacheSet` — existing helpers, signatures unchanged
- `RawAIEntry` — updated in Task 2, consumed in Task 3 ✅

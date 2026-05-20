# AI Lemmatizer — Design Spec

**Date**: 2026-05-20  
**Feature ID**: VOCAB-007  
**Status**: Approved

---

## Problem

When a learner clicks a conjugated verb form (e.g., "tengo", "fue", "vamos", "hicieron"), the current pipeline fails to identify the correct lemma:

1. `lemma-dict.json` (extension static dict) covers only a small fraction of conjugated forms.
2. `inferLemma()` applies only 4 suffix rules (`-ían/-aban/-aron/-ieron`), missing all stem-changing and highly-irregular verbs.
3. `vendor/spanish-verbs` has irregular tables only for `ser` and `ir`.
4. As a result, `fetchAIEntry` receives `lemma = "tengo"` instead of `"tener"`, and the AI generates a wrong or empty entry.

---

## Goal

For any Spanish word form a learner clicks — conjugated verb, inflected noun, declined adjective — correctly identify the lemma and return an accurate dictionary entry. Coverage should be comprehensive (not limited to a fixed verb list).

---

## Approach: AI-as-Lemmatizer

Delegate lemma identification to the AI in the same API call that generates the dictionary entry. No additional packages or static data files are needed.

### Why this approach

- **100% coverage**: The AI has complete knowledge of Spanish morphology including all irregular verbs, stem changes, and suppletive forms.
- **Zero extra latency**: Lemma identification and dictionary generation happen in one call.
- **Cache efficiency**: Results are cached under the AI-returned lemma. Subsequent lookups of any form of the same lemma (tengo/tienes/tiene/tendrá) all hit the same cache key.
- **Low complexity**: One file changes (`src/lib/dictionary.ts`), no new dependencies, no build steps.

---

## Design

### 1. `fetchAIEntry` — New Prompt

Replace the current prompt (which assumes `lemma` is already known) with one that asks the AI to:
1. Identify the lemma from the surface form.
2. Generate the dictionary entry for that lemma.

**Prompt template:**

```
You are a Spanish morphological analyzer and dictionary assistant.
The learner saw the word "${word}" in a Spanish text.
Step 1: Identify its lemma (infinitive for verbs; singular nominative for nouns/adjectives).
Step 2: Generate a concise dictionary entry for that lemma in Chinese.
Return JSON only, no markdown fences.

Verb example:
{"lemma":"tener","morphInfo":"yo presente indicativo","pos":"v.","meanings":["有","拥有","持有"],"example":{"es":"Tengo hambre.","zh":"我饿了。"}}

Noun example:
{"lemma":"libro","pos":"n.m.","meanings":["书"],"example":{"es":"Leo un libro.","zh":"我读一本书。"},"forms":{"singular":"libro","plural":"libros"}}

Adjective example:
{"lemma":"rojo","pos":"adj.","meanings":["红色的"],"example":{"es":"La rosa es roja.","zh":"玫瑰是红色的。"},"forms":{"ms":"rojo","fs":"roja","mp":"rojos","fp":"rojas"}}
[optional] Morphology context: ${morphInfo}
```

`morphInfo` from `lemma-dict` is appended only when non-null, as a hint (not authoritative).

### 2. Parsing the AI Response

Add `lemma?: string` and `morphInfo?: string` to the `RawAIEntry` type.

Extract and validate the AI-returned lemma:

```typescript
const aiLemma =
  typeof parsed.lemma === "string" && parsed.lemma.trim().length > 0
    ? parsed.lemma.trim().toLowerCase()
    : hintLemma; // fallback to inferLemma result
```

Use `aiLemma` for:
- The `lemma` field in the returned `DictionaryEntry`
- The Redis cache key

### 3. Cache Key

Bump from `vocab:dict:v2:${lemma}` to **`vocab:dict:v3:${lemma}`**.

Rationale:
- v2 entries may have been written under wrong keys (e.g., `vocab:dict:v2:tengo` instead of `vocab:dict:v2:tener`).
- v3 starts clean; correct entries are written and read under the AI-returned lemma.
- Existing correct v2 entries (e.g., `vocab:dict:v2:hablar`) are simply re-fetched once, then cached correctly under v3.

### 4. `lookupDictionary` — Updated Flow

```
lookupDictionary(word)
  1. Normalize word
  2. Load lemma-dict → get hintLemma (from inferLemma) + morphInfo hint
  3. Check Redis vocab:dict:v3:${hintLemma}
     → HIT: return cached entry (word field updated to current form)
  4. fetchAIEntry(word, hintLemma, morphInfo)
     → AI returns { lemma: aiLemma, ... }
     → Write to Redis vocab:dict:v3:${aiLemma}
     → Return entry with lemma = aiLemma
  5. On AI failure → degraded path (unchanged from today)
```

Note: Step 3 uses `hintLemma` for the initial cache check. If the AI returns a different `aiLemma` (e.g., "tener" when hintLemma was "tengo"), the cache is written under the correct key. On the next lookup of any form that the AI maps to "tener", step 3 will hit — because `inferLemma("tienes")` returns "tienes" (not "tener"), so step 3 misses and step 4 runs again, but writes to the same `v3:tener` key. **To close this gap:** after AI returns `aiLemma`, also check Redis for `vocab:dict:v3:${aiLemma}` before writing — if it already exists, return the cached version instead of overwriting.

### 5. Fallback (Degraded Path — Unchanged)

When AI is unavailable (no API key, network error):
- `inferLemma(word, dictEntry)` still provides a best-effort lemma.
- `lemma-dict` translation used as meaning if available.
- `tryConjugateVerb` still generates conjugation tables for recognized infinitives.
- Behavior identical to today.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/dictionary.ts` | New prompt, parse `lemma`/`morphInfo` from AI response, bump cache to v3 |
| `tests/vocab007.test.mjs` | New test file covering prompt content, lemma extraction, cache key, fallback |

No other files change. The `/api/lemmatize` route, `LookupCard`, `VocabAccordion`, and `VocabPage` all consume `entry.lemma` already — they benefit automatically.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| AI returns no `lemma` field | Fall back to `inferLemma` result |
| AI returns empty/non-string `lemma` | Fall back to `inferLemma` result |
| AI call fails entirely | Existing degraded path (lemma-dict translation) |
| Ambiguous homograph (fue = ser/ir) | AI picks one without sentence context; acceptable for A1-A2 |

---

## Testing

New file: `tests/vocab007.test.mjs`

| Test | What it checks |
|------|----------------|
| Prompt includes `word` and asks for `lemma` field | `fetch` mock, assert request body |
| AI-returned lemma used in response | `lookupDictionary("tengo").lemma === "tener"` |
| Cache written under AI lemma | Redis mock: set key is `vocab:dict:v3:tener` |
| Second form hits same cache | "tienes" resolves → AI returns "tener" → cache hit for `v3:tener` |
| No `lemma` in AI response → fallback | Returns entry without crash, lemma from `inferLemma` |
| AI failure → degraded path | Returns entry from lemma-dict, no throw |

---

## Out of Scope

- Sentence context for homograph disambiguation (fue = ser vs. ir) — future ticket
- Noun/adjective inflection reverse lookup (this design handles it via AI, same path as verbs)
- Changes to `vendor/spanish-verbs` or conjugation display — unrelated

---

## Success Criteria

1. Clicking "tengo" → lemma shown as "tener", meaning "有/拥有"
2. Clicking "fueron" → lemma shown as "ir" or "ser" (AI judgment), correct meaning
3. Clicking "hablaron" → lemma "hablar", meaning correct
4. Second click on any form of a previously-seen lemma → instant response (cache hit)
5. `npm test` passes (148 + new vocab007 tests)
6. `npm run build` passes

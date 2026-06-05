# Credits Spend Hooks + Gating Implementation Plan (Phase 2 / 3)

> For agentic workers: implement task-by-task with TDD. Keep the write scope tight, preserve existing desktop/mobile UX, and do not pull payment or quota UI into this phase.

**Goal:** Wire the Phase 1 credits engine into real product entry points so Esponal can meter expensive AI work, enforce plan gates, and refresh balances safely at runtime.

**In scope (Phase 2):**
- Spend hooks for real AI-cost actions
- Plan/feature gating for premium-only capabilities
- Runtime monthly refresh trigger
- Machine-readable API responses for insufficient credits / plan gate states

**Out of scope (Phase 3 / separate specs):**
- Pricing page / quota UI / top-bar balance display
- Payment provider integration
- Founder-seat sales flow

**Primary references:**
- `docs/superpowers/specs/2026-06-01-credits-billing-design.md`
- `docs/superpowers/plans/2026-06-04-credits-engine.md`
- Current Phase 1 implementation under `src/lib/credits/*`

---

## Confirmed hook points from the current codebase

1. **Talk turn spend**
   - `src/app/api/talk/message/route.ts`
   - Charge once per successful assistant turn, not at request open.

2. **TTS spend**
   - `src/app/api/tts/route.ts`
   - Charge only on cache miss; cached audio stays free.

3. **Lookup fallback spend**
   - `src/app/api/vocab/lookup/route.ts`
   - Charge only when local lexicon miss falls through to `lookupDictionary()`.
   - Local lexicon hit remains free.

4. **Phrase/highlight spend + gate**
   - `src/app/api/lexicon/detect-phrases/route.ts`
   - This is the cleanest existing backend hook for phrase extraction usage.
   - Free tier should be gated off; premium+ can use it and get metered by sentence count.

5. **Website subtitle unlock spend**
   - `src/app/api/subtitle/route.ts`
   - Charge only for website-entry uncached generation path.
   - Cache hit remains free.
   - Current source model already exposes enough signal to distinguish cache/server-generated paths.

---

## Phase 2 architecture decisions

- **Runtime refresh should be lazy + idempotent**:
  - On authenticated, credits-sensitive requests, check whether monthly refill is due.
  - If due, apply it inside a transaction before gating/spending.
  - This avoids needing the scheduled job before the product is functional.

- **Gate before expensive work, spend after success when possible**:
  - Talk: reserve/gate before starting stream, commit spend when assistant turn completes.
  - TTS: gate before synth, spend only if uncached synth succeeds.
  - Lookup fallback: gate before external call, spend only if fallback lookup succeeds.
  - Phrase detect: gate + spend around actual analyzed sentence count.
  - Subtitle unlock: gate before expensive server fetch/translate path, spend only if uncached subtitle generation succeeds.

- **API error contract must be machine-readable**:
  - Avoid UI-coupled copy in Phase 2.
  - Return typed JSON errors like `INSUFFICIENT_CREDITS` and `PLAN_UPGRADE_REQUIRED`.
  - Phase 3 UI can translate these into inline upsell surfaces.

- **Do not meter anonymous requests in Phase 2**:
  - If a route is already auth-protected, apply credits to the signed-in user.
  - If a route currently serves anonymous traffic, keep current anonymous behavior unless PM later decides otherwise.
  - Premium-only phrase features should continue to require auth/session to be meaningful.

---

## Task 1: Harden credits service + runtime refresh/gate helpers

**Files**
- Modify: `src/lib/credits/service.ts`
- Create: `src/lib/credits/runtime.ts`
- Test: `tests/credits-phase2.test.mjs`

**Deliverables**
- Add a service-layer guard so `spendCredits()` rejects `costMinor <= 0`.
- Add a reusable helper to load a user credit snapshot:
  - `plan`
  - `creditSource`
  - `creditBalanceMinor`
  - `planExpiresAt`
  - `lastRefillAt`
- Add `refreshCreditsIfDue(userId)`:
  - free: no-op
  - subscription/lifetime: refill only once per monthly boundary
  - writes `CreditTransaction(reason="refill")` when it changes balance
- Add `requireCredits(userId, costMinor)` / `requirePlan(userId, allowedPlans)` style helpers returning machine-readable status.

**TDD checks**
- `spendCredits()` rejects `costMinor <= 0`
- `refreshCreditsIfDue()` is idempotent within the same month
- subscription refresh overwrites
- lifetime refresh accumulates
- helper surfaces distinguish:
  - unauthenticated
  - insufficient credits
  - plan-gated

---

## Task 2: Talk + TTS spend hooks

**Files**
- Modify: `src/app/api/talk/message/route.ts`
- Modify: `src/app/api/tts/route.ts`
- Possibly modify: `src/lib/talk/chat-service.ts` only if needed for a clean post-success commit point
- Test: `tests/credits-phase2.test.mjs`, targeted route/source tests if needed

**Deliverables**
- **Talk**
  - Gate the request on available credits for `ACTION_COST_MINOR.talk_turn`
  - Spend only after a successful completed assistant turn
  - On insufficient credits, return typed JSON error instead of opening stream
- **TTS**
  - Cached TTS remains free
  - Uncached synth path requires available credits for `ACTION_COST_MINOR.tts`
  - Spend only after synth succeeds

**Important constraints**
- Do not double-charge retries for the same failed generation
- Do not change existing SSE shape for successful talk responses
- Preserve current rate-limit behavior

---

## Task 3: Lookup fallback + phrase detection gate/spend

**Files**
- Modify: `src/app/api/vocab/lookup/route.ts`
- Modify: `src/app/api/lexicon/detect-phrases/route.ts`
- Test: `tests/credits-phase2.test.mjs`

**Deliverables**
- **Lookup fallback**
  - Local lexicon hit remains free
  - External `lookupDictionary()` fallback requires credits
  - Spend only when external fallback succeeds
  - Return typed insufficient-credits response instead of generic 500 path when blocked
- **Phrase detection**
  - Free tier blocked (`PLAN_UPGRADE_REQUIRED`)
  - Premium / ultra / lifetime plans allowed
  - Charge `ACTION_COST_MINOR.phrase_extract_per_sentence * sentenceCount`
  - Empty/invalid input stays validation-only, no charge

**Open product assumption for implementation**
- Count sentences with a cheap deterministic splitter on the submitted text.
- Minimum billable count for non-empty valid input is `1`.

---

## Task 4: Website subtitle unlock spend hook

**Files**
- Modify: `src/app/api/subtitle/route.ts`
- Test: `tests/credits-phase2.test.mjs`

**Deliverables**
- Detect whether subtitle response is:
  - cache/extension/local free path
  - website uncached expensive path
- Apply one-price unlock charge only on uncached website-generation path:
  - `video_unlock_short`
  - `video_unlock_mid`
  - `video_unlock_long`
- Bucket duration using current video metadata or the best available server-side duration signal.
- Return typed insufficient-credits response before expensive server fetch when blocked.

**Important constraints**
- Do not charge extension-origin zero-cost path.
- Do not charge cache hits.
- Preserve existing subtitle-source behavior and response shape for successful requests.

---

## Task 5: Shared error contract + regression sweep

**Files**
- Modify only as needed in touched routes
- Test: `tests/credits-phase2.test.mjs`

**Deliverables**
- Standardize JSON error contract for credits-related route failures:
  - `UNAUTHORIZED`
  - `PLAN_UPGRADE_REQUIRED`
  - `INSUFFICIENT_CREDITS`
- Keep existing human-readable Chinese strings out of the contract surface where they would freeze UI prematurely.
- Add one regression slice covering:
  - focused credits tests
  - touched route contracts
  - full `npm test`

---

## Suggested implementation order

1. Task 1 first: service hardening + lazy refresh helpers
2. Task 2: talk + tts
3. Task 3: lookup + phrase detect
4. Task 4: subtitle unlock
5. Task 5: shared error polish + final regression

This order keeps the most reusable runtime logic first, then lands the smallest/clearest spend hooks before the subtitle path.

---

## Verification target before claiming Phase 2 done

- Focused `credits-phase2` tests all green
- Existing `tests/credits-engine.test.mjs` still green
- `npx tsc --noEmit --pretty false`
- `npm run lint:encoding`
- `npm test`
- Handoff explicitly lists which routes now meter credits and which paths remain free by design

---

## Notes for the next worker

- Before touching route code, first add the non-blocking QA follow-up from Phase 1: reject `costMinor <= 0` in `spendCredits()`.
- Do not sneak Phase 3 UI into this branch.
- If subtitle duration bucketing lacks a reliable duration source in the current route, stop and write the exact blocker into `session-handoff.md` rather than guessing.

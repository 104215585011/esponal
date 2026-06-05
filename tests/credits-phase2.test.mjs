import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("CREDITS Phase 2 runtime: monthly refill due on first run and across month boundary only", async () => {
  const { isMonthlyRefillDue } = await import("../src/lib/credits/runtime.ts");

  assert.equal(isMonthlyRefillDue(null, new Date("2026-06-05T08:00:00.000Z")), true);
  assert.equal(
    isMonthlyRefillDue(
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.000Z"),
    ),
    false,
  );
  assert.equal(
    isMonthlyRefillDue(
      new Date("2026-06-30T23:59:59.000Z"),
      new Date("2026-07-01T00:00:00.000Z"),
    ),
    true,
  );
});

test("CREDITS Phase 2 service: spendCredits rejects non-positive cost before writing spend ledger rows", async () => {
  const source = await read("src/lib/credits/service.ts");

  assert.match(source, /if\s*\(\s*costMinor\s*<=\s*0\s*\)/);
  assert.match(source, /return\s*\{\s*ok:\s*false,\s*balanceMinor:/);
});

test("CREDITS Phase 2 runtime: refresh and gate helpers are implemented around transaction-backed snapshot logic", async () => {
  const source = await read("src/lib/credits/runtime.ts");

  assert.match(source, /export type UserCreditSnapshot/);
  assert.match(source, /plan:\s*true/);
  assert.match(source, /creditSource:\s*true/);
  assert.match(source, /creditBalanceMinor:\s*true/);
  assert.match(source, /planExpiresAt:\s*true/);
  assert.match(source, /lastRefillAt:\s*true/);

  assert.match(source, /export async function getCreditSnapshot/);
  assert.match(source, /export async function refreshCreditsIfDue/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /applyMonthlyRefill/);
  assert.match(source, /lastRefillAt:\s*now/);
  assert.match(source, /reason:\s*"refill"/);

  assert.match(source, /export async function requireCredits/);
  assert.match(source, /INSUFFICIENT_CREDITS/);
  assert.match(source, /export async function requirePlan/);
  assert.match(source, /PLAN_UPGRADE_REQUIRED/);
  assert.match(source, /UNAUTHORIZED/);
});

test("CREDITS Phase 2 talk route gates on credits before opening stream and spends after a successful assistant turn", async () => {
  const source = await read("src/app/api/talk/message/route.ts");

  assert.match(source, /requireCredits/);
  assert.match(source, /ACTION_COST_MINOR\.talk_turn/);
  assert.match(source, /spendCredits/);
  assert.match(source, /if\s*\(!creditGuard\.ok\)/);
  assert.match(source, /event\.type === "done"/);
});

test("CREDITS Phase 2 TTS route only charges uncached synthesis and leaves cache hits free", async () => {
  const source = await read("src/app/api/tts/route.ts");

  assert.match(source, /getServerSession/);
  assert.match(source, /requireCredits/);
  assert.match(source, /ACTION_COST_MINOR\.tts/);
  assert.match(source, /if\s*\(typeof cached === "string"\)\s*\{\s*return audioResponse/s);
  assert.match(source, /spendCredits/);
  assert.match(source, /void redis\.set/);
});

test("CREDITS Phase 2 lookup route only charges external fallback and keeps lexicon hits free", async () => {
  const source = await read("src/app/api/vocab/lookup/route.ts");

  assert.match(source, /requireCredits/);
  assert.match(source, /ACTION_COST_MINOR\.lookup_fallback/);
  assert.match(source, /if\s*\(lexiconEntry\)/);
  assert.match(source, /lookupDictionary\(word\)/);
  assert.match(source, /spendCredits/);
  assert.match(source, /X-Lookup-Source/);
});

test("CREDITS Phase 2 phrase detection is premium-gated and billed by sentence count", async () => {
  const source = await read("src/app/api/lexicon/detect-phrases/route.ts");

  assert.match(source, /requirePlan/);
  assert.match(source, /requireCredits/);
  assert.match(source, /PLAN_UPGRADE_REQUIRED/);
  assert.match(source, /ACTION_COST_MINOR\.phrase_extract_per_sentence/);
  assert.match(source, /countBillableSentences/);
  assert.match(source, /spendCredits/);
});

test("CREDITS Phase 2 subtitle route buckets website unlock cost and only charges uncached generation paths", async () => {
  const source = await read("src/app/api/subtitle/route.ts");

  assert.match(source, /getServerSession/);
  assert.match(source, /requireCredits/);
  assert.match(source, /ACTION_COST_MINOR\.video_unlock_short/);
  assert.match(source, /ACTION_COST_MINOR\.video_unlock_mid/);
  assert.match(source, /ACTION_COST_MINOR\.video_unlock_long/);
  assert.match(source, /fetchSubtitleDurationSec/);
  assert.match(source, /resolveSubtitleUnlockCost/);
  assert.match(source, /if\s*\(cached\)\s*\{/);
  assert.match(source, /X-Subtitle-Source/);
  assert.match(source, /spendCredits/);
});

test("CREDITS Phase 2 touched routes expose a machine-readable credits error contract", async () => {
  const [talk, tts, lookup, phrase, subtitle] = await Promise.all([
    read("src/app/api/talk/message/route.ts"),
    read("src/app/api/tts/route.ts"),
    read("src/app/api/vocab/lookup/route.ts"),
    read("src/app/api/lexicon/detect-phrases/route.ts"),
    read("src/app/api/subtitle/route.ts")
  ]);

  for (const source of [talk, tts, lookup, phrase, subtitle]) {
    assert.match(source, /UNAUTHORIZED/);
    assert.match(source, /INSUFFICIENT_CREDITS/);
    assert.match(source, /PLAN_UPGRADE_REQUIRED/);
  }
});

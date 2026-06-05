import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("CREDITS schema: User has credit fields, plan enum, CreditTransaction, sources/reasons", async () => {
  const schema = await read("prisma/schema.prisma");

  assert.match(schema, /plan\s+Plan\s+@default\(free\)/);
  assert.match(schema, /creditSource\s+CreditSource\s+@default\(free\)/);
  assert.match(schema, /creditBalanceMinor\s+Int\s+@default\(0\)/);
  assert.match(schema, /planExpiresAt\s+DateTime\?/);
  assert.match(schema, /lastRefillAt\s+DateTime\?/);
  assert.match(schema, /signupGranted\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /creditTransactions\s+CreditTransaction\[\]/);

  assert.match(
    schema,
    /enum Plan \{[\s\S]*free[\s\S]*premium_m[\s\S]*premium_y[\s\S]*ultra_m[\s\S]*ultra_y[\s\S]*lifetime_premium[\s\S]*lifetime_ultra[\s\S]*\}/,
  );
  assert.match(
    schema,
    /enum CreditSource \{[\s\S]*free[\s\S]*subscription[\s\S]*lifetime[\s\S]*\}/,
  );
  assert.match(schema, /enum CreditReason \{[\s\S]*grant[\s\S]*refill[\s\S]*spend[\s\S]*\}/);
  assert.match(
    schema,
    /model CreditTransaction \{[\s\S]*userId\s+String[\s\S]*deltaMinor\s+Int[\s\S]*reason\s+CreditReason[\s\S]*refType\s+String\?[\s\S]*refId\s+String\?[\s\S]*balanceAfterMinor\s+Int[\s\S]*createdAt\s+DateTime[\s\S]*\}/,
  );
});

test("CREDITS config: plan monthly amounts and action costs in minor units", async () => {
  const { ACTION_COST_MINOR, PLAN_CONFIG, SIGNUP_GRANT_MINOR, toDisplay, toMinor } =
    await import("../src/lib/credits/config.ts");

  assert.equal(toMinor(0.5), 50);
  assert.equal(toMinor(1), 100);
  assert.equal(toDisplay(50), 0.5);
  assert.equal(SIGNUP_GRANT_MINOR, 5000);

  assert.equal(PLAN_CONFIG.premium_m.monthlyMinor, 50000);
  assert.equal(PLAN_CONFIG.ultra_m.monthlyMinor, 100000);
  assert.equal(PLAN_CONFIG.lifetime_premium.monthlyMinor, 50000);
  assert.equal(PLAN_CONFIG.lifetime_ultra.monthlyMinor, 100000);

  assert.equal(PLAN_CONFIG.free.source, "free");
  assert.equal(PLAN_CONFIG.premium_m.source, "subscription");
  assert.equal(PLAN_CONFIG.lifetime_ultra.source, "lifetime");

  assert.equal(ACTION_COST_MINOR.talk_turn, 50);
  assert.equal(ACTION_COST_MINOR.tts, 10);
  assert.equal(ACTION_COST_MINOR.lookup_fallback, 10);
  assert.equal(ACTION_COST_MINOR.phrase_extract_per_sentence, 5);
});

test("CREDITS deduct: success reduces balance, returns ok", async () => {
  const { deduct } = await import("../src/lib/credits/account.ts");
  const result = deduct({ balanceMinor: 100 }, 30);

  assert.equal(result.ok, true);
  assert.equal(result.balanceMinor, 70);
});

test("CREDITS deduct: insufficient leaves balance unchanged, ok=false (never negative)", async () => {
  const { deduct } = await import("../src/lib/credits/account.ts");
  const result = deduct({ balanceMinor: 20 }, 30);

  assert.equal(result.ok, false);
  assert.equal(result.balanceMinor, 20);
});

test("CREDITS refill: free source never refills (one-time)", async () => {
  const { applyMonthlyRefill } = await import("../src/lib/credits/account.ts");
  const result = applyMonthlyRefill({ plan: "free", source: "free", balanceMinor: 10 });

  assert.equal(result.balanceMinor, 10);
});

test("CREDITS refill: subscription OVERWRITES to monthly amount (no rollover)", async () => {
  const { applyMonthlyRefill } = await import("../src/lib/credits/account.ts");
  const result = applyMonthlyRefill({
    plan: "premium_m",
    source: "subscription",
    balanceMinor: 12345,
  });

  assert.equal(result.balanceMinor, 50000);
});

test("CREDITS refill: lifetime ACCUMULATES monthly amount (rollover)", async () => {
  const { applyMonthlyRefill } = await import("../src/lib/credits/account.ts");
  const result = applyMonthlyRefill({
    plan: "lifetime_premium",
    source: "lifetime",
    balanceMinor: 12345,
  });

  assert.equal(result.balanceMinor, 62345);
});

test("CREDITS grantSignup: sets balance to signup grant, marks granted", async () => {
  const { grantSignup } = await import("../src/lib/credits/account.ts");
  const result = grantSignup({ signupGranted: false, balanceMinor: 0 });

  assert.equal(result.balanceMinor, 5000);
  assert.equal(result.signupGranted, true);
});

test("CREDITS grantSignup: idempotent (already granted = no-op)", async () => {
  const { grantSignup } = await import("../src/lib/credits/account.ts");
  const result = grantSignup({ signupGranted: true, balanceMinor: 30 });

  assert.equal(result.balanceMinor, 30);
  assert.equal(result.signupGranted, true);
});

test("CREDITS service: spend reads user, guards, writes balance + transaction atomically", async () => {
  const source = await read("src/lib/credits/service.ts");

  assert.match(source, /export async function spendCredits/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /deduct\(/);
  assert.match(source, /ok:\s*false/);
  assert.match(source, /reason:\s*"spend"/);
  assert.match(source, /balanceAfterMinor/);
  assert.match(source, /export async function getBalanceMinor/);
  assert.match(source, /export async function ensureSignupGrant/);
});

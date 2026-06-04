# 积分引擎核心 Implementation Plan(Phase 1 / 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立积分(配额)系统的数据层与账户核心逻辑——三类账户(免费一次性/订阅每月覆盖/终身每月累加)、整数分配额存储、扣费与余额、月度刷新、注册赠送、流水审计。

**Architecture:** Prisma 给 `User` 加积分字段 + 新 `CreditTransaction` 流水表;等级与各动作单价做成**代码配置**(可后期标定,不进 DB);纯函数账户逻辑放 `src/lib/credits/`,便于 node:test 单测。**本计划只做引擎核心**,不接消费点、不接前端、不接支付(各为后续 plan/spec)。

**Tech Stack:** Next.js App Router + TypeScript + Prisma(PostgreSQL)+ next-auth;测试 `node --test tests/*.test.mjs`(纯函数单测 + schema/源码契约正则)。

**依据 spec:** `docs/superpowers/specs/2026-06-01-credits-billing-design.md`;模型摘要见 memory `credits-billing-model`。

---

## 关键约定(贯穿全计划)
- **分配额(minor units)**:配额一律以**整数 ×100 存储**(0.5 配额 = 50;0.1 = 10)。DB/逻辑只用整数,展示层再 /100。命名 `Minor` 后缀。
- **三类账户来源**(`creditSource`):`free`(注册一次性赠送,不补充)/ `subscription`(月度**覆盖**重置为等级额度,不结转)/ `lifetime`(月度**累加**,永久结转)。
- **等级**(`plan`):`free | premium_m | premium_y | ultra_m | ultra_y | lifetime_premium | lifetime_ultra`。
- **待标定数值**:各动作单价、等级月额度的最终值由后续按真实 API 成本标定;本计划用 spec 草案值,**集中放配置文件**,带 `// TODO 标定` 注释,改一处即可。

## File Structure(本计划创建/修改)
- `prisma/schema.prisma` — 修改:`User` 加积分字段;新增 `CreditTransaction` 模型 + `Plan`/`CreditSource`/`CreditReason` enum。
- `prisma/migrations/<ts>_credits_engine/migration.sql` — 新增:迁移。
- `src/lib/credits/config.ts` — 新增:等级额度 + 各动作单价(分配额)+ 注册赠送额,集中配置。
- `src/lib/credits/account.ts` — 新增:纯逻辑 `computeBalanceMinor` / `applyMonthlyRefill` / `deduct` / `grantSignup`(纯函数,入参出参皆数据,不直接碰 DB,便于单测)。
- `src/lib/credits/service.ts` — 新增:DB 编排(读 User → 调 account.ts → 写 User + CreditTransaction),供后续路由调用。
- `tests/credits-engine.test.mjs` — 新增:account.ts 纯函数单测 + schema/config 契约测试。

---

## Task 1: Prisma schema — User 积分字段 + CreditTransaction + enums

**Files:**
- Modify: `prisma/schema.prisma`(User 模型 line 10-26;在 enum 区与 model 区追加)
- Test: `tests/credits-engine.test.mjs`

- [ ] **Step 1: 写失败的 schema 契约测试**

```js
// tests/credits-engine.test.mjs
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFile(p, "utf8");

test("CREDITS schema: User has credit fields, plan enum, CreditTransaction, sources/reasons", async () => {
  const schema = await read("prisma/schema.prisma");
  // User 积分字段
  assert.match(schema, /plan\s+Plan\s+@default\(free\)/);
  assert.match(schema, /creditSource\s+CreditSource\s+@default\(free\)/);
  assert.match(schema, /creditBalanceMinor\s+Int\s+@default\(0\)/);
  assert.match(schema, /planExpiresAt\s+DateTime\?/);
  assert.match(schema, /lastRefillAt\s+DateTime\?/);
  assert.match(schema, /signupGranted\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /creditTransactions\s+CreditTransaction\[\]/);
  // enums
  assert.match(schema, /enum Plan \{[\s\S]*free[\s\S]*premium_m[\s\S]*premium_y[\s\S]*ultra_m[\s\S]*ultra_y[\s\S]*lifetime_premium[\s\S]*lifetime_ultra[\s\S]*\}/);
  assert.match(schema, /enum CreditSource \{[\s\S]*free[\s\S]*subscription[\s\S]*lifetime[\s\S]*\}/);
  assert.match(schema, /enum CreditReason \{[\s\S]*grant[\s\S]*refill[\s\S]*spend[\s\S]*\}/);
  // CreditTransaction model
  assert.match(schema, /model CreditTransaction \{[\s\S]*userId\s+String[\s\S]*deltaMinor\s+Int[\s\S]*reason\s+CreditReason[\s\S]*refType\s+String\?[\s\S]*refId\s+String\?[\s\S]*balanceAfterMinor\s+Int[\s\S]*createdAt\s+DateTime[\s\S]*\}/);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/credits-engine.test.mjs`
Expected: FAIL（schema 尚无这些字段）

- [ ] **Step 3: 改 schema**

User 模型(line 10-26)内追加字段:
```prisma
  plan               Plan                @default(free)
  creditSource       CreditSource        @default(free)
  creditBalanceMinor Int                 @default(0)
  planExpiresAt      DateTime?
  lastRefillAt       DateTime?
  signupGranted      Boolean             @default(false)
  creditTransactions CreditTransaction[]
```
在 enum 区追加:
```prisma
enum Plan {
  free
  premium_m
  premium_y
  ultra_m
  ultra_y
  lifetime_premium
  lifetime_ultra
}

enum CreditSource {
  free
  subscription
  lifetime
}

enum CreditReason {
  grant
  refill
  spend
}
```
在 model 区追加:
```prisma
model CreditTransaction {
  id               String       @id @default(cuid())
  userId           String
  deltaMinor       Int
  reason           CreditReason
  refType          String?
  refId            String?
  balanceAfterMinor Int
  createdAt        DateTime     @default(now())
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/credits-engine.test.mjs`
Expected: PASS

- [ ] **Step 5: 生成迁移**

Run: `npx prisma migrate dev --name credits_engine`
Expected: 迁移文件生成,prisma client 重新生成,无报错。

- [ ] **Step 6: 提交**

```bash
git add prisma/schema.prisma prisma/migrations tests/credits-engine.test.mjs
git commit -m "feat(credits): add credit fields, plan/source/reason enums, CreditTransaction model"
```

---

## Task 2: 配置层 — 等级额度 + 动作单价(集中、可标定)

**Files:**
- Create: `src/lib/credits/config.ts`
- Test: `tests/credits-engine.test.mjs`（追加）

- [ ] **Step 1: 写失败测试**

```js
// 追加到 tests/credits-engine.test.mjs
import { PLAN_CONFIG, ACTION_COST_MINOR, SIGNUP_GRANT_MINOR, toMinor, toDisplay }
  from "../src/lib/credits/config.ts";
// 注:node --test 跑 .ts 需 tsx/loader;若项目无,改为对 config.ts 做源码契约正则(见下方备选)。

test("CREDITS config: plan monthly amounts and action costs in minor units", () => {
  assert.equal(toMinor(0.5), 50);
  assert.equal(toMinor(1), 100);
  assert.equal(toDisplay(50), 0.5);
  // 免费一次性 50 配额 = 5000 minor
  assert.equal(SIGNUP_GRANT_MINOR, 5000);
  // 月度额度(minor):进阶 500、高阶 1000、终身进阶 500、终身高阶 1000
  assert.equal(PLAN_CONFIG.premium_m.monthlyMinor, 50000);
  assert.equal(PLAN_CONFIG.ultra_m.monthlyMinor, 100000);
  assert.equal(PLAN_CONFIG.lifetime_premium.monthlyMinor, 50000);
  assert.equal(PLAN_CONFIG.lifetime_ultra.monthlyMinor, 100000);
  // 账户来源映射
  assert.equal(PLAN_CONFIG.free.source, "free");
  assert.equal(PLAN_CONFIG.premium_m.source, "subscription");
  assert.equal(PLAN_CONFIG.lifetime_ultra.source, "lifetime");
  // 动作单价(minor,草案待标定)
  assert.equal(ACTION_COST_MINOR.talk_turn, 50);   // 0.5
  assert.equal(ACTION_COST_MINOR.tts, 10);          // 0.1
  assert.equal(ACTION_COST_MINOR.lookup_fallback, 10); // 0.1
  assert.equal(ACTION_COST_MINOR.phrase_extract_per_sentence, 5); // 0.05
});
```
> 备选(若 .ts 无法在 node:test 直接 import):把本测试改为读 `src/lib/credits/config.ts` 文本做正则断言上述常量值。

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/credits-engine.test.mjs`
Expected: FAIL（config 不存在）

- [ ] **Step 3: 写 config.ts**

```ts
// src/lib/credits/config.ts
// 配额以整数分(minor)存储:1 配额 = 100 minor。
export const MINOR = 100;
export const toMinor = (credits: number) => Math.round(credits * MINOR);
export const toDisplay = (minor: number) => minor / MINOR;

export type Plan =
  | "free" | "premium_m" | "premium_y" | "ultra_m" | "ultra_y"
  | "lifetime_premium" | "lifetime_ultra";
export type CreditSource = "free" | "subscription" | "lifetime";

// 注册一次性赠送 50 配额
export const SIGNUP_GRANT_MINOR = toMinor(50);

// 等级配置:每月额度(minor)+ 账户来源
export const PLAN_CONFIG: Record<Plan, { monthlyMinor: number; source: CreditSource }> = {
  free:             { monthlyMinor: 0,             source: "free" },       // 一次性,不补
  premium_m:        { monthlyMinor: toMinor(500),  source: "subscription" },
  premium_y:        { monthlyMinor: toMinor(500),  source: "subscription" },
  ultra_m:          { monthlyMinor: toMinor(1000), source: "subscription" },
  ultra_y:          { monthlyMinor: toMinor(1000), source: "subscription" },
  lifetime_premium: { monthlyMinor: toMinor(500),  source: "lifetime" },
  lifetime_ultra:   { monthlyMinor: toMinor(1000), source: "lifetime" }
};

// 各动作单价(minor)。TODO 标定:按真实 Supadata/DashScope/TTS 单价×目标毛利复核。
export const ACTION_COST_MINOR = {
  talk_turn: toMinor(0.5),
  tts: toMinor(0.1),
  lookup_fallback: toMinor(0.1),
  phrase_extract_per_sentence: toMinor(0.05),
  // 全新视频字幕解锁(仅网站内缓存未命中):一口价按时长档(TODO 标定)
  video_unlock_short: toMinor(2),   // <=10min
  video_unlock_mid: toMinor(5),     // 10-30min
  video_unlock_long: toMinor(10)    // >30min
} as const;
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/credits-engine.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/credits/config.ts tests/credits-engine.test.mjs
git commit -m "feat(credits): plan/action cost config in minor units (calibratable)"
```

---

## Task 3: 账户纯逻辑 — 扣费 / 月度刷新 / 注册赠送

**Files:**
- Create: `src/lib/credits/account.ts`
- Test: `tests/credits-engine.test.mjs`（追加）

- [ ] **Step 1: 写失败测试**(覆盖三类刷新 + 扣费护栏 + 注册赠送)

```js
// 追加
import { deduct, applyMonthlyRefill, grantSignup } from "../src/lib/credits/account.ts";

test("CREDITS deduct: success reduces balance, returns ok", () => {
  const r = deduct({ balanceMinor: 100 }, 30);
  assert.equal(r.ok, true);
  assert.equal(r.balanceMinor, 70);
});
test("CREDITS deduct: insufficient leaves balance unchanged, ok=false (never negative)", () => {
  const r = deduct({ balanceMinor: 20 }, 30);
  assert.equal(r.ok, false);
  assert.equal(r.balanceMinor, 20);
});
test("CREDITS refill: free source never refills (one-time)", () => {
  const u = { plan: "free", source: "free", balanceMinor: 10 };
  assert.equal(applyMonthlyRefill(u).balanceMinor, 10);
});
test("CREDITS refill: subscription OVERWRITES to monthly amount (no rollover)", () => {
  const u = { plan: "premium_m", source: "subscription", balanceMinor: 12345 };
  assert.equal(applyMonthlyRefill(u).balanceMinor, 50000);
});
test("CREDITS refill: lifetime ACCUMULATES monthly amount (rollover)", () => {
  const u = { plan: "lifetime_premium", source: "lifetime", balanceMinor: 12345 };
  assert.equal(applyMonthlyRefill(u).balanceMinor, 12345 + 50000);
});
test("CREDITS grantSignup: sets balance to signup grant, marks granted", () => {
  const r = grantSignup({ signupGranted: false, balanceMinor: 0 });
  assert.equal(r.balanceMinor, 5000);
  assert.equal(r.signupGranted, true);
});
test("CREDITS grantSignup: idempotent (already granted = no-op)", () => {
  const r = grantSignup({ signupGranted: true, balanceMinor: 30 });
  assert.equal(r.balanceMinor, 30);
  assert.equal(r.signupGranted, true);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/credits-engine.test.mjs`
Expected: FAIL

- [ ] **Step 3: 写 account.ts**

```ts
// src/lib/credits/account.ts
import { PLAN_CONFIG, SIGNUP_GRANT_MINOR, type Plan, type CreditSource } from "./config";

export function deduct(acct: { balanceMinor: number }, costMinor: number) {
  if (costMinor <= 0) return { ok: true, balanceMinor: acct.balanceMinor };
  if (acct.balanceMinor < costMinor) return { ok: false, balanceMinor: acct.balanceMinor };
  return { ok: true, balanceMinor: acct.balanceMinor - costMinor };
}

export function applyMonthlyRefill(acct: { plan: Plan; source: CreditSource; balanceMinor: number }) {
  const cfg = PLAN_CONFIG[acct.plan];
  if (cfg.source === "free") return { ...acct, balanceMinor: acct.balanceMinor }; // 不补
  if (cfg.source === "subscription") return { ...acct, balanceMinor: cfg.monthlyMinor }; // 覆盖
  return { ...acct, balanceMinor: acct.balanceMinor + cfg.monthlyMinor }; // 终身累加
}

export function grantSignup(acct: { signupGranted: boolean; balanceMinor: number }) {
  if (acct.signupGranted) return acct;
  return { ...acct, signupGranted: true, balanceMinor: SIGNUP_GRANT_MINOR };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/credits-engine.test.mjs`
Expected: PASS（全部）

- [ ] **Step 5: 提交**

```bash
git add src/lib/credits/account.ts tests/credits-engine.test.mjs
git commit -m "feat(credits): pure account logic — deduct/refill(3 sources)/signup grant"
```

---

## Task 4: 服务编排 — DB 读写 + 流水

**Files:**
- Create: `src/lib/credits/service.ts`
- Test: `tests/credits-engine.test.mjs`（追加源码契约,因需 DB 不做集成单测）

- [ ] **Step 1: 写契约测试(源码正则,验证编排形态)**

```js
test("CREDITS service: spend reads user, guards, writes balance + transaction atomically", async () => {
  const src = await read("src/lib/credits/service.ts");
  assert.match(src, /export async function spendCredits/);
  // 用事务保证扣费与流水原子
  assert.match(src, /prisma\.\$transaction/);
  // 调纯逻辑 deduct
  assert.match(src, /deduct\(/);
  // 余额不足返回 ok:false,不写负数
  assert.match(src, /ok:\s*false/);
  // 写流水 CreditReason spend + balanceAfterMinor
  assert.match(src, /reason:\s*"spend"/);
  assert.match(src, /balanceAfterMinor/);
  assert.match(src, /export async function getBalanceMinor/);
  assert.match(src, /export async function ensureSignupGrant/);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/credits-engine.test.mjs`
Expected: FAIL

- [ ] **Step 3: 写 service.ts**

```ts
// src/lib/credits/service.ts
import { prisma } from "@/lib/prisma";
import { deduct, grantSignup } from "./account";
import { SIGNUP_GRANT_MINOR } from "./config";

export async function getBalanceMinor(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { creditBalanceMinor: true } });
  return u?.creditBalanceMinor ?? 0;
}

export async function ensureSignupGrant(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { signupGranted: true, creditBalanceMinor: true } });
    if (!u || u.signupGranted) return;
    const next = grantSignup({ signupGranted: u.signupGranted, balanceMinor: u.creditBalanceMinor });
    await tx.user.update({ where: { id: userId }, data: { signupGranted: true, creditBalanceMinor: next.balanceMinor } });
    await tx.creditTransaction.create({ data: { userId, deltaMinor: SIGNUP_GRANT_MINOR, reason: "grant", balanceAfterMinor: next.balanceMinor } });
  });
}

export async function spendCredits(
  userId: string, costMinor: number, refType: string, refId?: string
): Promise<{ ok: boolean; balanceMinor: number }> {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { creditBalanceMinor: true } });
    const r = deduct({ balanceMinor: u?.creditBalanceMinor ?? 0 }, costMinor);
    if (!r.ok) return { ok: false, balanceMinor: r.balanceMinor };
    await tx.user.update({ where: { id: userId }, data: { creditBalanceMinor: r.balanceMinor } });
    await tx.creditTransaction.create({ data: { userId, deltaMinor: -costMinor, reason: "spend", refType, refId, balanceAfterMinor: r.balanceMinor } });
    return { ok: true, balanceMinor: r.balanceMinor };
  });
}
```

- [ ] **Step 4: 运行确认通过 + 类型检查 + 全量**

Run: `node --test tests/credits-engine.test.mjs` → PASS
Run: `npx tsc --noEmit --pretty false` → PASS
Run: `npm test` → 全绿
Run: `npm run lint:encoding` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/credits/service.ts tests/credits-engine.test.mjs
git commit -m "feat(credits): service orchestration — spend(atomic+ledger)/getBalance/ensureSignupGrant"
```

---

## Self-Review(写完核对 spec)
- [x] 三类账户来源 + 刷新规则(免费不补/订阅覆盖/终身累加)→ Task 3。
- [x] 整数分配额存储 ×100 → 全程 Minor。
- [x] 注册赠送 50 + 幂等 → Task 3/4。
- [x] 扣费护栏(不写负数、余额不足 ok:false)→ Task 3/4。
- [x] 流水审计 → Task 1/4。
- [x] 等级 + 单价集中配置、待标定 → Task 2。
- [ ] 月度刷新的**触发**(定时 job)→ 逻辑 `applyMonthlyRefill` 已就绪,**触发器(cron/登录时惰性刷新)放 Phase 2**(需结合 planExpiresAt + lastRefillAt 判断当月是否已刷)。
- [ ] 注:本计划是**引擎核心**;不含消费点接入、功能门槛、前端、支付。

---

## 后续 Plan(待本计划完成后分别写)
- **Phase 2 — 消费接入 + 门槛 + 刷新触发**:在 talk/message、tts、vocab/lookup(回落)、短语提取、视频字幕(入口×缓存判定)处接 `spendCredits`;`ensureSignupGrant` 接登录;月度刷新触发(惰性:读到用户时若 lastRefillAt 跨月则 applyMonthlyRefill + 记 refill 流水);功能门槛(短语高亮=进阶+/无限收藏=进阶+/语感网络·Anki·优先=高阶终身)按 plan 放行。
- **Phase 3 — 前端**:顶栏/账户页配额余额展示、积分不足内联提示(不弹窗)、订阅/会员页(展示等级+额度,购买按钮占位待支付)。
- **独立 spec — 支付集成**:微信/支付宝、订阅扣款、升级(只升不降)、停订到期掉回免费层。

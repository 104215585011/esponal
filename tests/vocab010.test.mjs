// Timestamp: 2026-11-15 01:30
//
// VOCAB-010:复习队列支持 ?limit=(App 端自动续批的前提)。
//
// 服务端测试是"读源码 + 正则"的静态契约测试(见 tests/README 或既有用例风格),
// 不起真数据库 —— 真正的行为由 e2e 覆盖。

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const readText = (p) => readFileSync(p, "utf8");

test("VOCAB-010 review GET parses ?limit= and clamps the batch size", async () => {
  const routePath = "src/app/api/vocab/review/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);
  const route = readText(routePath);

  // limit 从 query 读,默认 20,显式 clamp
  assert.match(route, /searchParams\.get\("limit"\)/);
  assert.match(route, /getDueReviewWords\(userId, now, limit\)/);
  // 截断跟随请求的 limit,不再写死 20
  assert.match(route, /slice\(0, limit\)/);
  // 旧契约仍在:默认批大小 20
  assert.match(route, /take:\s*20/);
});

test("VOCAB-010 getDueReviewWords clamps limit to 1..50 and sizes new-word slots", async () => {
  const libPath = "src/lib/vocab.ts";
  const lib = readText(libPath);

  assert.match(lib, /limit = 20/);
  assert.match(lib, /Math\.min\(50, Math\.floor\(limit\)\)/);
  assert.match(lib, /Math\.min\(10, batchSize - dueWords\.length\)/);
  assert.match(lib, /take: batchSize/);
});

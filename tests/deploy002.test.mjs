// Timestamp: 2026-11-15 01:55
//
// DEPLOY-002:app-version 探测不能依赖 GitHub releases 的列表顺序。
//
// 背景:GitHub /releases 按 tag 字典序排,"1.0.10" 会排在 "1.0.9" 后面,
// 「取第一条」从发布两位数版本号起就永远返回旧版(实测复现)。
// 服务端测试沿用本仓库的静态契约风格(读源码 + 正则),不起真请求。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync("src/app/api/mobile/app-version/route.ts", "utf8");

test("DEPLOY-002 app-version picks the highest version numerically, not list order", () => {
  // 探测逻辑必须是"排序取最大",不是 find 第一条
  assert.match(route, /compareVersionDesc/);
  assert.match(route, /\.sort\(\(a, b\) => compareVersionDesc/);
  assert.doesNotMatch(route, /releases\.find/);
});

test("DEPLOY-002 compareVersionDesc handles two-digit patch versions", () => {
  // 从源码里把函数抠出来直接执行,验证 1.0.10 > 1.0.9 > 1.0.2
  const match = /function compareVersionDesc\([^)]*\) \{[\s\S]*?\n\}/.exec(route);
  assert.ok(match, "compareVersionDesc should exist");
  // 源码是 TS,先剥掉参数类型标注再求值
  const js = match[0].replace(/: string/g, "");
  const fn = new Function(`return (${js})`)();
  const versions = ["1.0.9", "1.0.10", "1.0.2", "0.3.0"].sort(fn);
  assert.deepEqual(versions, ["1.0.10", "1.0.9", "1.0.2", "0.3.0"]);
});

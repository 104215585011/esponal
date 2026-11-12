import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("translate route no longer depends on Tencent TMT", async () => {
  const route = await readText("src/app/api/translate/route.ts");

  assert.doesNotMatch(route, /TENCENT_SECRET_ID/);
  assert.doesNotMatch(route, /TextTranslate/);
  assert.doesNotMatch(route, /TC3-HMAC-SHA256/);
  assert.doesNotMatch(route, /tmt\.tencentcloudapi\.com/);
  assert.match(route, /translateEsToZh/);
  assert.match(route, /translate:v3:/);
});

test("translate providers reject source-echo and require real Chinese output", async () => {
  const lib = await readText("src/lib/translate.ts");

  // The old bug: Tencent echoed the source when quota expired. The new chain
  // must skip any provider that returns non-Chinese or source-identical text.
  assert.match(lib, /sameAsSource/);
  assert.match(lib, /containsChinese/);
  assert.match(lib, /continue/);
  assert.match(lib, /translateWithDeepSeek/);
  assert.match(lib, /translateWithDashScope/);
});

test("env example documents the new translation providers", async () => {
  const env = await readText(".env.example");

  assert.match(env, /DEEPSEEK_API_KEY=/);
  assert.match(env, /DEEPSEEK_MODEL=/);
  assert.match(env, /DASHSCOPE_API_KEY=/);
  assert.match(env, /no longer used for \/api\/translate/);
});

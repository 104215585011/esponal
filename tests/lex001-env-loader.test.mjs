// Timestamp: 2026-05-28 19:48
import assert from "node:assert/strict";
import test from "node:test";

test("LEX-001 env loader parses simple dotenv values without overriding existing env", async () => {
  const { applyEnv, parseEnvText } = await import("../scripts/lexicon/env-loader.mjs");

  const parsed = parseEnvText([
    "DEEPSEEK_API_KEY=abc123",
    "DEEPSEEK_MODEL=\"deepseek-chat\"",
    "# ignored",
    "EMPTY="
  ].join("\n"));

  assert.deepEqual(parsed, {
    DEEPSEEK_API_KEY: "abc123",
    DEEPSEEK_MODEL: "deepseek-chat",
    EMPTY: ""
  });

  const env = { DEEPSEEK_API_KEY: "already-set" };
  applyEnv(parsed, env);
  assert.equal(env.DEEPSEEK_API_KEY, "already-set");
  assert.equal(env.DEEPSEEK_MODEL, "deepseek-chat");
  assert.equal(env.EMPTY, "");
});


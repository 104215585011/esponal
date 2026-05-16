import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("OPS-001 declares Sentry dependency, config files, and environment variables", () => {
  const pkg = JSON.parse(read("package.json"));
  const envExample = read(".env.example");

  assert.ok(pkg.dependencies["@sentry/nextjs"]);

  for (const path of [
    "sentry.client.config.ts",
    "sentry.server.config.ts",
    "sentry.edge.config.ts"
  ]) {
    assert.equal(fs.existsSync(path), true, `${path} missing`);
    assert.match(read(path), /@sentry\/nextjs/);
    assert.match(read(path), /Sentry\.init/);
  }

  for (const name of [
    "SENTRY_DSN",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "NEXT_PUBLIC_SENTRY_DSN"
  ]) {
    assert.match(envExample, new RegExp(`^${name}=`, "m"), `${name} missing`);
  }
});

test("OPS-001 wraps Next config with withSentryConfig", () => {
  const source = read("next.config.mjs");

  assert.match(source, /withSentryConfig/);
  assert.match(source, /@sentry\/nextjs/);
  assert.match(source, /export default withSentryConfig/);
});

test("OPS-001 monitor helper reports sanitized custom failures", () => {
  const source = read("src/lib/monitor.ts");

  for (const fn of [
    "reportTranslateFailure",
    "reportLookupFailure",
    "reportSubtitleFailure"
  ]) {
    assert.match(source, new RegExp(`export function ${fn}`));
  }

  assert.match(source, /Sentry\.captureException/);
  assert.match(source, /feature: "translate"/);
  assert.match(source, /feature: "lookup"/);
  assert.match(source, /feature: "subtitle"/);
  assert.match(source, /textLength/);
  assert.match(source, /textPreview: text\.slice\(0, 40\)/);
  assert.doesNotMatch(source, /extra:\s*\{\s*text\s*[,}]/);
});

test("OPS-001 routes and dictionary report monitored failures", () => {
  const expectations = [
    ["src/app/api/translate/route.ts", "reportTranslateFailure"],
    ["src/app/api/vocab/lookup/route.ts", "reportLookupFailure"],
    ["src/app/api/subtitle/route.ts", "reportSubtitleFailure"],
    ["src/lib/dictionary.ts", "reportLookupFailure"]
  ];

  for (const [path, helper] of expectations) {
    const source = read(path);

    assert.match(source, new RegExp(`@/lib/monitor`), `${path} missing monitor import`);
    assert.match(source, new RegExp(`${helper}\\(`), `${path} missing ${helper} call`);
  }
});

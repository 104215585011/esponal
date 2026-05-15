import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "generate-unit-audio.mjs");
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const script = readFileSync(scriptPath, "utf8");
const unitIds = Array.from({ length: 9 }, (_, index) => `unidad-${index + 1}`);

const readUnit = (unitId) =>
  JSON.parse(readFileSync(path.join(repoRoot, "content", "curriculum", `${unitId}.json`), "utf8"));

const collectAudioSrcs = (unit) => [
  ...unit.vocabGroups.flatMap((group) => group.items.map((item) => item.audioSrc)),
  ...unit.phrases.flatMap((section) => section.items.map((item) => item.audioSrc)),
  ...unit.dialogues.flatMap((dialogue) => dialogue.lines.map((line) => line.audioSrc)),
];

test("COURSE-004 installs msedge-tts and exposes the generation entrypoint", () => {
  assert.ok(existsSync(scriptPath), "scripts/generate-unit-audio.mjs should exist");
  assert.equal(packageJson.dependencies["msedge-tts"] !== undefined, true);
  assert.match(script, /MsEdgeTTS/);
  assert.match(script, /--unit=/);
  assert.match(script, /es-ES-AlvaroNeural/);
});

test("COURSE-004 script isolates temp output and retries transient failures", () => {
  assert.match(script, /tempDir/);
  assert.match(script, /\.tmp-/);
  assert.match(script, /tts\.toFile\(entry\.tempDir, entry\.text\)/);
  assert.match(script, /maxAttempts/);
  assert.match(script, /for\s*\(let attempt/);
});

test("COURSE-004 fills all course audioSrc fields with generated mp3 files", () => {
  for (const unitId of unitIds) {
    const unit = readUnit(unitId);
    const audioDir = path.join(repoRoot, "public", "audio", "units", unitId);

    assert.equal(existsSync(audioDir), true, `${unitId} audio dir missing`);

    for (const audioSrc of collectAudioSrcs(unit)) {
      assert.match(audioSrc, new RegExp(`^/audio/units/${unitId}/[a-z0-9-]+\\.mp3$`));

      const audioPath = path.join(repoRoot, "public", audioSrc.slice(1).replaceAll("/", path.sep));
      assert.equal(existsSync(audioPath), true, `${audioPath} missing`);
      assert.ok(statSync(audioPath).size > 1024, `${audioPath} too small`);
    }
  }
});

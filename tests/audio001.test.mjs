import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

const LECTURA_SLUGS = [
  "la-tortuga-y-la-liebre",
  "el-leon-y-el-raton",
  "el-flautista-de-hamelin",
  "un-dia-en-madrid",
  "el-cafe-de-las-mananas"
];

test("AUDIO-001 exposes a lectura audio generation script", async () => {
  const scriptPath = "scripts/generate-lectura-audio.mjs";
  assert.equal(existsSync(scriptPath), true, `${scriptPath} missing`);

  const script = await readText(scriptPath);
  const pkg = JSON.parse(await readText("package.json"));

  assert.match(script, /msedge-tts/);
  assert.match(script, /MsEdgeTTS/);
  assert.match(script, /OUTPUT_FORMAT/);
  assert.match(script, /lecturaStories/);
  assert.match(script, /es-MX-DaliaNeural/);
  assert.match(pkg.scripts["audio:lectura"], /generate-lectura-audio\.mjs/);
});

test("AUDIO-001 commits first paragraph audio for each lectura story", async () => {
  for (const slug of LECTURA_SLUGS) {
    const path = `public/audio/lectura/${slug}/p0.mp3`;
    assert.equal(existsSync(path), true, `${path} missing`);
    const info = await stat(path);
    assert.ok(info.size > 1024, `${path} should be larger than 1KB`);
  }
});

test("AUDIO-001 lectura reader plays paragraph mp3 files one at a time", async () => {
  const path = "src/app/lectura/LecturaReader.tsx";
  const src = await readText(path);

  assert.match(src, /new Audio\(/);
  assert.match(src, /\/audio\/lectura\/\$\{story\.slug\}\/p\$\{paragraphIndex\}\.mp3/);
  assert.match(src, /useRef<HTMLAudioElement \| null>/);
  assert.match(src, /currentAudioRef/);
  assert.match(src, /playingParagraphIndex/);
});

test("AUDIO-001 lookup card uses the browser speech helper for lemma and examples", async () => {
  const helperPath = "src/lib/speak.ts";
  assert.equal(existsSync(helperPath), true, `${helperPath} missing`);

  const helper = await readText(helperPath);
  const card = await readText("src/app/watch/LookupCard.tsx");

  assert.match(helper, /export function speak/);
  assert.match(helper, /export function useSpeechAvailable/);
  assert.match(helper, /SpeechSynthesisUtterance/);
  assert.match(helper, /voiceschanged/);
  assert.match(card, /useSpeechAvailable/);
  assert.match(card, /speak\(lemma/);
  assert.match(card, /speak\(example\.es/);
});

test("AUDIO-001 service worker cache-first handles lectura audio", async () => {
  const sw = await readText("src/sw.ts");
  const publicSw = await readText("public/sw.js");

  for (const src of [sw, publicSw]) {
    assert.match(src, /LECTURA_AUDIO_CACHE/);
    assert.match(src, /\/audio\/lectura\//);
    assert.match(src, /\.mp3/);
    assert.match(src, /cache\.match\(request\)/);
  }
});

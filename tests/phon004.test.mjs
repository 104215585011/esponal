// Timestamp: 2026-06-04 10:37
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

async function readText(path) {
  return readFileSync(path, "utf8");
}

test("PHON-004 adds a bottom prosody module under the alphabet grid", async () => {
  const page = await readText("src/app/phonics/page.tsx");
  const component = await readText("src/app/phonics/PhonicsProsody.tsx");

  assert.match(page, /PhonicsProsody/);
  assert.ok(
    page.indexOf("<AlphabetGrid") < page.indexOf("<PhonicsProsody />"),
    "prosody module should render below the alphabet grid"
  );

  assert.match(component, /重音 & 连读/);
  assert.match(component, /md:mt-12/);
  assert.match(component, /md:pt-10/);
  assert.match(component, /border-t border-zinc-100/);
  assert.match(component, /Acentuación/);
  assert.match(component, /Sinalefa/);
});

test("PHON-004 exposes stress rules and sinalefa examples with reviewed highlights", async () => {
  const data = await readText("content/phonics/prosody.ts");
  const component = await readText("src/app/phonics/PhonicsProsody.tsx");

  assert.match(data, /PHONICS_STRESS_RULES/);
  assert.match(data, /PHONICS_SINALEFA_SENTENCES/);
  assert.match(data, /casa/);
  assert.match(data, /comen/);
  assert.match(data, /ciudad/);
  assert.match(data, /trabajar/);
  assert.match(data, /caf[eé]/);
  assert.match(data, /m[uú]sica/);
  assert.match(data, /mi amigo/);
  assert.match(data, /la escuela/);
  assert.match(data, /todo el d[ií]a/);

  assert.match(component, /font-bold text-brand-600|text-brand-600 font-bold/);
  assert.match(component, /border-b-2 border-brand-400/);
  assert.match(component, /\/audio\/phonics\/stress\/\$\{example\.slug\}\.mp3/);
  assert.match(component, /\/audio\/phonics\/sinalefa\/\$\{sentence\.slug\}\.mp3/);
});

test("PHON-004 audio generation covers stress words and sinalefa sentences", async () => {
  const script = await readText("scripts/generate-phonics-audio.mjs");

  assert.match(script, /prosody/i);
  assert.match(script, /stress/);
  assert.match(script, /sinalefa/);

  for (const filePath of [
    "public/audio/phonics/stress/cafe.mp3",
    "public/audio/phonics/stress/trabajar.mp3",
    "public/audio/phonics/sinalefa/mi-amigo.mp3"
  ]) {
    assert.ok(existsSync(filePath), `${filePath} should exist`);
    assert.ok(statSync(filePath).size > 1024, `${filePath} should be a non-trivial mp3`);
  }
});

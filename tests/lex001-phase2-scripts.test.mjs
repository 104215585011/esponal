// Timestamp: 2026-05-28 16:44
import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import test from "node:test";

const exec = promisify(execFile);

async function runNode(args, options = {}) {
  return exec("node", args, {
    cwd: process.cwd(),
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    ...options
  });
}

async function withTatoebaFixture(name, fn) {
  const fixtureDir = `.tmp-lex001/${name}`;
  const fixturePath = `${fixtureDir}/tatoeba-es-zh.jsonl`;

  await mkdir(fixtureDir, { recursive: true });
  await writeFile(
    fixturePath,
    [
      { es: "Yo quiero hablar espanol.", zh: "我想说西班牙语。", esId: 1, zhId: 2 },
      { es: "He hablado con Ana.", zh: "我和 Ana 说过话。", esId: 3, zhId: 4 },
      { es: "Bebo agua.", zh: "我喝水。", esId: 5, zhId: 6 }
    ].map((item) => JSON.stringify(item)).join("\n") + "\n",
    "utf8"
  );

  try {
    await fn(fixturePath);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
}

test("LEX-001 Phase 2 scripts expose --help without running main work", async () => {
  for (const script of [
    "scripts/lexicon/download-tatoeba.mjs",
    "scripts/lexicon/parse-tatoeba.mjs",
    "scripts/lexicon/seed-a1-a2-words.mjs"
  ]) {
    const { stdout, stderr } = await runNode([script, "--help"]);
    assert.match(stdout, /Usage:/);
    assert.equal(stderr, "");
    assert.doesNotMatch(stdout, /Seed candidates=/);
    assert.doesNotMatch(stdout, /Downloading /);
  }
});

test("LEX-001 Phase 2 seed defaults to dry-run and requires --write for DB writes", async () => {
  await withTatoebaFixture("dry-run", async (fixturePath) => {
    const { stdout } = await runNode([
      "scripts/lexicon/seed-a1-a2-words.mjs",
      "--lemmas",
      "hablar,agua",
      "--tatoeba",
      fixturePath,
      "--limit",
      "2",
      "--concurrency",
      "1"
    ]);

    assert.match(stdout, /dryRun=true/);
    assert.match(stdout, /"lemma":"hablar"/);
    assert.match(stdout, /"lemma":"agua"/);
    assert.doesNotMatch(stdout, /Wrote LexiconEntry/);
  });
});

test("LEX-001 Phase 2 seed rejects missing Tatoeba examples before producing entries", async () => {
  const fixturePath = ".tmp-lex001/missing/tatoeba-es-zh.jsonl";
  await rm(".tmp-lex001/missing", { recursive: true, force: true });

  await assert.rejects(
    runNode([
      "scripts/lexicon/seed-a1-a2-words.mjs",
      "--lemmas",
      "hablar",
      "--tatoeba",
      fixturePath,
      "--limit",
      "1"
    ]),
    /Please run parse-tatoeba\.mjs first/
  );
});

test("LEX-001 Phase 2 seed produces isolated verb and noun forms", async () => {
  await withTatoebaFixture("isolated-forms", async (fixturePath) => {
    const { stdout } = await runNode([
      "scripts/lexicon/seed-a1-a2-words.mjs",
      "--lemmas",
      "hablar,agua",
      "--tatoeba",
      fixturePath,
      "--limit",
      "2",
      "--concurrency",
      "1"
    ]);

    const entries = stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));
    const hablar = entries.find((entry) => entry.lemma === "hablar");
    const agua = entries.find((entry) => entry.lemma === "agua");

    assert.ok(hablar);
    assert.ok(agua);
    assert.equal(hablar.partOfSpeech, "verb");
    assert.ok(hablar.morphology);
    assert.ok(hablar.forms.length >= 50, `expected many verb forms, saw ${hablar.forms.length}`);
    assert.ok(hablar.forms.includes("he hablado"));
    assert.ok(hablar.forms.includes("hablando"));
    assert.equal(agua.partOfSpeech, "noun_f");
    assert.deepEqual(agua.forms, ["agua", "aguas"]);
    assert.ok(hablar.examples.length > 0);
    assert.ok(agua.examples.length > 0);
    assert.ok(!agua.forms.some((form) => hablar.forms.includes(form) && form !== "agua"));
    assert.ok(!hablar.forms.includes("aguas"));
  });
});

test("LEX-001 Phase 2 download script uses current Tatoeba archive URLs", async () => {
  const { readFile } = await import("node:fs/promises");
  const download = await readFile("scripts/lexicon/download-tatoeba.mjs", "utf8");

  assert.match(download, /per_language\/spa\/spa_sentences\.tsv\.bz2/);
  assert.match(download, /per_language\/cmn\/cmn_sentences\.tsv\.bz2/);
  assert.match(download, /links\.tar\.bz2/);
  assert.doesNotMatch(download, /exports\/sentences\.csv\.bz2/);
  assert.doesNotMatch(download, /exports\/links\.csv\.bz2/);
});

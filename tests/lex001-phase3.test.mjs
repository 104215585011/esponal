// Timestamp: 2026-05-28 19:28
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
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

test("LEX-001 Phase 3 scripts expose --help without work", async () => {
  for (const script of [
    "scripts/lexicon/generate-phrase-candidates.mjs",
    "scripts/lexicon/seed-a1-a2-phrases.mjs"
  ]) {
    const { stdout, stderr } = await runNode([script, "--help"]);
    assert.match(stdout, /Usage:/);
    assert.equal(stderr, "");
    assert.doesNotMatch(stdout, /Phrase candidates=|Phrase seed candidates=/);
  }
});

test("LEX-001 Phase 3 generator writes reviewed CSV shape from mocked candidates", async () => {
  const dir = ".tmp-lex001-phase3/generate";
  const output = `${dir}/candidates.csv`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const mock = {
    collocation: [
      { lemma: "tener que", level: "A1", category: "verb_periphrasis", translation_zh: "必须", keep: "1" }
    ],
    phrase: [
      { lemma: "por favor", level: "A1", category: "courtesy", translation_zh: "请", keep: "1" }
    ],
    idiom: [
      { lemma: "valer la pena", level: "A2", category: "useful_idiom", translation_zh: "值得", keep: "1" }
    ]
  };

  const { stdout } = await runNode([
    "scripts/lexicon/generate-phrase-candidates.mjs",
    "--write",
    "--output",
    output,
    "--limit",
    "3"
  ], {
    env: {
      ...process.env,
      LEXICON_PHRASE_MOCK_RESPONSES: JSON.stringify(mock)
    }
  });

  assert.match(stdout, /Phrase candidates=3 written=3/);
  const csv = await readFile(output, "utf8");
  assert.match(csv, /^lemma,kind,level,category,translation_zh,keep\r?\n/);
  assert.match(csv, /tener que,collocation,A1,verb_periphrasis,必须,1/);
  assert.match(csv, /por favor,phrase,A1,courtesy,请,1/);
  assert.match(csv, /valer la pena,idiom,A2,useful_idiom,值得,1/);
});

test("LEX-001 Phase 3 seed parses CSV, skips keep=0, and maps phrase partOfSpeech", async () => {
  const dir = ".tmp-lex001-phase3/seed";
  const csv = `${dir}/seed.csv`;
  const tatoeba = `${dir}/tatoeba-es-zh.jsonl`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(
    csv,
    [
      "lemma,kind,level,category,translation_zh,keep",
      "tener que,collocation,A1,verb_periphrasis,必须,1",
      "por favor,phrase,A1,courtesy,请,0",
      "valer la pena,idiom,A2,useful_idiom,值得,1"
    ].join("\n") + "\n",
    "utf8"
  );
  await writeFile(
    tatoeba,
    [
      { es: "Tener que estudiar es normal.", zh: "必须学习很正常。", esId: 1, zhId: 2 },
      { es: "Tener que descansar es importante.", zh: "必须休息很重要。", esId: 3, zhId: 4 }
    ].map((item) => JSON.stringify(item)).join("\n") + "\n",
    "utf8"
  );

  const mockDescriptions = {
    "tener que": { explanationZh: "tener que + 不定式表示必须做某事。", translationEn: "to have to" },
    "valer la pena": { explanationZh: "表示某事值得做。", translationEn: "to be worth it" }
  };
  const mockExamples = {
    "valer la pena": [
      { es: "Vale la pena aprender español.", zh: "学习西班牙语是值得的。" },
      { es: "Este libro vale la pena.", zh: "这本书值得读。" }
    ]
  };

  const { stdout } = await runNode([
    "scripts/lexicon/seed-a1-a2-phrases.mjs",
    "--csv",
    csv,
    "--tatoeba",
    tatoeba,
    "--limit",
    "3",
    "--concurrency",
    "1"
  ], {
    env: {
      ...process.env,
      LEXICON_PHRASE_MOCK_DESCRIPTIONS: JSON.stringify(mockDescriptions),
      LEXICON_PHRASE_MOCK_EXAMPLES: JSON.stringify(mockExamples)
    }
  });

  const entries = stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));
  assert.equal(entries.length, 2);
  const tener = entries.find((entry) => entry.lemma === "tener que");
  const valer = entries.find((entry) => entry.lemma === "valer la pena");
  assert.equal(tener.kind, "collocation");
  assert.equal(tener.partOfSpeech, "collocation_verb_periphrasis");
  assert.equal(tener.examples[0].source, "tatoeba");
  assert.equal(valer.kind, "idiom");
  assert.equal(valer.partOfSpeech, "idiom_useful_idiom");
  assert.ok(valer.examples.every((example) => example.source === "llm-generated"));
  assert.ok(!entries.some((entry) => entry.lemma === "por favor"));
  assert.match(stdout, /Seed phrase summary written=0 dryRun=2 skipped=0/);
});

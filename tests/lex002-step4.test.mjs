// Timestamp: 2026-05-29 23:20
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

const VALID_PODER_MORPHOLOGY = {
  presente: { yo: "puedo", tu: "puedes", el: "puede", nosotros: "podemos", vosotros: "podéis", ellos: "pueden" },
  preteritoIndefinido: { yo: "pude", tu: "pudiste", el: "pudo", nosotros: "pudimos", vosotros: "pudisteis", ellos: "pudieron" },
  preteritoImperfecto: { yo: "podía", tu: "podías", el: "podía", nosotros: "podíamos", vosotros: "podíais", ellos: "podían" },
  futuro: { yo: "podré", tu: "podrás", el: "podrá", nosotros: "podremos", vosotros: "podréis", ellos: "podrán" },
  condicional: { yo: "podría", tu: "podrías", el: "podría", nosotros: "podríamos", vosotros: "podríais", ellos: "podrían" },
  presenteSubjuntivo: { yo: "pueda", tu: "puedas", el: "pueda", nosotros: "podamos", vosotros: "podáis", ellos: "puedan" },
  participio: "podido",
  gerundio: "pudiendo"
};

const VALID_SENTARSE_MORPHOLOGY = {
  presente: { yo: "me siento", tu: "te sientas", el: "se sienta", nosotros: "nos sentamos", vosotros: "os sentáis", ellos: "se sientan" },
  preteritoIndefinido: { yo: "me senté", tu: "te sentaste", el: "se sentó", nosotros: "nos sentamos", vosotros: "os sentasteis", ellos: "se sentaron" },
  preteritoImperfecto: { yo: "me sentaba", tu: "te sentabas", el: "se sentaba", nosotros: "nos sentábamos", vosotros: "os sentabais", ellos: "se sentaban" },
  futuro: { yo: "me sentaré", tu: "te sentarás", el: "se sentará", nosotros: "nos sentaremos", vosotros: "os sentaréis", ellos: "se sentarán" },
  condicional: { yo: "me sentaría", tu: "te sentarías", el: "se sentaría", nosotros: "nos sentaríamos", vosotros: "os sentaríais", ellos: "se sentarían" },
  presenteSubjuntivo: { yo: "me siente", tu: "te sientes", el: "se siente", nosotros: "nos sentemos", vosotros: "os sentéis", ellos: "se sienten" },
  participio: "sentado",
  gerundio: "sentándose"
};

test("LEX-002 Step 4 seed script supports help and safe dry-run", async () => {
  const { stdout, stderr } = await runNode(["scripts/lexicon/seed-b1-words.mjs", "--help"]);
  assert.match(stdout, /Usage:/);
  assert.match(stdout, /--write/);
  assert.match(stdout, /--resume/);
  assert.equal(stderr, "");
});

test("LEX-002 Step 4 skips proper nouns and keeps B1-C1 words with real verb forms", async () => {
  const dir = ".tmp-lex002-step4/seed";
  const input = `${dir}/candidates.csv`;
  const skipped = `${dir}/skipped.json`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(
    input,
    [
      "lemma,freq_rank,raw_freq,source_forms,source_count",
      "poder,10,900,poder,1",
      "johnny,11,800,johnny,1",
      "facilísimo,12,700,facilísimo,1"
    ].join("\n") + "\n",
    "utf8"
  );

  const mock = {
    poder: {
      isSpanishWord: true,
      isProperNoun: false,
      canonicalLemma: "poder",
      partOfSpeech: "verb",
      cefr: "B1",
      translationZh: "能够，可以",
      translationEn: "can; to be able to",
      explanationZh: "表示能力或可能性。",
      ipa: "poˈðeɾ",
      examples: [{ es: "No puedo ir hoy.", zh: "我今天不能去。" }],
      morphology: {
        ...VALID_PODER_MORPHOLOGY,
        presente: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"]
      }
    },
    johnny: {
      isSpanishWord: false,
      isProperNoun: true,
      canonicalLemma: "johnny",
      skipReason: "proper noun"
    },
    "facilísimo": {
      isSpanishWord: true,
      isProperNoun: false,
      canonicalLemma: "facilísimo",
      partOfSpeech: "adj",
      cefr: "C2",
      skipReason: "outside target CEFR"
    }
  };

  const { stdout } = await runNode([
    "scripts/lexicon/seed-b1-words.mjs",
    "--input",
    input,
    "--skipped",
    skipped,
    "--limit",
    "3"
  ], {
    env: { ...process.env, LEXICON_B1_MOCK_RESPONSES: JSON.stringify(mock) }
  });

  assert.match(stdout, /B1 seed candidates=3 selected=3 dryRun=true/);
  assert.match(stdout, /"lemma":"poder"/);
  assert.match(stdout, /"forms":\[/);
  assert.match(stdout, /puedo/);
  assert.match(stdout, /podré/);
  assert.match(stdout, /pudiendo/);
  assert.match(stdout, /Seed B1 summary written=0 dryRun=1 skipped=2/);

  const report = JSON.parse(await readFile(skipped, "utf8"));
  assert.equal(report.skipped.length, 2);
  assert.equal(report.skipped[0].lemma, "johnny");
});

test("LEX-002 Step 4 rejects fake irregular verb morphology", async () => {
  const dir = ".tmp-lex002-step4/fake-verb";
  const input = `${dir}/candidates.csv`;
  const skipped = `${dir}/skipped.json`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(input, "lemma,freq_rank,raw_freq,source_forms,source_count\npoder,10,900,poder,1\n", "utf8");
  const fake = {
    poder: {
      isSpanishWord: true,
      isProperNoun: false,
      canonicalLemma: "poder",
      partOfSpeech: "verb",
      cefr: "B1",
      translationZh: "能够",
      examples: [{ es: "Puedo ayudarte.", zh: "我可以帮你。" }],
      morphology: {
        ...VALID_PODER_MORPHOLOGY,
        presente: { ...VALID_PODER_MORPHOLOGY.presente, yo: "podo" }
      }
    }
  };

  const { stdout } = await runNode([
    "scripts/lexicon/seed-b1-words.mjs",
    "--input",
    input,
    "--skipped",
    skipped
  ], {
    env: { ...process.env, LEXICON_B1_MOCK_RESPONSES: JSON.stringify(fake) }
  });

  assert.match(stdout, /Seed B1 summary written=0 dryRun=0 skipped=1/);
  const report = JSON.parse(await readFile(skipped, "utf8"));
  assert.match(report.skipped[0].reason, /poder missing required forms: puedo/);
});

test("LEX-005 refresh script uses the same real morphology gate", async () => {
  const mockRows = JSON.stringify([
    {
      id: "verb_poder",
      kind: "word",
      lemma: "poder",
      displayForm: "poder",
      forms: ["poder", "podo"],
      partOfSpeech: "verb",
      morphology: { presente: { yo: "podo" } }
    }
  ]);
  const mockResponses = JSON.stringify({
    poder: {
      canonicalLemma: "poder",
      partOfSpeech: "verb",
      cefr: "B1",
      morphology: VALID_PODER_MORPHOLOGY
    }
  });

  const { stdout } = await runNode([
    "scripts/lexicon/refresh-verb-morphology.mjs",
    "--limit",
    "1"
  ], {
    env: {
      ...process.env,
      LEXICON_REFRESH_MOCK_ROWS: mockRows,
      LEXICON_B1_MOCK_RESPONSES: mockResponses
    }
  });

  assert.match(stdout, /Refresh verb candidates=1 selected=1 dryRun=true/);
  assert.match(stdout, /"lemma":"poder"/);
  assert.match(stdout, /"beforeForms":\["poder","podo"\]/);
  assert.match(stdout, /"afterForms":\[/);
  assert.match(stdout, /puedo/);
  assert.match(stdout, /podré/);
  assert.match(stdout, /yo puedo/);
  assert.match(stdout, /Refresh verb summary written=0 dryRun=1 skipped=0/);
});

test("LEX-005 refresh script ignores one-letter dirty verb rows", async () => {
  const mockRows = JSON.stringify([
    {
      id: "verb_e",
      kind: "word",
      lemma: "e",
      displayForm: "e",
      forms: ["e"],
      partOfSpeech: "verb",
      morphology: null
    },
    {
      id: "verb_poder",
      kind: "word",
      lemma: "poder",
      displayForm: "poder",
      forms: ["poder", "podo"],
      partOfSpeech: "verb",
      morphology: { presente: { yo: "podo" } }
    }
  ]);
  const mockResponses = JSON.stringify({
    poder: {
      canonicalLemma: "poder",
      partOfSpeech: "verb",
      cefr: "B1",
      morphology: VALID_PODER_MORPHOLOGY
    }
  });

  const { stdout } = await runNode([
    "scripts/lexicon/refresh-verb-morphology.mjs",
    "--limit",
    "5"
  ], {
    env: {
      ...process.env,
      LEXICON_REFRESH_MOCK_ROWS: mockRows,
      LEXICON_B1_MOCK_RESPONSES: mockResponses
    }
  });

  assert.match(stdout, /Refresh verb candidates=1 selected=1 dryRun=true/);
  assert.doesNotMatch(stdout, /"lemma":"e"/);
  assert.match(stdout, /"lemma":"poder"/);
});

test("LEX-005 refresh script expands reflexive forms for bare-word lookup", async () => {
  const mockRows = JSON.stringify([
    {
      id: "verb_sentarse",
      kind: "word",
      lemma: "sentarse",
      displayForm: "sentarse",
      forms: ["sentarse"],
      partOfSpeech: "verb",
      morphology: null
    }
  ]);
  const mockResponses = JSON.stringify({
    sentarse: {
      canonicalLemma: "sentarse",
      partOfSpeech: "verb",
      cefr: "B1",
      morphology: VALID_SENTARSE_MORPHOLOGY
    }
  });

  const { stdout } = await runNode([
    "scripts/lexicon/refresh-verb-morphology.mjs",
    "--limit",
    "1"
  ], {
    env: {
      ...process.env,
      LEXICON_REFRESH_MOCK_ROWS: mockRows,
      LEXICON_B1_MOCK_RESPONSES: mockResponses
    }
  });

  assert.match(stdout, /"lemma":"sentarse"/);
  assert.match(stdout, /me siento/);
  assert.match(stdout, /"siento"/);
  assert.match(stdout, /sentándose/);
});

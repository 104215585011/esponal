// Timestamp: 2026-05-29 20:25
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function toLetters(value) {
  const alphabet = "abcdefghijklmnopqrtuvwxyz";
  let current = value;
  let output = "";
  while (current > 0) {
    const index = (current - 1) % alphabet.length;
    output = alphabet[index] + output;
    current = Math.floor((current - 1) / alphabet.length);
  }
  return `q${output}`;
}

test("LEX-002 phase 1 scripts expose --help without doing work", async () => {
  for (const script of [
    "scripts/lexicon/download-frequency-words.mjs",
    "scripts/lexicon/build-wordlist-candidates.mjs"
  ]) {
    const { stdout, stderr } = await runNode([script, "--help"]);
    assert.match(stdout, /Usage:/);
    assert.equal(stderr, "");
    assert.doesNotMatch(stdout, /written=|Downloaded /);
  }
});

test("LEX-002 download script defaults to dry-run and writes nothing", async () => {
  const dir = ".tmp-lex002/download-dry-run";
  const source = `${dir}/source.txt`;
  const output = `${dir}/freq-es.txt`;
  const license = `${dir}/freq-es.LICENSE`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(source, "1\tpoder\t1200\n2\tquerer\t1180\n", "utf8");

  const { stdout } = await runNode([
    "scripts/lexicon/download-frequency-words.mjs",
    "--source",
    source,
    "--output",
    output,
    "--license",
    license,
    "--commit",
    "test-commit"
  ]);

  assert.match(stdout, /dryRun=true/);
  assert.match(stdout, /would download/);
  assert.equal(await pathExists(output), false);
  assert.equal(await pathExists(license), false);
});

test("LEX-002 download script writes frequency source and MIT trail", async () => {
  const dir = ".tmp-lex002/download-write";
  const source = `${dir}/source.txt`;
  const output = `${dir}/freq-es.txt`;
  const license = `${dir}/freq-es.LICENSE`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(source, "1\tpoder\t1200\n2\tquerer\t1180\n", "utf8");

  const { stdout } = await runNode([
    "scripts/lexicon/download-frequency-words.mjs",
    "--write",
    "--source",
    source,
    "--output",
    output,
    "--license",
    license,
    "--commit",
    "test-commit"
  ]);

  assert.match(stdout, /Downloaded frequency list/);
  assert.equal(await readFile(output, "utf8"), "1\tpoder\t1200\n2\tquerer\t1180\n");
  const licenseText = await readFile(license, "utf8");
  assert.match(licenseText, /MIT/i);
  assert.match(licenseText, /test-commit/);
  assert.match(licenseText, /source:/i);
});

test("LEX-002 candidate builder merges lemmas, filters noise, and defaults to dry-run", async () => {
  const dir = ".tmp-lex002/build-dry-run";
  const input = `${dir}/freq-es.txt`;
  const output = `${dir}/wordlist-b1-candidates.csv`;
  const existing = `${dir}/existing.json`;
  const lemmaDict = `${dir}/lemma-dict.json`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(
    input,
    [
      "1\tpoder\t1200",
      "2\tqueremos\t1100",
      "3\tquerer\t1000",
      "4\tcasas\t900",
      "5\tcasa\t850",
      "6\tvideo\t800",
      "7\tMadrid\t700",
      "8\tx\t600",
      "9\ttengo\t500",
      "10\ttener\t450",
      "11\ty\t400"
    ].join("\n") + "\n",
    "utf8"
  );
  await writeFile(
    existing,
    `${JSON.stringify([
      { kind: "word", lemma: "video" },
      { kind: "word", lemma: "y" },
      { kind: "construction", lemma: "gustar" }
    ], null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    lemmaDict,
    `${JSON.stringify({
      queremos: { lemma: "querer" },
      tengo: { lemma: "tener" }
    }, null, 2)}\n`,
    "utf8"
  );

  const { stdout } = await runNode([
    "scripts/lexicon/build-wordlist-candidates.mjs",
    "--input",
    input,
    "--output",
    output,
    "--existing",
    existing,
    "--lemma-dict",
    lemmaDict
  ], {
    env: {
      ...process.env,
      LEXICON_LEMMA_MOCK: JSON.stringify({
        queremos: "querer",
        tengo: "tener",
        casas: "casa"
      })
    }
  });

  assert.match(stdout, /dryRun=true/);
  assert.match(stdout, /candidates=4/);
  assert.match(stdout, /lemmatized=3/);
  assert.match(stdout, /deduped_existing=2/);
  assert.match(stdout, /filtered_noise=2/);
  assert.match(stdout, /querer,2,2100,queremos\|querer,2/);
  assert.match(stdout, /tener,9,950,tengo\|tener,2/);
  assert.match(stdout, /casa,4,1750,casas\|casa,2/);
  assert.match(stdout, /poder,1,1200,poder,1/);
  assert.doesNotMatch(stdout, /Madrid|video|,x,|,y,/);
  assert.equal(await pathExists(output), false);
});

test("LEX-002 candidate builder writes reviewed CSV shape", async () => {
  const dir = ".tmp-lex002/build-write";
  const input = `${dir}/freq-es.txt`;
  const output = `${dir}/wordlist-b1-candidates.csv`;
  const existing = `${dir}/existing.json`;
  const lemmaDict = `${dir}/lemma-dict.json`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(
    input,
    ["1\tpoder\t1200", "2\tpodemos\t1100", "3\tpoder\t1000", "4\tvideo\t900"].join("\n") + "\n",
    "utf8"
  );
  await writeFile(existing, `${JSON.stringify([{ kind: "word", lemma: "video" }], null, 2)}\n`, "utf8");
  await writeFile(
    lemmaDict,
    `${JSON.stringify({ podemos: { lemma: "poder" } }, null, 2)}\n`,
    "utf8"
  );

  const { stdout } = await runNode([
    "scripts/lexicon/build-wordlist-candidates.mjs",
    "--write",
    "--input",
    input,
    "--output",
    output,
    "--existing",
    existing,
    "--lemma-dict",
    lemmaDict
  ], {
    env: {
      ...process.env,
      LEXICON_LEMMA_MOCK: JSON.stringify({ podemos: "poder" })
    }
  });

  assert.match(stdout, /written=1/);
  const csv = await readFile(output, "utf8");
  assert.match(csv, /^lemma,freq_rank,raw_freq,source_forms,source_count\r?\n/);
  assert.match(csv, /poder,1,3300,poder\|podemos,3/);
  assert.doesNotMatch(csv, /video/);
});

test("LEX-002 candidate builder can normalize old orthography and drop short noise", async () => {
  const dir = ".tmp-lex002/build-noise";
  const input = `${dir}/freq-es.txt`;
  const existing = `${dir}/existing.json`;
  const lemmaDict = `${dir}/lemma-dict.json`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(
    input,
    ["1\tsólo\t1000", "2\teh\t900", "3\tuh\t800", "4\tya\t700", "5\tfuión\t600"].join("\n") + "\n",
    "utf8"
  );
  await writeFile(existing, "[]\n", "utf8");
  await writeFile(lemmaDict, "{}\n", "utf8");

  const { stdout } = await runNode([
    "scripts/lexicon/build-wordlist-candidates.mjs",
    "--input",
    input,
    "--existing",
    existing,
    "--lemma-dict",
    lemmaDict
  ], {
    env: {
      ...process.env,
      LEXICON_LEMMA_MOCK: JSON.stringify({
        "sólo": "solo",
        "fuión": "guion"
      })
    }
  });

  assert.match(stdout, /solo,1,1000,sólo,1/);
  assert.match(stdout, /guion,5,600,fuión,1/);
  assert.match(stdout, /filtered_noise=3/);
  assert.doesNotMatch(stdout, /eh|uh|ya/);
});

test("LEX-002 candidate builder guards high-frequency false lemma merges", async () => {
  const dir = ".tmp-lex002/build-guarded";
  const input = `${dir}/freq-es.txt`;
  const existing = `${dir}/existing.json`;
  const lemmaDict = `${dir}/lemma-dict.json`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(
    input,
    ["1\testá\t1000", "2\tsiento\t900", "3\tesposa\t800", "4\tgusta\t700"].join("\n") + "\n",
    "utf8"
  );
  await writeFile(
    existing,
    `${JSON.stringify([
      { kind: "word", lemma: "estar" },
      { kind: "word", lemma: "sentir" },
      { kind: "construction", lemma: "gustar" }
    ], null, 2)}\n`,
    "utf8"
  );
  await writeFile(lemmaDict, "{}\n", "utf8");

  const { stdout } = await runNode([
    "scripts/lexicon/build-wordlist-candidates.mjs",
    "--input",
    input,
    "--existing",
    existing,
    "--lemma-dict",
    lemmaDict
  ], {
    env: {
      ...process.env,
      LEXICON_LEMMA_MOCK: JSON.stringify({
        "está": "está",
        siento: "sentar",
        esposa: "esposar"
      })
    }
  });

  assert.match(stdout, /manual_overrides=3/);
  assert.match(stdout, /guarded_lemma=1/);
  assert.match(stdout, /deduped_existing=3/);
  assert.match(stdout, /esposa,3,800,esposa,1/);
  assert.doesNotMatch(stdout, /está,|siento,|gusta,|sentar|esposar/);
});

test("LEX-002 candidate builder surfaces Python lemmatizer startup failures", async () => {
  const dir = ".tmp-lex002/build-python-failure";
  const input = `${dir}/freq-es.txt`;
  const existing = `${dir}/existing.json`;
  const lemmaDict = `${dir}/lemma-dict.json`;
  const failingScript = `${dir}/failing_lemmatizer.py`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(input, "1\testá\t1000\n", "utf8");
  await writeFile(existing, "[]\n", "utf8");
  await writeFile(lemmaDict, "{}\n", "utf8");
  await writeFile(
    failingScript,
    [
      "import sys",
      "sys.stderr.write(\"ModuleNotFoundError: No module named 'simplemma'\\n\")",
      "sys.exit(1)"
    ].join("\n") + "\n",
    "utf8"
  );

  await assert.rejects(
    runNode([
      "scripts/lexicon/build-wordlist-candidates.mjs",
      "--input",
      input,
      "--existing",
      existing,
      "--lemma-dict",
      lemmaDict
    ], {
      env: {
        ...process.env,
        LEXICON_LEMMATIZER_SCRIPT: failingScript
      }
    }),
    (error) => {
      const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      assert.match(output, /Python lemmatizer startup failed/);
      assert.match(output, /ModuleNotFoundError: No module named 'simplemma'/);
      assert.doesNotMatch(output, /write EOF|EPIPE/);
      return true;
    }
  );
});

test("LEX-002 candidate builder defaults to the PM top-15k gate when limit is omitted", async () => {
  const dir = ".tmp-lex002/build-default-limit";
  const input = `${dir}/freq-es.txt`;
  const existing = `${dir}/existing.json`;
  const lemmaDict = `${dir}/lemma-dict.json`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const lines = [];
  for (let index = 1; index <= 15010; index += 1) {
    const suffix = toLetters(index);
    lines.push(`${index}\tp${suffix}\t${20000 - index}`);
  }
  await writeFile(input, `${lines.join("\n")}\n`, "utf8");
  await writeFile(existing, "[]\n", "utf8");
  await writeFile(lemmaDict, "{}\n", "utf8");

  const { stdout } = await runNode([
    "scripts/lexicon/build-wordlist-candidates.mjs",
    "--input",
    input,
    "--existing",
    existing,
    "--lemma-dict",
    lemmaDict
  ], {
    env: {
      ...process.env,
      LEXICON_LEMMA_MOCK: JSON.stringify(
        Object.fromEntries(
          lines.map((line) => {
            const word = line.split("\t")[1];
            return [word, word];
          })
        )
      )
    }
  });

  assert.match(stdout, /candidates=15000/);
  assert.doesNotMatch(stdout, /pqabae/);
});

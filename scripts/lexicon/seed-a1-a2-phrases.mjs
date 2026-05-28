#!/usr/bin/env node
// Timestamp: 2026-05-28 19:35
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFiles } from "./env-loader.mjs";
import { normalizeLemma, parseCsv, phrasePartOfSpeech } from "./phrase-utils.mjs";

const DEFAULT_CSV_PATH = "data/phrases-a1-a2-seed.csv";
const DEFAULT_TATOEBA_PAIRS_PATH = "data/tatoeba-es-zh.jsonl";
const PROGRESS_PATH = "data/lexicon-phrase-progress.json";
const DEFAULT_CONCURRENCY = 3;
let prisma;

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/seed-a1-a2-phrases.mjs [options]

Builds LexiconEntry phrase/collocation/idiom seed payloads from reviewed CSV.

Safe by default: this script runs as a dry-run unless --write is provided.

Options:
  --write           Actually write LexiconEntry rows to the database.
  --dry-run         Print payloads only. This is also the default.
  --csv PATH        Reviewed CSV path. Default: data/phrases-a1-a2-seed.csv.
  --tatoeba PATH    Path to tatoeba-es-zh.jsonl. Default: data/tatoeba-es-zh.jsonl.
  --limit N         Process at most N kept candidates.
  --resume          Skip lemmas recorded in data/lexicon-phrase-progress.json.
  --concurrency N   DeepSeek/write concurrency. Default: 3.
  --help, -h        Show this help text.`);
}

function getPrisma() {
  prisma ??= new PrismaClient();
  return prisma;
}

function unique(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

async function requireFile(path, label) {
  try {
    const info = await stat(path);
    if (info.size > 0) return;
  } catch {
    // fall through
  }
  throw new Error(`Missing ${label}: ${path}`);
}

async function readProgress() {
  if (!hasFlag("--resume")) return { done: [] };
  try {
    return JSON.parse(await readFile(PROGRESS_PATH, "utf8"));
  } catch {
    return { done: [] };
  }
}

async function writeProgress(progress) {
  await mkdir(dirname(PROGRESS_PATH), { recursive: true });
  await writeFile(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

function normalizeReviewedRows(csvText) {
  return parseCsv(csvText)
    .map((row) => ({
      lemma: normalizeLemma(row.lemma),
      displayForm: String(row.lemma ?? "").trim(),
      kind: String(row.kind ?? "").trim().toLowerCase(),
      level: String(row.level ?? "A1").trim().toUpperCase() === "A2" ? "A2" : "A1",
      category: String(row.category ?? "general").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "general",
      translationZh: String(row.translation_zh ?? "").trim(),
      keep: String(row.keep ?? "1").trim() !== "0"
    }))
    .filter((row) => row.keep && row.lemma && ["collocation", "phrase", "idiom"].includes(row.kind));
}

async function findPhraseExamples(lemma, path, limit = 3) {
  const input = createReadStream(path);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const examples = [];
  const needle = normalizeLemma(lemma);

  for await (const line of rl) {
    if (examples.length >= limit) break;
    const cleanLine = line.replace(/^\uFEFF/, "").trim();
    if (!cleanLine) continue;
    const pair = JSON.parse(cleanLine);
    if (normalizeLemma(pair.es).includes(needle)) {
      examples.push({ es: pair.es, zh: pair.zh, source: "tatoeba", esId: pair.esId, zhId: pair.zhId });
    }
  }

  return examples;
}

async function describePhrase(row) {
  const mock = process.env.LEXICON_PHRASE_MOCK_DESCRIPTIONS;
  if (mock) return JSON.parse(mock)[row.lemma] ?? {};

  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  if (!apiKey || apiKey.includes("your-") || apiKey.includes("placeholder")) {
    throw new Error("DEEPSEEK_API_KEY is required for phrase descriptions");
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return strict JSON for a Spanish A1-A2 phrase seed. Keys: explanationZh, translationEn. Keep the explanation short and useful for Chinese learners."
        },
        { role: "user", content: `${row.lemma} | ${row.kind} | ${row.category} | ${row.translationZh}` }
      ]
    })
  });

  if (!response.ok) throw new Error(`DeepSeek API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  return JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
}

async function generatePhraseExamples(row) {
  const mock = process.env.LEXICON_PHRASE_MOCK_EXAMPLES;
  if (mock) return normalizeGeneratedExamples(JSON.parse(mock)[row.lemma] ?? []);

  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  if (!apiKey || apiKey.includes("your-") || apiKey.includes("placeholder")) {
    throw new Error("DEEPSEEK_API_KEY is required for phrase examples");
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return strict JSON with key examples. Generate 2 simple A1-A2 Spanish-Chinese sentence pairs using the phrase. Each example must have es and zh."
        },
        { role: "user", content: row.lemma }
      ]
    })
  });

  if (!response.ok) throw new Error(`DeepSeek examples API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
  return normalizeGeneratedExamples(parsed.examples ?? parsed);
}

function normalizeGeneratedExamples(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((example) => typeof example?.es === "string" && typeof example?.zh === "string")
    .map((example) => ({ es: example.es.trim(), zh: example.zh.trim(), source: "llm-generated" }))
    .filter((example) => example.es && example.zh)
    .slice(0, 3);
}

async function resolveExamples(row, tatoebaPath) {
  const examples = await findPhraseExamples(row.lemma, tatoebaPath);
  if (examples.length >= 2) return examples;
  const generated = await generatePhraseExamples(row);
  if (generated.length >= 2) return generated;
  throw new Error(`Need at least 2 examples for ${row.lemma}`);
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function upsertLexiconEntry(input) {
  return getPrisma().lexiconEntry.upsert({
    where: { kind_lemma: { kind: input.kind, lemma: input.lemma } },
    create: input,
    update: {
      displayForm: input.displayForm,
      forms: input.forms,
      partOfSpeech: input.partOfSpeech,
      level: input.level,
      translationZh: input.translationZh,
      translationEn: input.translationEn,
      explanationZh: input.explanationZh,
      examples: input.examples,
      morphology: input.morphology,
      collocations: input.collocations,
      sources: input.sources,
      licenseCode: input.licenseCode,
      qualityScore: input.qualityScore
    }
  });
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const dryRun = !write;
  const csvPath = readOption("--csv", DEFAULT_CSV_PATH);
  const tatoebaPath = readOption("--tatoeba", DEFAULT_TATOEBA_PAIRS_PATH);
  const limit = Number(readOption("--limit", "0"));
  const concurrency = Number(readOption("--concurrency", String(DEFAULT_CONCURRENCY)));
  await loadEnvFiles();
  await requireFile(csvPath, "reviewed CSV");
  await requireFile(tatoebaPath, "Tatoeba pairs");

  const progress = await readProgress();
  const done = new Set(progress.done ?? []);
  const rows = normalizeReviewedRows(await readFile(csvPath, "utf8")).filter((row) => !done.has(`${row.kind}:${row.lemma}`));
  const selected = limit > 0 ? rows.slice(0, limit) : rows;
  const stats = { written: 0, dryRun: 0, skipped: 0 };
  console.log(`Phrase seed candidates=${rows.length} selected=${selected.length} dryRun=${dryRun}`);

  await runPool(selected, Math.max(1, concurrency), async (row) => {
    try {
      const description = await describePhrase(row);
      const examples = await resolveExamples(row, tatoebaPath);
      const input = {
        kind: row.kind,
        lemma: row.lemma,
        displayForm: row.displayForm || row.lemma,
        forms: [row.lemma],
        partOfSpeech: phrasePartOfSpeech(row.kind, row.category),
        level: row.level,
        ipa: null,
        translationZh: row.translationZh,
        translationEn: description.translationEn ?? "",
        explanationZh: description.explanationZh ?? "",
        examples,
        morphology: null,
        collocations: [],
        sources: unique(["llm-deepseek", ...examples.map((example) => example.source)]),
        licenseCode: "CC-BY-2.0-FR",
        qualityScore: 1
      };

      if (dryRun) {
        console.log(JSON.stringify(input));
        stats.dryRun += 1;
      } else {
        await upsertLexiconEntry(input);
        console.log(`Wrote LexiconEntry ${row.kind}:${row.lemma}`);
        done.add(`${row.kind}:${row.lemma}`);
        progress.done = [...done];
        await writeProgress(progress);
        stats.written += 1;
      }
    } catch (error) {
      stats.skipped += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[skip] ${row.kind}:${row.lemma}: ${reason}`);
    }
  });

  console.log(`Seed phrase summary written=${stats.written} dryRun=${stats.dryRun} skipped=${stats.skipped}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
}

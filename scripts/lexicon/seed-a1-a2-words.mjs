#!/usr/bin/env node
// Timestamp: 2026-05-28 16:44
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";

const DEFAULT_TATOEBA_PAIRS_PATH = "data/tatoeba-es-zh.jsonl";
const PROGRESS_PATH = "data/lexicon-progress.json";
const PHASE_ONE_WORDS_PATH = "content/curriculum/phase1-words.json";
const DEFAULT_CONCURRENCY = 3;
const ALLOWED_SINGLE_LETTER = new Set(["y", "e", "o", "u"]);
const PERSON_LABELS = {
  yo: "yo",
  tu: "tú",
  el: "él",
  nosotros: "nosotros",
  vosotros: "vosotros",
  ellos: "ellos"
};
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
  console.log(`Usage: node scripts/lexicon/seed-a1-a2-words.mjs [options]

Builds LexiconEntry seed payloads from curated A1-A2 course vocabulary.

Safe by default: this script runs as a dry-run unless --write is provided.

Options:
  --write                 Actually write LexiconEntry rows to the database.
  --dry-run               Print payloads only. This is also the default.
  --limit N               Process at most N candidates.
  --resume                Skip lemmas recorded in data/lexicon-progress.json.
  --concurrency N         DeepSeek/write concurrency. Default: 3.
  --lemmas a,b,c          Override candidates with explicit lemmas for QA.
  --tatoeba PATH          Path to tatoeba-es-zh.jsonl. Default: data/tatoeba-es-zh.jsonl.
  --help, -h              Show this help text.`);
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripLeadingArticle(value) {
  return normalizeText(value).replace(/^(el|la|los|las|un|una|unos|unas)\s+/, "");
}

function splitVariants(value) {
  return normalizeText(value)
    .split(/\s*\/\s*|,\s*/)
    .map(stripLeadingArticle)
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function isValidLemma(value) {
  const lemma = normalizeText(value);
  if (!lemma) return false;
  if (lemma.length === 1 && !ALLOWED_SINGLE_LETTER.has(lemma)) return false;
  if (lemma.length < 2 && !ALLOWED_SINGLE_LETTER.has(lemma)) return false;
  if (lemma.split(/\s+/).length > 3) return false;
  return /^[a-záéíóúüñ]+(?:[ -][a-záéíóúüñ]+)*$/i.test(lemma);
}

function buildPlural(lemma) {
  if (lemma.endsWith("z")) return `${lemma.slice(0, -1)}ces`;
  if (/[aeiouáéíóú]$/i.test(lemma)) return `${lemma}s`;
  return `${lemma}es`;
}

function mapPhaseOnePartOfSpeech(entry) {
  const raw = normalizeText(entry.partOfSpeech);
  if (raw === "verb") return "verb";
  if (raw === "adjective" || raw === "adj") return "adj";
  if (raw === "adverb" || raw === "adv") return "adv";
  if (raw === "noun") {
    if (entry.gender === "feminine") return "noun_f";
    if (entry.gender === "masculine") return "noun_m";
    return "noun_mf";
  }
  return raw || undefined;
}

function getPrisma() {
  prisma ??= new PrismaClient();
  return prisma;
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

async function requireTatoebaPairs(path) {
  try {
    const info = await stat(path);
    if (info.size > 0) return;
  } catch {
    // fall through
  }
  throw new Error(`Please run parse-tatoeba.mjs first: missing ${path}`);
}

async function readPhaseOneWordEntries() {
  const payload = JSON.parse(await readFile(PHASE_ONE_WORDS_PATH, "utf8"));
  return (payload.words ?? []).flatMap((entry) =>
    splitVariants(entry.spanish).filter(isValidLemma).map((lemma) => ({
      lemma,
      partOfSpeech: mapPhaseOnePartOfSpeech(entry),
      level: "A1",
      translationZh: entry.chinese ?? "",
      translationEn: "",
      explanationZh: "",
      ipa: "",
      forms: entry.partOfSpeech === "noun" ? [lemma, buildPlural(lemma)] : [lemma]
    }))
  );
}

function buildFoundationEntries(foundationLessons) {
  return foundationLessons.flatMap((lesson) =>
    (lesson.words ?? []).filter(isValidLemma).map((lemma) => ({
      lemma: normalizeText(lemma),
      partOfSpeech: ALLOWED_SINGLE_LETTER.has(normalizeText(lemma)) ? "conj" : undefined,
      level: "A1",
      translationZh: "",
      translationEn: "",
      explanationZh: "",
      ipa: "",
      forms: [lemma]
    }))
  );
}

async function collectLemmaCandidates() {
  const explicit = readOption("--lemmas");
  const { foundationLessons } = await import("../../src/content/foundation.ts");
  const phaseOneEntries = await readPhaseOneWordEntries();
  const foundationEntries = buildFoundationEntries(foundationLessons);
  const knownEntries = [...phaseOneEntries, ...foundationEntries];
  const knownByLemma = new Map(knownEntries.map((entry) => [normalizeText(entry.lemma), entry]));
  const entries = explicit
    ? splitVariants(explicit).filter(isValidLemma).map((lemma) => ({
        ...(knownByLemma.get(lemma) ?? {}),
        lemma,
        forms: knownByLemma.get(lemma)?.forms ?? [lemma]
      }))
    : knownEntries;

  const byLemma = new Map();
  for (const entry of entries) {
    const lemma = normalizeText(entry.lemma);
    if (!isValidLemma(lemma)) continue;
    const existing = byLemma.get(lemma);
    byLemma.set(lemma, {
      ...existing,
      ...entry,
      lemma,
      forms: unique([...(existing?.forms ?? []), ...(entry.forms ?? [lemma])])
    });
  }
  return [...byLemma.values()];
}

function flattenVerbForms(conjugations) {
  if (!conjugations) return [];
  const personForms = Object.values(conjugations)
    .filter((value) => value && typeof value === "object")
    .flatMap((record) =>
      Object.entries(record).flatMap(([person, form]) => {
        if (!form || typeof form !== "string") return [];
        const label = PERSON_LABELS[person];
        return label ? [`${label} ${form}`] : [];
      })
    );

  return unique([
    conjugations.participio,
    conjugations.gerundio,
    ...Object.values(conjugations)
      .flatMap((value) => typeof value === "string" ? [value] : Object.values(value ?? {})),
    ...personForms
  ]);
}

async function findExamples(forms, path, limit = 3) {
  const formSet = forms.map((form) => normalizeText(form));
  const input = createReadStream(path);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const examples = [];

  for await (const line of rl) {
    if (examples.length >= limit) break;
    const cleanLine = line.replace(/^\uFEFF/, "").trim();
    if (!cleanLine) continue;
    const pair = JSON.parse(cleanLine);
    const es = normalizeText(pair.es);
    if (formSet.some((form) => new RegExp(`(^|[^a-záéíóúüñ])${escapeRegExp(form)}([^a-záéíóúüñ]|$)`, "i").test(es))) {
      examples.push({ es: pair.es, zh: pair.zh, source: "tatoeba", esId: pair.esId, zhId: pair.zhId });
    }
  }

  return examples;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function describeWithDeepSeek(lemma) {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  if (!apiKey || apiKey.includes("your-") || apiKey.includes("placeholder")) {
    throw new Error("DEEPSEEK_API_KEY is required for --write");
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
            "Return strict JSON for a Spanish A1-A2 lexicon seed. Keys: partOfSpeech, level, translationZh, translationEn, explanationZh, ipa, forms."
        },
        { role: "user", content: lemma }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
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
    where: {
      kind_lemma: {
        kind: input.kind,
        lemma: normalizeText(input.lemma)
      }
    },
    create: {
      ...input,
      lemma: normalizeText(input.lemma),
      forms: unique(input.forms)
    },
    update: {
      displayForm: input.displayForm,
      forms: unique(input.forms),
      partOfSpeech: input.partOfSpeech,
      level: input.level,
      ipa: input.ipa,
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
  const limit = Number(readOption("--limit", "0"));
  const concurrency = Number(readOption("--concurrency", String(DEFAULT_CONCURRENCY)));
  const tatoebaPath = readOption("--tatoeba", DEFAULT_TATOEBA_PAIRS_PATH);
  await requireTatoebaPairs(tatoebaPath);
  const { tryConjugateVerb } = await import("../../src/lib/conjugate.ts");

  const progress = await readProgress();
  const done = new Set(progress.done ?? []);
  const candidates = (await collectLemmaCandidates()).filter((entry) => !done.has(entry.lemma));
  const selected = limit > 0 ? candidates.slice(0, limit) : candidates;
  console.log(`Seed candidates=${candidates.length} selected=${selected.length} dryRun=${dryRun}`);

  await runPool(selected, Math.max(1, concurrency), async (candidate) => {
    const lemma = candidate.lemma;
    const verb = tryConjugateVerb(lemma);
    const ai = dryRun
      ? {
          partOfSpeech: verb ? "verb" : candidate.partOfSpeech,
          level: candidate.level ?? "A1",
          translationZh: candidate.translationZh ?? "",
          translationEn: candidate.translationEn ?? "",
          explanationZh: candidate.explanationZh ?? "",
          ipa: candidate.ipa ?? "",
          forms: candidate.forms ?? [lemma]
        }
      : { ...candidate, ...await describeWithDeepSeek(lemma) };

    const isVerb = ai.partOfSpeech === "verb" && verb;
    const forms = unique([
      lemma,
      ...(Array.isArray(ai.forms) ? ai.forms : []),
      ...(isVerb ? flattenVerbForms(verb) : [])
    ]);
    const examples = await findExamples(forms, tatoebaPath);
    if (examples.length === 0) {
      throw new Error(`No Tatoeba examples found for ${lemma}; refusing to write an empty examples array`);
    }

    const input = {
      kind: "word",
      lemma,
      displayForm: lemma,
      forms,
      partOfSpeech: isVerb ? "verb" : ai.partOfSpeech,
      level: ai.level,
      ipa: ai.ipa,
      translationZh: ai.translationZh,
      translationEn: ai.translationEn,
      explanationZh: ai.explanationZh,
      examples,
      morphology: isVerb ? verb : null,
      collocations: [],
      sources: ["tatoeba", "llm-deepseek"],
      licenseCode: "CC-BY-2.0-FR",
      qualityScore: 1
    };

    if (dryRun) console.log(JSON.stringify(input));
    else {
      await upsertLexiconEntry(input);
      console.log(`Wrote LexiconEntry ${lemma}`);
      done.add(lemma);
      progress.done = [...done];
      await writeProgress(progress);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (prisma) await prisma.$disconnect();
});

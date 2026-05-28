#!/usr/bin/env node
// Timestamp: 2026-05-28 16:24
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";

import { foundationLessons } from "../../src/content/foundation.ts";
import { tryConjugateVerb } from "../../src/lib/conjugate.ts";

const TATOEBA_PAIRS_PATH = "data/tatoeba-es-zh.jsonl";
const PROGRESS_PATH = "data/lexicon-progress.json";
const DEFAULT_CONCURRENCY = 3;
const prisma = new PrismaClient();

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function unique(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
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

async function walkJsonFiles(dir, output = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return output;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walkJsonFiles(path, output);
    if (entry.isFile() && entry.name.endsWith(".json")) output.push(path);
  }
  return output;
}

function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

async function collectLemmaCandidates() {
  const words = [];
  for (const lesson of foundationLessons) {
    words.push(...(lesson.words ?? []));
  }

  for (const file of await walkJsonFiles("src/content")) {
    const payload = JSON.parse(await readFile(file, "utf8"));
    const strings = collectStrings(payload);
    for (const value of strings) {
      if (/^[a-záéíóúüñ -]{2,}$/i.test(value.trim()) && value.split(/\s+/).length <= 3) {
        words.push(value);
      }
    }
  }

  return unique(words);
}

function flattenVerbForms(conjugations) {
  if (!conjugations) return [];
  return unique([
    conjugations.participio,
    conjugations.gerundio,
    ...Object.values(conjugations)
      .flatMap((value) => typeof value === "string" ? [value] : Object.values(value ?? {}))
  ]);
}

async function findExamples(forms, limit = 3) {
  try {
    await stat(TATOEBA_PAIRS_PATH);
  } catch {
    return [];
  }

  const formSet = forms.map((form) => normalizeText(form));
  const input = createReadStream(TATOEBA_PAIRS_PATH);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const examples = [];

  for await (const line of rl) {
    if (examples.length >= limit) break;
    const pair = JSON.parse(line);
    const es = normalizeText(pair.es);
    if (formSet.some((form) => es.includes(form))) {
      examples.push({ es: pair.es, zh: pair.zh, source: "tatoeba", esId: pair.esId, zhId: pair.zhId });
    }
  }

  return examples;
}

async function describeWithDeepSeek(lemma) {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  if (!apiKey || apiKey.includes("your-") || apiKey.includes("placeholder")) {
    throw new Error("DEEPSEEK_API_KEY is required unless --dry-run is used");
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
  return prisma.lexiconEntry.upsert({
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
  const limit = Number(readOption("--limit", "0"));
  const dryRun = hasFlag("--dry-run");
  const concurrency = Number(readOption("--concurrency", String(DEFAULT_CONCURRENCY)));
  const progress = await readProgress();
  const done = new Set(progress.done ?? []);

  const candidates = (await collectLemmaCandidates()).filter((lemma) => !done.has(lemma));
  const selected = limit > 0 ? candidates.slice(0, limit) : candidates;
  console.log(`Seed candidates=${candidates.length} selected=${selected.length} dryRun=${dryRun}`);

  await runPool(selected, Math.max(1, concurrency), async (lemma) => {
    const verb = tryConjugateVerb(lemma);
    const ai = dryRun
      ? {
          partOfSpeech: verb ? "verb" : "noun_m",
          level: "A1",
          translationZh: "",
          translationEn: "",
          explanationZh: "",
          ipa: ""
        }
      : await describeWithDeepSeek(lemma);

    const forms = unique([lemma, ...(Array.isArray(ai.forms) ? ai.forms : []), ...flattenVerbForms(verb)]);
    const examples = await findExamples(forms);
    const input = {
      kind: "word",
      lemma,
      displayForm: lemma,
      forms,
      partOfSpeech: ai.partOfSpeech,
      level: ai.level,
      ipa: ai.ipa,
      translationZh: ai.translationZh,
      translationEn: ai.translationEn,
      explanationZh: ai.explanationZh,
      examples,
      morphology: verb ?? null,
      collocations: [],
      sources: ["tatoeba", "llm-deepseek"],
      licenseCode: "CC-BY-2.0-FR",
      qualityScore: 1
    };

    if (dryRun) console.log(JSON.stringify(input));
    else await upsertLexiconEntry(input);

    if (!dryRun) {
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
  await prisma.$disconnect();
});

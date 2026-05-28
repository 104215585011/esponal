#!/usr/bin/env node
// Timestamp: 2026-05-28 19:35
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { dedupePhraseCandidates, phraseCandidatesToCsv } from "./phrase-utils.mjs";
import { loadEnvFiles } from "./env-loader.mjs";

const DEFAULT_OUTPUT_PATH = "data/phrases-a1-a2-candidates.csv";
const TARGETS = [
  { kind: "collocation", count: 201 },
  { kind: "phrase", count: 200 },
  { kind: "idiom", count: 100 }
];
const BATCH_SIZE = 50;

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/generate-phrase-candidates.mjs [options]

Generates A1-A2 Spanish phrase/collocation candidate CSV rows for PM review.

Safe by default: this script prints CSV to stdout unless --write is provided.

Options:
  --write          Write the CSV file.
  --output PATH    Output CSV path. Default: data/phrases-a1-a2-candidates.csv.
  --limit N        Keep at most N normalized candidates.
  --help, -h       Show this help text.`);
}

function parseJsonContent(content) {
  const trimmed = String(content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(trimmed);
}

function extractCandidates(parsed, kind) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.candidates)) return parsed.candidates;
  if (Array.isArray(parsed[kind])) return parsed[kind];
  if (Array.isArray(parsed.phrases)) return parsed.phrases;
  if (Array.isArray(parsed.items)) return parsed.items;
  return Object.values(parsed).find(Array.isArray) ?? [];
}

async function callDeepSeek(kind, count, batchIndex = 0) {
  const mock = process.env.LEXICON_PHRASE_MOCK_RESPONSES;
  if (mock) return JSON.parse(mock)[kind] ?? [];

  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  if (!apiKey || apiKey.includes("your-") || apiKey.includes("placeholder")) {
    throw new Error("DEEPSEEK_API_KEY is required without LEXICON_PHRASE_MOCK_RESPONSES");
  }

  const brief = {
    collocation: "A1-A2 Spanish verb collocations and fixed structures such as tener que, ir a, hay que, acabar de.",
    phrase: "A1-A2 Spanish greetings, courtesy phrases, classroom phrases, and common time/place phrases.",
    idiom: "A1-A2 Spanish useful everyday idiomatic expressions that learners will really use, not literary expressions."
  }[kind];
  const request = {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return strict JSON with key candidates. Each candidate must have lemma, level, category, translation_zh, keep. Every lemma must be Spanish, not English. Use kind only from the user request."
        },
        { role: "user", content: `List ${count} ${brief} Batch index: ${batchIndex}. Avoid duplicates across common textbook phrases.` }
      ]
    })
  };
  const response = await fetchWithRetry(`${baseUrl}/v1/chat/completions`, request);

  if (!response.ok) {
    throw new Error(`DeepSeek API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "{}";
  const parsed = parseJsonContent(content);
  return extractCandidates(parsed, kind);
}

async function fetchWithRetry(url, request) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetch(url, request);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

async function buildCandidates(limit) {
  const rows = [];
  for (const target of TARGETS) {
    if (process.env.LEXICON_PHRASE_MOCK_RESPONSES) {
      const candidates = await callDeepSeek(target.kind, target.count);
      rows.push(...candidates.map((candidate) => ({ ...candidate, kind: target.kind })));
      continue;
    }

    const kindRows = [];
    const maxBatches = Math.ceil(target.count / BATCH_SIZE) + 16;
    for (let index = 0; index < maxBatches; index += 1) {
      const remaining = target.count - dedupePhraseCandidates(kindRows).length;
      if (remaining <= 0) break;
      const count = Math.min(BATCH_SIZE, remaining + 30);
      const candidates = await callDeepSeek(target.kind, count, index + 1);
      kindRows.push(...candidates.map((candidate) => ({ ...candidate, kind: target.kind })));
    }
    rows.push(...dedupePhraseCandidates(kindRows).slice(0, target.count));
  }

  const normalized = dedupePhraseCandidates(rows);
  return limit > 0 ? normalized.slice(0, limit) : normalized;
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const output = readOption("--output", DEFAULT_OUTPUT_PATH);
  const limit = Number(readOption("--limit", "0"));
  await loadEnvFiles();
  const rows = await buildCandidates(limit);
  const csv = phraseCandidatesToCsv(rows);

  if (write) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, csv, "utf8");
  } else {
    process.stdout.write(csv);
  }
  console.log(`Phrase candidates=${rows.length} written=${write ? rows.length : 0} output=${write ? output : "[stdout]"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
// Timestamp: 2026-05-29 21:26
import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { loadEnvFiles } from "./env-loader.mjs";

const DEFAULT_INPUT = "data/freq-es.txt";
const DEFAULT_OUTPUT = "data/wordlist-b1-candidates.csv";
const DEFAULT_LEMMA_DICT = "extension/lemma-dict.json";
const DEFAULT_LIMIT = 15_000;
const HEADER = ["lemma", "freq_rank", "raw_freq", "source_forms", "source_count"];
const ALLOWED_SINGLE_LETTER = new Set(["y", "e", "o", "u"]);
const OLD_ORTHOGRAPHY_MAP = new Map([
  ["sólo", "solo"],
  ["solo", "solo"],
  ["guión", "guion"],
  ["truhán", "truhan"],
  ["hui", "hui"],
  ["guion", "guion"]
]);
const MANUAL_FORM_LEMMA_OVERRIDES = new Map([
  ["está", "estar"],
  ["estás", "estar"],
  ["están", "estar"],
  ["esté", "estar"],
  ["había", "haber"],
  ["he", "haber"],
  ["hemos", "haber"],
  ["hay", "haber"],
  ["sea", "ser"],
  ["será", "ser"],
  ["sería", "ser"],
  ["fui", "ir"],
  ["fue", "ir"],
  ["tenía", "tener"],
  ["tengo", "tener"],
  ["tiene", "tener"],
  ["puedo", "poder"],
  ["puede", "poder"],
  ["pueden", "poder"],
  ["podría", "poder"],
  ["podrías", "poder"],
  ["podía", "poder"],
  ["quiero", "querer"],
  ["quiere", "querer"],
  ["quería", "querer"],
  ["creo", "creer"],
  ["dije", "decir"],
  ["dijo", "decir"],
  ["dicho", "decir"],
  ["hice", "hacer"],
  ["hizo", "hacer"],
  ["haré", "hacer"],
  ["haciendo", "hacer"],
  ["hecho", "hacer"],
  ["sé", "saber"],
  ["sabía", "saber"],
  ["debe", "deber"],
  ["debes", "deber"],
  ["debería", "deber"],
  ["deberías", "deber"],
  ["gusta", "gustar"],
  ["gustaría", "gustar"],
  ["importa", "importar"],
  ["pasa", "pasar"],
  ["pasó", "pasar"],
  ["pensé", "pensar"],
  ["siento", "sentir"],
  ["siente", "sentir"],
  ["visto", "ver"],
  ["viste", "ver"],
  ["vengo", "venir"],
  ["venga", "venir"],
  ["vengan", "venir"],
  ["vamos", "ir"],
  ["ven", "venir"],
  ["dame", "dar"],
  ["dime", "decir"],
  ["déjame", "dejar"]
]);

let prisma;

function hasFlag(name) {
  return process.argv.includes(name);
}

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/build-wordlist-candidates.mjs [options]

Builds a PM-review CSV of clean B1+ word candidates from the FrequencyWords source.

Safe by default: this script runs as a dry-run unless --write is provided.

Options:
  --write             Actually write data/wordlist-b1-candidates.csv.
  --dry-run           Preview only. This is also the default.
  --input PATH        Frequency list path. Default: data/freq-es.txt.
  --output PATH       Candidate CSV path. Default: data/wordlist-b1-candidates.csv.
  --existing PATH     Optional JSON fixture of existing lexicon rows for tests.
  --lemma-dict PATH   Optional lemma dictionary JSON. Default: extension/lemma-dict.json.
  --limit N           Limit output rows after cleaning/merge. Default: 15000.
  --help, -h          Show this help text.`);
}

function normalizeSpanishWord(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/gi, "");
}

function normalizeLegacyOrthography(word) {
  return OLD_ORTHOGRAPHY_MAP.get(word) ?? word;
}

function isCapitalizedNoise(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return false;
  return /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+$/.test(trimmed);
}

function isValidCandidate(word) {
  if (!word) return false;
  if (word.length === 1) return ALLOWED_SINGLE_LETTER.has(word);
  return /^[a-záéíóúüñ-]+$/i.test(word);
}

function shouldFilterNoise(normalizedWord) {
  if (!normalizedWord) return true;
  if (normalizedWord.length <= 2 && !ALLOWED_SINGLE_LETTER.has(normalizedWord)) return true;
  return !isValidCandidate(normalizedWord);
}

function parseFrequencyLine(line, fallbackRank) {
  const parts = String(line).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  if (/^\d+$/.test(parts[0]) && parts.length >= 3) {
    const rank = Number(parts[0]);
    const word = parts[1];
    const rawFreq = Number(parts[2]);
    if (!Number.isFinite(rank) || !word || !Number.isFinite(rawFreq)) return null;
    return { rank, word, rawFreq };
  }

  const word = parts[0];
  const rawFreq = Number(parts[1]);
  if (!word || !Number.isFinite(rawFreq)) return null;
  return { rank: fallbackRank, word, rawFreq };
}

async function readLemmaDict(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

async function loadExistingRows(path) {
  if (path) {
    return JSON.parse(await readFile(path, "utf8"));
  }

  await loadEnvFiles();
  prisma ??= new PrismaClient();
  return await prisma.lexiconEntry.findMany({
    select: { kind: true, lemma: true },
    orderBy: { lemma: "asc" }
  });
}

function runPythonLemmatizer(words) {
  return new Promise((resolve, reject) => {
    const scriptPath = process.env.LEXICON_LEMMATIZER_SCRIPT || join("scripts", "lexicon", "simplemma_lemmatize.py");
    const child = spawn("python", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let stdinError = null;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdin.on("error", (error) => {
      stdinError = error;
    });
    child.on("error", (error) => {
      fail(new Error(`Python lemmatizer startup failed: ${error.message}`));
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        fail(new Error(
          `Python lemmatizer startup failed (${code}). Install dependencies with ` +
          "`python -m pip install -r scripts/lexicon/requirements.txt`.\n" +
          `${stderr || stdout || stdinError?.message || "No stderr captured."}`
        ));
        return;
      }
      if (stdinError) {
        fail(new Error(`Python lemmatizer stdin failed: ${stdinError.message}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        succeed(parsed.lemmas ?? {});
      } catch (error) {
        fail(error);
      }
    });
    try {
      child.stdin.end(JSON.stringify({ words }));
    } catch (error) {
      stdinError = error;
    }
  });
}

async function loadLemmaMap(words) {
  const mock = process.env.LEXICON_LEMMA_MOCK?.trim();
  if (mock) {
    return JSON.parse(mock);
  }
  await runPythonLemmatizer([words[0] ?? "hola"]);
  return await runPythonLemmatizer(words);
}

function buildCsv(rows) {
  return [
    HEADER.join(","),
    ...rows.map((row) =>
      [row.lemma, row.freq_rank, row.raw_freq, row.source_forms, row.source_count].join(",")
    )
  ].join("\n") + "\n";
}

function applyLemmaFallbacks(word, lemma, lemmaDict) {
  const normalizedWord = normalizeLegacyOrthography(normalizeSpanishWord(word));
  const manualLemma = MANUAL_FORM_LEMMA_OVERRIDES.get(normalizedWord);
  if (manualLemma) return { lemma: manualLemma, source: "manual" };

  const dictLemma = normalizeLegacyOrthography(normalizeSpanishWord(lemmaDict[word]?.lemma));
  if (dictLemma) return { lemma: dictLemma, source: "dict" };

  const normalizedLemma = normalizeLegacyOrthography(normalizeSpanishWord(lemma));
  if (isSuspiciousInfinitiveProjection(normalizedWord, normalizedLemma)) {
    return { lemma: normalizedWord, source: "guarded" };
  }
  return { lemma: normalizedLemma || normalizedWord, source: normalizedLemma ? "lemmatizer" : "self" };
}

function stripNominalEnding(word) {
  return word.replace(/(?:as|os|es|a|o)$/u, "");
}

function isSuspiciousInfinitiveProjection(word, lemma) {
  if (!word || !lemma || word === lemma) return false;
  if (!/^[a-záéíóúüñ]+$/iu.test(word) || !/^[a-záéíóúüñ]+$/iu.test(lemma)) return false;
  if (!lemma.endsWith("ar")) return false;
  if (word.endsWith("ando") || word.endsWith("ado") || word.endsWith("ada")) return false;

  const lemmaStem = lemma.slice(0, -2);
  const wordStem = stripNominalEnding(word);
  if (wordStem.length < 3) return false;
  if (lemma === `${word}r`) return true;
  return lemmaStem === wordStem;
}

export async function buildWordlistCandidates({
  inputPath = DEFAULT_INPUT,
  existingPath = undefined,
  lemmaDictPath = DEFAULT_LEMMA_DICT,
  limit = DEFAULT_LIMIT
} = {}) {
  const text = await readFile(inputPath, "utf8");
  const parsedRows = [];
  let filteredNoise = 0;

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const parsed = parseFrequencyLine(line, index + 1);
    if (!parsed) continue;
    if (isCapitalizedNoise(parsed.word)) {
      filteredNoise += 1;
      continue;
    }
    const sourceForm = normalizeSpanishWord(parsed.word);
    const normalizedWord = normalizeLegacyOrthography(sourceForm);
    if (shouldFilterNoise(normalizedWord)) {
      filteredNoise += 1;
      continue;
    }
    parsedRows.push({ ...parsed, normalizedWord, sourceForm });
  }

  const lemmaDict = await readLemmaDict(lemmaDictPath);
  const lemmaMap = await loadLemmaMap([...new Set(parsedRows.map((row) => row.normalizedWord))]);
  const existingRows = await loadExistingRows(existingPath);
  const existingLemmas = new Set(existingRows.map((row) => normalizeLegacyOrthography(normalizeSpanishWord(row.lemma))));
  const byLemma = new Map();
  let lemmatized = 0;
  let dedupedExisting = 0;
  let manualOverrides = 0;
  let guardedLemma = 0;

  for (const row of parsedRows) {
    const resolved = applyLemmaFallbacks(row.normalizedWord, lemmaMap[row.normalizedWord], lemmaDict);
    const lemma = resolved.lemma;
    if (!isValidCandidate(lemma) || shouldFilterNoise(lemma)) {
      filteredNoise += 1;
      continue;
    }
    if (resolved.source === "manual") {
      manualOverrides += 1;
    }
    if (resolved.source === "guarded") {
      guardedLemma += 1;
    }
    if (lemma !== row.normalizedWord) {
      lemmatized += 1;
    }
    if (existingLemmas.has(lemma)) {
      dedupedExisting += 1;
      continue;
    }
    const current = byLemma.get(lemma) ?? {
      lemma,
      freq_rank: row.rank,
      raw_freq: 0,
      source_forms: [],
      source_count: 0
    };
    current.freq_rank = Math.min(current.freq_rank, row.rank);
    current.raw_freq += row.rawFreq;
    current.source_count += 1;
    if (!current.source_forms.includes(row.sourceForm)) {
      current.source_forms.push(row.sourceForm);
    }
    byLemma.set(lemma, current);
  }

  const rows = [...byLemma.values()]
    .sort((a, b) => a.freq_rank - b.freq_rank || b.raw_freq - a.raw_freq || a.lemma.localeCompare(b.lemma))
    .slice(0, Number(limit || DEFAULT_LIMIT))
    .map((row) => ({
      ...row,
      source_forms: row.source_forms.join("|")
    }));

  return { rows, stats: { lemmatized, dedupedExisting, filteredNoise, manualOverrides, guardedLemma } };
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const inputPath = readOption("--input", DEFAULT_INPUT);
  const outputPath = readOption("--output", DEFAULT_OUTPUT);
  const existingPath = readOption("--existing");
  const lemmaDictPath = readOption("--lemma-dict", DEFAULT_LEMMA_DICT);
  const limit = readOption("--limit");
  const { rows, stats } = await buildWordlistCandidates({ inputPath, existingPath, lemmaDictPath, limit });

  console.log(
    `LEX-002 candidates dryRun=${!write} input=${inputPath} output=${outputPath} candidates=${rows.length} lemmatized=${stats.lemmatized} deduped_existing=${stats.dedupedExisting} filtered_noise=${stats.filteredNoise}`
    + ` manual_overrides=${stats.manualOverrides} guarded_lemma=${stats.guardedLemma}`
  );

  if (!write) {
    console.log(HEADER.join(","));
    for (const row of rows) {
      console.log([row.lemma, row.freq_rank, row.raw_freq, row.source_forms, row.source_count].join(","));
    }
    return;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildCsv(rows), "utf8");
  console.log(`Wordlist candidates written=${rows.length} -> ${outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
}

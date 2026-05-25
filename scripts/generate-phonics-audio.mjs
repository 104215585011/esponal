import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const alphabetPath = path.join(repoRoot, "content", "phonics", "alphabet.ts");
const foundationsPath = path.join(repoRoot, "content", "phonics", "foundations.ts");
const prosodyPath = path.join(repoRoot, "content", "phonics", "prosody.ts");
const outputRoot = path.join(repoRoot, "public", "audio", "phonics");
const voiceName = "es-MX-DaliaNeural";
const maxAttempts = 3;

function loadExport(filePath, typeName, exportName) {
  const source = readFileSync(filePath, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/export type [A-Za-z0-9_]+ = \{[\s\S]*?\};\r?\n/g, "")
    .replace(/export const /g, "const ")
    .replace(/const ([A-Za-z0-9_]+): [^=]+ =/g, "const $1 =");

  const sandbox = { exports: {} };
  vm.runInNewContext(`${source}\nexports.${exportName} = ${exportName};\n`, sandbox, {
    filename: filePath
  });
  return sandbox.exports[exportName];
}

async function synthesize(text, absolutePath) {
  const textCachePath = `${absolutePath}.txt`;
  const cachedText = existsSync(textCachePath) ? readFileSync(textCachePath, "utf8") : null;

  if (existsSync(absolutePath) && statSync(absolutePath).size > 1024 && cachedText === text) {
    console.log(`${path.relative(repoRoot, absolutePath)} (skip, exists)`);
    return;
  }

  let lastError = null;
  const tempDir = path.join(path.dirname(absolutePath), `.tmp-${path.basename(absolutePath, ".mp3")}`);
  mkdirSync(path.dirname(absolutePath), { recursive: true });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tts = new MsEdgeTTS();

    try {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }

      mkdirSync(tempDir, { recursive: true });
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const { audioFilePath, metadataFilePath } = await tts.toFile(tempDir, text);

      if (!existsSync(audioFilePath)) {
        throw new Error(`Temporary audio file missing for ${absolutePath}`);
      }

      if (existsSync(absolutePath)) {
        rmSync(absolutePath, { force: true });
      }

      renameSync(audioFilePath, absolutePath);

      if (metadataFilePath && existsSync(metadataFilePath)) {
        rmSync(metadataFilePath, { force: true });
      }

      if (statSync(absolutePath).size <= 1024) {
        throw new Error(`Generated audio is too small for ${absolutePath}`);
      }

      writeFileSync(textCachePath, text, "utf8");
      console.log(`${path.relative(repoRoot, absolutePath)} ok`);
      return;
    } catch (error) {
      lastError = error;

      if (existsSync(absolutePath) && statSync(absolutePath).size <= 1024) {
        rmSync(absolutePath, { force: true });
      }

      if (attempt < maxAttempts) {
        console.log(`${path.relative(repoRoot, absolutePath)} retry ${attempt}/${maxAttempts}`);
      }
    } finally {
      tts.close();
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  throw lastError;
}

const SPANISH_ALPHABET = loadExport(alphabetPath, "AlphabetLetter", "SPANISH_ALPHABET");
const PHONICS_FOUNDATION_AUDIO_WORDS = loadExport(
  foundationsPath,
  "PhonicsAudioWord",
  "PHONICS_FOUNDATION_AUDIO_WORDS"
);
const PHONICS_STRESS_RULES = loadExport(prosodyPath, "PhonicsStressRule", "PHONICS_STRESS_RULES");
const PHONICS_SINALEFA_SENTENCES = loadExport(
  prosodyPath,
  "PhonicsSinalefaSentence",
  "PHONICS_SINALEFA_SENTENCES"
);
const PHONICS_RULE_SYLLABLES = [...new Set(
  SPANISH_ALPHABET.flatMap((letter) => (letter.rules ?? []).flatMap((rule) => rule.syllables ?? []))
)];
const PHONICS_RULE_WORDS = [...new Map(
  SPANISH_ALPHABET
    .flatMap((letter) => (letter.rules ?? []).flatMap((rule) => rule.words ?? []))
    .map((word) => [word.audioSlug, word])
).values()];
const PHONICS_STRESS_WORDS = PHONICS_STRESS_RULES.flatMap((rule) => rule.examples);

for (const letter of SPANISH_ALPHABET) {
  await synthesize(letter.name, path.join(outputRoot, "letters", `${letter.slug}.mp3`));
  await synthesize(letter.example, path.join(outputRoot, "words", `${letter.slug}.mp3`));
}

for (const word of PHONICS_FOUNDATION_AUDIO_WORDS) {
  await synthesize(word.text, path.join(outputRoot, "words", `${word.slug}.mp3`));
}

for (const syllable of PHONICS_RULE_SYLLABLES) {
  await synthesize(syllable, path.join(outputRoot, "syllables", `${syllable}.mp3`));
}

for (const word of PHONICS_RULE_WORDS) {
  await synthesize(word.text, path.join(outputRoot, "words", `${word.audioSlug}.mp3`));
}

for (const example of PHONICS_STRESS_WORDS) {
  await synthesize(example.text, path.join(outputRoot, "stress", `${example.slug}.mp3`));
}

for (const sentence of PHONICS_SINALEFA_SENTENCES) {
  await synthesize(sentence.text, path.join(outputRoot, "sinalefa", `${sentence.slug}.mp3`));
}

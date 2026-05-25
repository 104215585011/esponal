import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const alphabetPath = path.join(repoRoot, "content", "phonics", "alphabet.ts");
const outputRoot = path.join(repoRoot, "public", "audio", "phonics");
const voiceName = "es-MX-DaliaNeural";
const maxAttempts = 3;

function loadAlphabet() {
  const source = readFileSync(alphabetPath, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/export type AlphabetLetter = \{[\s\S]*?\};\r?\n/, "")
    .replace(/export const SPANISH_ALPHABET:\s*AlphabetLetter\[\]/, "exports.SPANISH_ALPHABET");

  const sandbox = { exports: {} };
  vm.runInNewContext(source, sandbox, { filename: alphabetPath });
  return sandbox.exports.SPANISH_ALPHABET;
}

async function synthesize(text, absolutePath) {
  if (existsSync(absolutePath) && statSync(absolutePath).size > 1024) {
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

const SPANISH_ALPHABET = loadAlphabet();

for (const letter of SPANISH_ALPHABET) {
  await synthesize(letter.name, path.join(outputRoot, "letters", `${letter.slug}.mp3`));
  await synthesize(letter.example, path.join(outputRoot, "words", `${letter.slug}.mp3`));
}

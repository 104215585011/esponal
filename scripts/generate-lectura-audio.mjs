import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const lecturaDir = path.join(repoRoot, "content", "lectura");
const outputRoot = path.join(repoRoot, "public", "audio", "lectura");
const voiceName = "es-MX-DaliaNeural";
const maxAttempts = 3;

function loadStory(filePath) {
  const source = readFileSync(filePath, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/^import type .*;\r?\n/m, "")
    .replace(/export const \w+:\s*LecturaStory\s*=/, "exports.story =");

  const sandbox = { exports: {} };
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox.exports.story;
}

function loadLecturaStories() {
  return readdirSync(lecturaDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .filter((fileName) => !["index.ts", "types.ts"].includes(fileName))
    .map((fileName) => loadStory(path.join(lecturaDir, fileName)))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

const lecturaStories = loadLecturaStories();

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

for (const story of lecturaStories) {
  const storyDir = path.join(outputRoot, story.slug);
  mkdirSync(storyDir, { recursive: true });

  for (let index = 0; index < story.paragraphs.length; index += 1) {
    await synthesize(story.paragraphs[index], path.join(storyDir, `p${index}.mp3`));
  }
}

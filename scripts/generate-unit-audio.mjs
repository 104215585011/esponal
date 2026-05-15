import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const curriculumDir = path.join(repoRoot, "content", "curriculum");
const audioRootDir = path.join(repoRoot, "public", "audio", "units");
const unitArg = process.argv.find((arg) => arg.startsWith("--unit="));
const selectedUnitId = unitArg ? unitArg.split("=")[1] : null;
const voiceName = "es-ES-AlvaroNeural";
const concurrencyLimit = 1;
const maxAttempts = 3;

const stableHash = (value) => createHash("sha1").update(value).digest("hex").slice(0, 8);

const slugifyText = (value) => {
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const cleaned = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!cleaned) {
    return "audio";
  }

  if (cleaned.length <= 72) {
    return cleaned;
  }

  return `${cleaned.slice(0, 60).replace(/-+$/g, "")}-${stableHash(cleaned)}`;
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));

const writeJson = (filePath, value) => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const collectAudioTargets = (unit) => {
  const targets = [];

  unit.vocabGroups.forEach((group, groupIndex) => {
    group.items.forEach((item, itemIndex) => {
      targets.push({
        text: item.es,
        setAudioSrc: (audioSrc) => {
          unit.vocabGroups[groupIndex].items[itemIndex].audioSrc = audioSrc;
        },
      });
    });
  });

  unit.phrases.forEach((section, sectionIndex) => {
    section.items.forEach((item, itemIndex) => {
      targets.push({
        text: item.es,
        setAudioSrc: (audioSrc) => {
          unit.phrases[sectionIndex].items[itemIndex].audioSrc = audioSrc;
        },
      });
    });
  });

  unit.dialogues.forEach((dialogue, dialogueIndex) => {
    dialogue.lines.forEach((line, lineIndex) => {
      targets.push({
        text: line.es,
        setAudioSrc: (audioSrc) => {
          unit.dialogues[dialogueIndex].lines[lineIndex].audioSrc = audioSrc;
        },
      });
    });
  });

  return targets;
};

const buildAudioPlan = (unitId, unit) => {
  const usedBySlug = new Map();
  const cachedByText = new Map();
  const unitDir = path.join(audioRootDir, unitId);
  const plan = [];

  collectAudioTargets(unit).forEach((target) => {
    if (cachedByText.has(target.text)) {
      cachedByText.get(target.text).setAudioSrc.push(target.setAudioSrc);
      return;
    }

    const baseSlug = slugifyText(target.text);
    const priorText = usedBySlug.get(baseSlug);
    const finalSlug = priorText && priorText !== target.text ? `${baseSlug}-${stableHash(target.text)}` : baseSlug;
    const fileName = `${finalSlug}.mp3`;
    const audioSrc = `/audio/units/${unitId}/${fileName}`;

    const entry = {
      text: target.text,
      fileName,
      audioSrc,
      absolutePath: path.join(unitDir, fileName),
      tempDir: path.join(unitDir, `.tmp-${stableHash(fileName)}`),
      setAudioSrc: [target.setAudioSrc],
    };

    usedBySlug.set(baseSlug, target.text);
    cachedByText.set(target.text, entry);
    plan.push(entry);
  });

  return plan;
};

const synthesizeAudio = async (unitId, entry) => {
  if (existsSync(entry.absolutePath) && statSync(entry.absolutePath).size > 1024) {
    entry.setAudioSrc.forEach((setter) => setter(entry.audioSrc));
    console.log(`[${unitId}] ${entry.fileName} (skip, exists)`);
    return;
  }

  let lastError = null;
  mkdirSync(path.dirname(entry.absolutePath), { recursive: true });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tts = new MsEdgeTTS();

    try {
      if (existsSync(entry.tempDir)) {
        rmSync(entry.tempDir, { recursive: true, force: true });
      }

      mkdirSync(entry.tempDir, { recursive: true });
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const { audioFilePath, metadataFilePath } = await tts.toFile(entry.tempDir, entry.text);

      if (!existsSync(audioFilePath)) {
        throw new Error(`Temporary audio file missing for ${unitId}/${entry.fileName}`);
      }

      if (existsSync(entry.absolutePath)) {
        rmSync(entry.absolutePath, { force: true });
      }

      renameSync(audioFilePath, entry.absolutePath);

      if (metadataFilePath && existsSync(metadataFilePath)) {
        rmSync(metadataFilePath, { force: true });
      }

      const stats = statSync(entry.absolutePath);

      if (stats.size <= 1024) {
        throw new Error(`Generated audio is too small for ${unitId}/${entry.fileName}`);
      }

      entry.setAudioSrc.forEach((setter) => setter(entry.audioSrc));
      console.log(`[${unitId}] ${entry.fileName} ok`);
      return;
    } catch (error) {
      lastError = error;

      if (existsSync(entry.absolutePath) && statSync(entry.absolutePath).size <= 1024) {
        rmSync(entry.absolutePath, { force: true });
      }

      if (attempt < maxAttempts) {
        console.log(`[${unitId}] ${entry.fileName} retry ${attempt}/${maxAttempts}`);
        continue;
      }
    } finally {
      tts.close();
    }
  }

  throw lastError;
};

const runWithConcurrency = async (items, limit, worker) => {
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
};

const unitIds = Array.from({ length: 9 }, (_, index) => `unidad-${index + 1}`);
const targetUnitIds = selectedUnitId ? [selectedUnitId] : unitIds;

for (const unitId of targetUnitIds) {
  const unitPath = path.join(curriculumDir, `${unitId}.json`);

  if (!existsSync(unitPath)) {
    throw new Error(`Unit file not found: ${unitId}`);
  }
}

for (const unitId of targetUnitIds) {
  const unitPath = path.join(curriculumDir, `${unitId}.json`);
  const unit = readJson(unitPath);
  const plan = buildAudioPlan(unitId, unit);

  mkdirSync(path.join(audioRootDir, unitId), { recursive: true });
  await runWithConcurrency(plan, concurrencyLimit, async (entry) => {
    await synthesizeAudio(unitId, entry);
  });
  writeJson(unitPath, unit);
}

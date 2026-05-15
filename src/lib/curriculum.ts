import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import unitsManifest from "../../content/curriculum/units-manifest.json";

export type UnitManifestEntry = {
  id: string;
  number: number;
  slug: string;
  title: string;
  titleEs: string;
  level: string;
  durationMin: number;
  recommendedVideoId: string;
  recommendedVideoTitle: string;
  coreVerbs: string[];
  communicativeGoals: string[];
};

export type UnitContent = {
  id: string;
  vocabGroups: Array<{
    title: string;
    items: Array<{
      es: string;
      zh: string;
      note?: string;
      audioSrc: string;
    }>;
  }>;
  phrases: Array<{
    category: string;
    items: Array<{
      es: string;
      zh: string;
      audioSrc: string;
    }>;
  }>;
  dialogues: Array<{
    title: string;
    scene: string;
    lines: Array<{
      speaker: string;
      speakerVariant: "a" | "b";
      es: string;
      zh: string;
      audioSrc: string;
    }>;
  }>;
  grammarCards: Array<{
    verb: string;
    titleZh: string;
    lead: string;
    tip?: string | null;
    conjugation: Array<{
      pronoun: string;
      form: string;
      example?: string | null;
    }>;
  }>;
  compareCards: Array<{
    title: string;
    body: string;
  }>;
  exercises: Array<{
    type: "fill-in" | "translate";
    title: string;
    questions: string[];
    answers: string[];
  }>;
  recommendedVideo: {
    videoId: string;
    title: string;
    description: string;
  };
};

type UnitPageData = {
  unit: UnitManifestEntry;
  content: UnitContent;
  prevUnit: UnitManifestEntry | null;
  nextUnit: UnitManifestEntry | null;
};

const manifest = unitsManifest as UnitManifestEntry[];
const curriculumDir = path.join(process.cwd(), "content", "curriculum");
const fallbackPath = path.join(curriculumDir, "unidad-1.json");

function readJsonFile<T>(filePath: string): T {
  const source = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(source) as T;
}

function readUnitContent(slug: string) {
  const targetPath = path.join(curriculumDir, `${slug}.json`);
  return readJsonFile<UnitContent>(existsSync(targetPath) ? targetPath : fallbackPath);
}

export function getAllUnits() {
  return manifest;
}

export function getUnitPageData(slug: string): UnitPageData {
  const units = getAllUnits();
  const unitIndex = units.findIndex((entry) => entry.slug === slug);
  const safeIndex = unitIndex >= 0 ? unitIndex : 0;
  const unit = units[safeIndex];

  return {
    unit,
    content: readUnitContent(unit.slug),
    prevUnit: safeIndex > 0 ? units[safeIndex - 1] : null,
    nextUnit: safeIndex < units.length - 1 ? units[safeIndex + 1] : null
  };
}

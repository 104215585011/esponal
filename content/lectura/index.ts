import type { LecturaStory } from "./types";
import { laTortugaYLaLiebre } from "./la-tortuga-y-la-liebre";
import { elLeonYElRaton } from "./el-leon-y-el-raton";
import { elFlautistaDeHamelin } from "./el-flautista-de-hamelin";
import { unDiaEnMadrid } from "./un-dia-en-madrid";
import { elCafeDeLasMananas } from "./el-cafe-de-las-mananas";

export type { LecturaLevel, LecturaStory } from "./types";

export const lecturaStories: LecturaStory[] = [
  laTortugaYLaLiebre,
  elLeonYElRaton,
  elFlautistaDeHamelin,
  unDiaEnMadrid,
  elCafeDeLasMananas
];

export function getLecturaStory(slug: string): LecturaStory | undefined {
  return lecturaStories.find((story) => story.slug === slug);
}

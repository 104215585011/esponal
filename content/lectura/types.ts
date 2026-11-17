// Timestamp: 2026-11-17 15:02
export type LecturaLevel = "A1" | "A2" | "B1";

export type LecturaStory = {
  slug: string;
  language?: "es" | "de" | "en" | "fr" | "ja";
  title: string;
  titleZh: string;
  level: LecturaLevel;
  source: string;
  durationMin: number;
  summaryZh: string;
  paragraphs: string[];
  glossary?: Array<{
    word: string;
    note: string;
  }>;
};

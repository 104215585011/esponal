export type LecturaLevel = "A1" | "A2" | "B1";

export type LecturaStory = {
  slug: string;
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

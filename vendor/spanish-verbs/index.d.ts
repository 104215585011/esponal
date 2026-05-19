export type SupportedTense =
  | "INDICATIVE_PRESENT"
  | "INDICATIVE_PRETERITE"
  | "INDICATIVE_IMPERFECT"
  | "INDICATIVE_FUTURE"
  | "CONDITIONAL_PRESENT"
  | "SUBJUNCTIVE_PRESENT"
  | "IMPERATIVE_AFFIRMATIVE";

export declare function getConjugation(
  infinitive: string,
  tense: SupportedTense,
  personIndex: number
): string;

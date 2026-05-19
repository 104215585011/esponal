import { getConjugation } from "spanish-verbs";

export type Person =
  | "yo"
  | "tu"
  | "el"
  | "nosotros"
  | "vosotros"
  | "ellos";

export type VerbConjugations = {
  presente: Record<Person, string>;
  preteritoIndefinido: Record<Person, string>;
  preteritoImperfecto: Record<Person, string>;
  futuro: Record<Person, string>;
  condicional: Record<Person, string>;
  presenteSubjuntivo: Record<Person, string>;
  imperativo?: Partial<Record<Person, string>>;
};

const PEOPLE: Person[] = ["yo", "tu", "el", "nosotros", "vosotros", "ellos"];

const TENSES = {
  presente: "INDICATIVE_PRESENT",
  preteritoIndefinido: "INDICATIVE_PRETERITE",
  preteritoImperfecto: "INDICATIVE_IMPERFECT",
  futuro: "INDICATIVE_FUTURE",
  condicional: "CONDITIONAL_PRESENT",
  presenteSubjuntivo: "SUBJUNCTIVE_PRESENT"
} as const;

function buildTense(lemma: string, tense: (typeof TENSES)[keyof typeof TENSES]) {
  return PEOPLE.reduce<Record<Person, string>>((result, person, index) => {
    result[person] = getConjugation(lemma, tense, index);
    return result;
  }, {} as Record<Person, string>);
}

function buildImperative(lemma: string) {
  return PEOPLE.reduce<Partial<Record<Person, string>>>((result, person, index) => {
    if (person === "yo") {
      return result;
    }

    const value = getConjugation(lemma, "IMPERATIVE_AFFIRMATIVE", index);
    if (value) {
      result[person] = value;
    }
    return result;
  }, {});
}

export function tryConjugateVerb(lemmaInput: string): VerbConjugations | null {
  const lemma = lemmaInput.trim().toLowerCase();
  if (!/^[a-záéíóúüñ-]+$/i.test(lemma)) {
    return null;
  }

  try {
    return {
      presente: buildTense(lemma, TENSES.presente),
      preteritoIndefinido: buildTense(lemma, TENSES.preteritoIndefinido),
      preteritoImperfecto: buildTense(lemma, TENSES.preteritoImperfecto),
      futuro: buildTense(lemma, TENSES.futuro),
      condicional: buildTense(lemma, TENSES.condicional),
      presenteSubjuntivo: buildTense(lemma, TENSES.presenteSubjuntivo),
      imperativo: buildImperative(lemma)
    };
  } catch {
    return null;
  }
}

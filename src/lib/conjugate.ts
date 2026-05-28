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
  participio: string;
  gerundio: string;
  preteritoPerfectoCompuesto: Record<Person, string>;
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

const HABER_PRESENTE: Record<Person, string> = {
  yo: "he",
  tu: "has",
  el: "ha",
  nosotros: "hemos",
  vosotros: "habéis",
  ellos: "han"
};

const IRREGULAR_PARTICIPLES: Record<string, string> = {
  abrir: "abierto",
  cubrir: "cubierto",
  decir: "dicho",
  escribir: "escrito",
  hacer: "hecho",
  morir: "muerto",
  poner: "puesto",
  resolver: "resuelto",
  romper: "roto",
  ver: "visto",
  volver: "vuelto"
};

const IRREGULAR_GERUNDS: Record<string, string> = {
  decir: "diciendo",
  dormir: "durmiendo",
  ir: "yendo",
  morir: "muriendo",
  oir: "oyendo",
  oír: "oyendo",
  pedir: "pidiendo",
  poder: "pudiendo",
  reir: "riendo",
  reír: "riendo",
  seguir: "siguiendo",
  sentir: "sintiendo",
  servir: "sirviendo",
  traer: "trayendo",
  venir: "viniendo"
};

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

function buildParticipio(lemma: string) {
  if (IRREGULAR_PARTICIPLES[lemma]) {
    return IRREGULAR_PARTICIPLES[lemma];
  }

  if (lemma.endsWith("ar")) {
    return `${lemma.slice(0, -2)}ado`;
  }

  if (lemma.endsWith("er") || lemma.endsWith("ir")) {
    return `${lemma.slice(0, -2)}ido`;
  }

  throw new Error("unsupported infinitive");
}

function buildGerundio(lemma: string) {
  if (IRREGULAR_GERUNDS[lemma]) {
    return IRREGULAR_GERUNDS[lemma];
  }

  if (lemma.endsWith("ar")) {
    return `${lemma.slice(0, -2)}ando`;
  }

  if (lemma.endsWith("er") || lemma.endsWith("ir")) {
    return `${lemma.slice(0, -2)}iendo`;
  }

  throw new Error("unsupported infinitive");
}

function buildPreteritoPerfectoCompuesto(participio: string) {
  return PEOPLE.reduce<Record<Person, string>>((result, person) => {
    result[person] = `${HABER_PRESENTE[person]} ${participio}`;
    return result;
  }, {} as Record<Person, string>);
}

export function tryConjugateVerb(lemmaInput: string): VerbConjugations | null {
  const lemma = lemmaInput.trim().toLowerCase();
  if (!/^[a-záéíóúüñ-]+$/i.test(lemma)) {
    return null;
  }

  try {
    const participio = buildParticipio(lemma);
    return {
      presente: buildTense(lemma, TENSES.presente),
      preteritoIndefinido: buildTense(lemma, TENSES.preteritoIndefinido),
      preteritoImperfecto: buildTense(lemma, TENSES.preteritoImperfecto),
      futuro: buildTense(lemma, TENSES.futuro),
      condicional: buildTense(lemma, TENSES.condicional),
      presenteSubjuntivo: buildTense(lemma, TENSES.presenteSubjuntivo),
      imperativo: buildImperative(lemma),
      participio,
      gerundio: buildGerundio(lemma),
      preteritoPerfectoCompuesto: buildPreteritoPerfectoCompuesto(participio)
    };
  } catch {
    return null;
  }
}

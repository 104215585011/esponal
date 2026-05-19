const PERSON_COUNT = 6;

const REGULAR_ENDINGS = {
  INDICATIVE_PRESENT: {
    ar: ["o", "as", "a", "amos", "áis", "an"],
    er: ["o", "es", "e", "emos", "éis", "en"],
    ir: ["o", "es", "e", "imos", "ís", "en"]
  },
  INDICATIVE_PRETERITE: {
    ar: ["é", "aste", "ó", "amos", "asteis", "aron"],
    er: ["í", "iste", "ió", "imos", "isteis", "ieron"],
    ir: ["í", "iste", "ió", "imos", "isteis", "ieron"]
  },
  INDICATIVE_IMPERFECT: {
    ar: ["aba", "abas", "aba", "ábamos", "abais", "aban"],
    er: ["ía", "ías", "ía", "íamos", "íais", "ían"],
    ir: ["ía", "ías", "ía", "íamos", "íais", "ían"]
  },
  INDICATIVE_FUTURE: {
    ar: ["é", "ás", "á", "emos", "éis", "án"],
    er: ["é", "ás", "á", "emos", "éis", "án"],
    ir: ["é", "ás", "á", "emos", "éis", "án"]
  },
  CONDITIONAL_PRESENT: {
    ar: ["ía", "ías", "ía", "íamos", "íais", "ían"],
    er: ["ía", "ías", "ía", "íamos", "íais", "ían"],
    ir: ["ía", "ías", "ía", "íamos", "íais", "ían"]
  },
  SUBJUNCTIVE_PRESENT: {
    ar: ["e", "es", "e", "emos", "éis", "en"],
    er: ["a", "as", "a", "amos", "áis", "an"],
    ir: ["a", "as", "a", "amos", "áis", "an"]
  }
};

const IRREGULARS = {
  ser: {
    INDICATIVE_PRESENT: ["soy", "eres", "es", "somos", "sois", "son"],
    INDICATIVE_PRETERITE: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    INDICATIVE_IMPERFECT: ["era", "eras", "era", "éramos", "erais", "eran"],
    INDICATIVE_FUTURE: ["seré", "serás", "será", "seremos", "seréis", "serán"],
    CONDITIONAL_PRESENT: ["sería", "serías", "sería", "seríamos", "seríais", "serían"],
    SUBJUNCTIVE_PRESENT: ["sea", "seas", "sea", "seamos", "seais", "sean"],
    IMPERATIVE_AFFIRMATIVE: [null, "se", "sea", "seamos", "sed", "sean"]
  },
  ir: {
    INDICATIVE_PRESENT: ["voy", "vas", "va", "vamos", "vais", "van"],
    INDICATIVE_PRETERITE: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    INDICATIVE_IMPERFECT: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"],
    INDICATIVE_FUTURE: ["iré", "irás", "irá", "iremos", "iréis", "irán"],
    CONDITIONAL_PRESENT: ["iría", "irías", "iría", "iríamos", "iríais", "irían"],
    SUBJUNCTIVE_PRESENT: ["vaya", "vayas", "vaya", "vayamos", "vayáis", "vayan"],
    IMPERATIVE_AFFIRMATIVE: [null, "ve", "vaya", "vayamos", "id", "vayan"]
  }
};

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function assertInputs(infinitive, tense, personIndex) {
  if (typeof infinitive !== "string" || infinitive.length < 2) {
    throw new Error("invalid infinitive");
  }
  if (!Number.isInteger(personIndex) || personIndex < 0 || personIndex >= PERSON_COUNT) {
    throw new Error("invalid person index");
  }
  if (
    tense !== "INDICATIVE_PRESENT" &&
    tense !== "INDICATIVE_PRETERITE" &&
    tense !== "INDICATIVE_IMPERFECT" &&
    tense !== "INDICATIVE_FUTURE" &&
    tense !== "CONDITIONAL_PRESENT" &&
    tense !== "SUBJUNCTIVE_PRESENT" &&
    tense !== "IMPERATIVE_AFFIRMATIVE"
  ) {
    throw new Error("unsupported tense");
  }
}

function getVerbClass(infinitive) {
  const ending = infinitive.slice(-2);
  if (ending !== "ar" && ending !== "er" && ending !== "ir") {
    throw new Error("unsupported verb");
  }
  return ending;
}

function getStem(infinitive) {
  return infinitive.slice(0, -2);
}

function getYoForm(infinitive) {
  const irregular = IRREGULARS[infinitive]?.INDICATIVE_PRESENT?.[0];
  if (irregular) {
    return irregular;
  }

  const verbClass = getVerbClass(infinitive);
  return `${getStem(infinitive)}${REGULAR_ENDINGS.INDICATIVE_PRESENT[verbClass][0]}`;
}

function getImperativeAffirmative(infinitive, personIndex) {
  const irregular = IRREGULARS[infinitive]?.IMPERATIVE_AFFIRMATIVE?.[personIndex];
  if (irregular) {
    return irregular;
  }
  if (personIndex === 0) {
    throw new Error("imperative has no yo form");
  }

  const verbClass = getVerbClass(infinitive);
  const stem = getStem(infinitive);
  if (personIndex === 1) {
    return `${stem}${REGULAR_ENDINGS.INDICATIVE_PRESENT[verbClass][2]}`;
  }
  if (personIndex === 2 || personIndex === 3 || personIndex === 5) {
    return `${stem}${REGULAR_ENDINGS.SUBJUNCTIVE_PRESENT[verbClass][personIndex]}`;
  }
  return `${stem}${infinitive.endsWith("r") ? "d" : ""}`;
}

export function getConjugation(infinitive, tense, personIndex) {
  assertInputs(infinitive, tense, personIndex);

  const normalizedInfinitive = normalize(infinitive.toLowerCase());
  const irregular = IRREGULARS[normalizedInfinitive]?.[tense]?.[personIndex];
  if (irregular) {
    return irregular;
  }

  if (tense === "IMPERATIVE_AFFIRMATIVE") {
    return getImperativeAffirmative(normalizedInfinitive, personIndex);
  }

  const verbClass = getVerbClass(normalizedInfinitive);
  const endings = REGULAR_ENDINGS[tense]?.[verbClass];
  if (!endings) {
    throw new Error("unsupported tense");
  }

  if (tense === "INDICATIVE_FUTURE" || tense === "CONDITIONAL_PRESENT") {
    return `${normalizedInfinitive}${endings[personIndex]}`;
  }

  if (tense === "SUBJUNCTIVE_PRESENT") {
    const yoForm = getYoForm(normalizedInfinitive);
    return `${yoForm.slice(0, -1)}${endings[personIndex]}`;
  }

  return `${getStem(normalizedInfinitive)}${endings[personIndex]}`;
}

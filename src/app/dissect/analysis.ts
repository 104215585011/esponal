import { lookupDictionary } from "@/lib/dictionary";
import { lookupFunctionWord, normalizeSpanishToken } from "@/lib/functionWords";

export type DissectAnalysisToken = {
  form: string;
  english: string;
  isPunctuation: boolean;
};

export type ImpliedSubjectType = "prodrop" | "impersonal" | "existential" | "se_impersonal";

export type DissectImpliedSubject = {
  pronoun: string;
  english: string;
  insertBeforeIndex: number;
  type: ImpliedSubjectType;
};

export type DissectAnalysisResult = {
  tokens: DissectAnalysisToken[];
  impliedSubject: DissectImpliedSubject | null;
  inversionNote?: "gustar";
  naturalEnglish: string;
};

type SubjectGuess = {
  pronoun: string;
  english: string;
  type: ImpliedSubjectType;
};

const IRREGULAR_SUBJECTS = new Map<string, SubjectGuess>([
  ["soy", { pronoun: "yo", english: "I", type: "prodrop" }],
  ["eres", { pronoun: "tú", english: "you", type: "prodrop" }],
  ["es", { pronoun: "él/ella", english: "he/she", type: "prodrop" }],
  ["somos", { pronoun: "nosotros", english: "we", type: "prodrop" }],
  ["son", { pronoun: "ellos", english: "they", type: "prodrop" }],
  ["estoy", { pronoun: "yo", english: "I", type: "prodrop" }],
  ["estas", { pronoun: "tú", english: "you", type: "prodrop" }],
  ["está", { pronoun: "él/ella", english: "he/she", type: "prodrop" }],
  ["estamos", { pronoun: "nosotros", english: "we", type: "prodrop" }],
  ["están", { pronoun: "ellos", english: "they", type: "prodrop" }],
  ["voy", { pronoun: "yo", english: "I", type: "prodrop" }],
  ["vas", { pronoun: "tú", english: "you", type: "prodrop" }],
  ["va", { pronoun: "él/ella", english: "he/she", type: "prodrop" }],
  ["vamos", { pronoun: "nosotros", english: "we", type: "prodrop" }],
  ["van", { pronoun: "ellos", english: "they", type: "prodrop" }],
  ["tengo", { pronoun: "yo", english: "I", type: "prodrop" }],
  ["tienes", { pronoun: "tú", english: "you", type: "prodrop" }],
  ["tiene", { pronoun: "él/ella", english: "he/she", type: "prodrop" }],
  ["tenemos", { pronoun: "nosotros", english: "we", type: "prodrop" }],
  ["tienen", { pronoun: "ellos", english: "they", type: "prodrop" }],
  ["puedo", { pronoun: "yo", english: "I", type: "prodrop" }],
  ["puedes", { pronoun: "tú", english: "you", type: "prodrop" }],
  ["puede", { pronoun: "él/ella", english: "he/she", type: "prodrop" }],
  ["podemos", { pronoun: "nosotros", english: "we", type: "prodrop" }],
  ["pueden", { pronoun: "ellos", english: "they", type: "prodrop" }]
]);

const EXPLICIT_SUBJECTS = new Set([
  "yo",
  "tú",
  "tu",
  "él",
  "el",
  "ella",
  "usted",
  "nosotros",
  "nosotras",
  "vosotros",
  "vosotras",
  "ellos",
  "ellas",
  "ustedes"
]);

const INDIRECT_OBJECT_PRONOUNS = new Set(["me", "te", "le", "nos", "os", "les"]);
const GUSTAR_LIKE_VERBS = new Set(["gusta", "gustan", "duele", "duelen", "parece", "parecen"]);
const WEATHER_VERBS = new Set(["hace", "llueve", "nieva"]);
const IMPERSONAL_CLAUSE_VERBS = new Set(["es", "parece", "resulta"]);

export function splitSentenceForAnalysis(sentence: string) {
  return sentence.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?|[0-9]+|[^\s]/g) ?? [];
}

function isPunctuationToken(token: string) {
  return normalizeSpanishToken(token).length === 0;
}

function hasExplicitSubject(tokens: string[]) {
  return tokens.some((token) => EXPLICIT_SUBJECTS.has(normalizeSpanishToken(token)));
}

function inferSubjectFromVerb(form: string): SubjectGuess | null {
  const normalized = normalizeSpanishToken(form);
  if (!normalized) return null;

  const irregular = IRREGULAR_SUBJECTS.get(normalized);
  if (irregular) return irregular;

  if (normalized.endsWith("amos") || normalized.endsWith("emos") || normalized.endsWith("imos")) {
    return { pronoun: "nosotros", english: "we", type: "prodrop" };
  }
  if (normalized.endsWith("áis") || normalized.endsWith("éis") || normalized.endsWith("ís")) {
    return { pronoun: "vosotros", english: "you all", type: "prodrop" };
  }
  if (normalized.endsWith("aron") || normalized.endsWith("ieron")) {
    return { pronoun: "ellos", english: "they", type: "prodrop" };
  }
  if (normalized.endsWith("an") || normalized.endsWith("en")) {
    return { pronoun: "ellos", english: "they", type: "prodrop" };
  }
  if (normalized.endsWith("as") || normalized.endsWith("es")) {
    return { pronoun: "tú", english: "you", type: "prodrop" };
  }
  if (normalized.endsWith("o")) {
    return { pronoun: "yo", english: "I", type: "prodrop" };
  }
  if (normalized.endsWith("a") || normalized.endsWith("e")) {
    return { pronoun: "él/ella", english: "he/she", type: "prodrop" };
  }

  return null;
}

async function glossToken(form: string) {
  const functionWord = lookupFunctionWord(form);
  if (functionWord) {
    return functionWord.entry.english;
  }

  const dictionaryEntry = await lookupDictionary(form);
  if (dictionaryEntry?.meanings[0]) {
    return dictionaryEntry.meanings[0];
  }
  if (dictionaryEntry?.lemma) {
    return dictionaryEntry.lemma;
  }

  return normalizeSpanishToken(form);
}

function buildFallbackNaturalEnglish(
  tokens: DissectAnalysisToken[],
  impliedSubject: DissectImpliedSubject | null
) {
  const pieces: string[] = [];

  tokens.forEach((token, index) => {
    if (impliedSubject && impliedSubject.insertBeforeIndex === index) {
      pieces.push(impliedSubject.english);
    }

    if (token.isPunctuation) {
      const previous = pieces.pop();
      pieces.push(`${previous ?? ""}${token.form}`);
      return;
    }

    pieces.push(token.english || token.form.toLowerCase());
  });

  const text = pieces.join(" ").replace(/\s+([?!,.;:])/g, "$1").trim();
  if (!text) return "";
  return text[0].toUpperCase() + text.slice(1);
}

function firstNonPunctuationIndex(tokens: DissectAnalysisToken[]) {
  return tokens.findIndex((token) => !token.isPunctuation);
}

function detectGustarInversion(tokens: DissectAnalysisToken[]) {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const current = normalizeSpanishToken(tokens[index]?.form ?? "");
    const next = normalizeSpanishToken(tokens[index + 1]?.form ?? "");
    if (INDIRECT_OBJECT_PRONOUNS.has(current) && GUSTAR_LIKE_VERBS.has(next)) {
      return "gustar" as const;
    }
  }
  return undefined;
}

function detectImpliedSubject(tokens: DissectAnalysisToken[]): DissectImpliedSubject | null {
  const firstWordIndex = firstNonPunctuationIndex(tokens);
  if (firstWordIndex < 0) {
    return null;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.isPunctuation) continue;

    const normalized = normalizeSpanishToken(token.form);

    if (normalized === "hay") {
      return {
        pronoun: "there",
        english: "there",
        insertBeforeIndex: index,
        type: "existential"
      };
    }

    if (normalized === "se") {
      const verbIndex = tokens.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex > index &&
          !candidate.isPunctuation &&
          inferSubjectFromVerb(candidate.form)?.type === "prodrop"
      );
      if (verbIndex >= 0) {
        return {
          pronoun: "se",
          english: "one",
          insertBeforeIndex: verbIndex,
          type: "se_impersonal"
        };
      }
    }

    if (WEATHER_VERBS.has(normalized)) {
      return {
        pronoun: "ello",
        english: "it",
        insertBeforeIndex: index,
        type: "impersonal"
      };
    }
  }

  const firstWord = normalizeSpanishToken(tokens[firstWordIndex].form);
  if (IMPERSONAL_CLAUSE_VERBS.has(firstWord)) {
    return {
      pronoun: "ello",
      english: "it",
      insertBeforeIndex: firstWordIndex,
      type: "impersonal"
    };
  }

  const prodropIndex = tokens.findIndex(
    (token) => !token.isPunctuation && inferSubjectFromVerb(token.form)?.type === "prodrop"
  );
  if (prodropIndex < 0) {
    return null;
  }

  const subject = inferSubjectFromVerb(tokens[prodropIndex].form);
  if (!subject) {
    return null;
  }

  return {
    pronoun: subject.pronoun,
    english: subject.english,
    insertBeforeIndex: prodropIndex,
    type: subject.type
  };
}

export async function buildFallbackDissectionAnalysis(
  sentence: string
): Promise<DissectAnalysisResult> {
  const parts = splitSentenceForAnalysis(sentence);
  const tokens = await Promise.all(
    parts.map(async (part) => ({
      form: part,
      english: isPunctuationToken(part) ? "" : await glossToken(part),
      isPunctuation: isPunctuationToken(part)
    }))
  );

  const inversionNote = detectGustarInversion(tokens);
  const impliedSubject =
    inversionNote || hasExplicitSubject(parts) ? null : detectImpliedSubject(tokens);

  return {
    tokens,
    impliedSubject,
    inversionNote,
    naturalEnglish: buildFallbackNaturalEnglish(tokens, impliedSubject)
  };
}

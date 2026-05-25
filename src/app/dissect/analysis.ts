import { lookupDictionary } from "@/lib/dictionary";
import { lookupFunctionWord, normalizeSpanishToken } from "@/lib/functionWords";

export type DissectAnalysisToken = {
  form: string;
  english: string;
  isPunctuation: boolean;
};

export type DissectImpliedSubject = {
  pronoun: string;
  english: string;
  insertBeforeIndex: number;
};

export type DissectAnalysisResult = {
  tokens: DissectAnalysisToken[];
  impliedSubject: DissectImpliedSubject | null;
  naturalEnglish: string;
};

type SubjectGuess = {
  pronoun: string;
  english: string;
};

const IRREGULAR_SUBJECTS = new Map<string, SubjectGuess>([
  ["soy", { pronoun: "yo", english: "I" }],
  ["eres", { pronoun: "tú", english: "you" }],
  ["es", { pronoun: "él/ella", english: "he/she" }],
  ["somos", { pronoun: "nosotros", english: "we" }],
  ["son", { pronoun: "ellos", english: "they" }],
  ["estoy", { pronoun: "yo", english: "I" }],
  ["estas", { pronoun: "tú", english: "you" }],
  ["está", { pronoun: "él/ella", english: "he/she" }],
  ["estamos", { pronoun: "nosotros", english: "we" }],
  ["están", { pronoun: "ellos", english: "they" }],
  ["voy", { pronoun: "yo", english: "I" }],
  ["vas", { pronoun: "tú", english: "you" }],
  ["va", { pronoun: "él/ella", english: "he/she" }],
  ["vamos", { pronoun: "nosotros", english: "we" }],
  ["van", { pronoun: "ellos", english: "they" }],
  ["tengo", { pronoun: "yo", english: "I" }],
  ["tienes", { pronoun: "tú", english: "you" }],
  ["tiene", { pronoun: "él/ella", english: "he/she" }],
  ["tenemos", { pronoun: "nosotros", english: "we" }],
  ["tienen", { pronoun: "ellos", english: "they" }],
  ["puedo", { pronoun: "yo", english: "I" }],
  ["puedes", { pronoun: "tú", english: "you" }],
  ["puede", { pronoun: "él/ella", english: "he/she" }],
  ["podemos", { pronoun: "nosotros", english: "we" }],
  ["pueden", { pronoun: "ellos", english: "they" }]
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
    return { pronoun: "nosotros", english: "we" };
  }
  if (normalized.endsWith("áis") || normalized.endsWith("éis") || normalized.endsWith("ís")) {
    return { pronoun: "vosotros", english: "you all" };
  }
  if (normalized.endsWith("aron") || normalized.endsWith("ieron")) {
    return { pronoun: "ellos", english: "they" };
  }
  if (normalized.endsWith("an") || normalized.endsWith("en")) {
    return { pronoun: "ellos", english: "they" };
  }
  if (normalized.endsWith("as") || normalized.endsWith("es")) {
    return { pronoun: "tú", english: "you" };
  }
  if (normalized.endsWith("o")) {
    return { pronoun: "yo", english: "I" };
  }
  if (normalized.endsWith("a") || normalized.endsWith("e")) {
    return { pronoun: "él/ella", english: "he/she" };
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

  const impliedSubject = hasExplicitSubject(parts)
    ? null
    : (() => {
        const verbIndex = tokens.findIndex(
          (token) => !token.isPunctuation && inferSubjectFromVerb(token.form)
        );
        if (verbIndex < 0) return null;

        const subject = inferSubjectFromVerb(tokens[verbIndex].form);
        if (!subject) return null;

        return {
          pronoun: subject.pronoun,
          english: subject.english,
          insertBeforeIndex: verbIndex
        };
      })();

  return {
    tokens,
    impliedSubject,
    naturalEnglish: buildFallbackNaturalEnglish(tokens, impliedSubject)
  };
}

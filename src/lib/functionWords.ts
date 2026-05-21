import dictionary from "../../data/function-words.json";

export type FunctionWordCategory =
  | "subject_pronoun"
  | "reflexive"
  | "object_pronoun"
  | "article_definite"
  | "article_indefinite"
  | "preposition"
  | "conjunction"
  | "demonstrative"
  | "possessive"
  | "relative_interrogative"
  | "indefinite_pronoun"
  | "quantifier"
  | "adverb_function";

export type FunctionWordExample = {
  es: string;
  en: string;
  zh: string;
};

export type FunctionWordEntry = {
  category: FunctionWordCategory;
  english: string;
  chinese: string[];
  examples: FunctionWordExample[];
  esEnContrast: string;
  frequencyRank: number;
};

export type AggregationStyle = {
  badge: string;
  borderClass: string;
  textClass: string;
  hoverClass: string;
  categoryLabel: string;
  foundationDay: number;
};

const CATEGORY_LABELS: Record<FunctionWordCategory, string> = {
  subject_pronoun: "主语代词",
  reflexive: "反身代词",
  object_pronoun: "宾语代词",
  article_definite: "定冠词",
  article_indefinite: "不定冠词",
  preposition: "介词",
  conjunction: "连词",
  demonstrative: "指示词",
  possessive: "所有词",
  relative_interrogative: "关系/疑问词",
  indefinite_pronoun: "不定代词",
  quantifier: "数量词",
  adverb_function: "副词性功能词"
};

const FOUNDATION_DAY_BY_CATEGORY: Record<FunctionWordCategory, number> = {
  subject_pronoun: 1,
  indefinite_pronoun: 1,
  article_definite: 2,
  article_indefinite: 2,
  quantifier: 2,
  reflexive: 3,
  object_pronoun: 3,
  preposition: 4,
  adverb_function: 4,
  demonstrative: 5,
  possessive: 5,
  conjunction: 6,
  relative_interrogative: 7
};

const AGGREGATION_BY_CATEGORY: Record<
  FunctionWordCategory,
  Pick<AggregationStyle, "badge" | "borderClass" | "textClass" | "hoverClass">
> = {
  subject_pronoun: {
    badge: "代",
    borderClass: "border-blue-400",
    textClass: "text-blue-600",
    hoverClass: "hover:bg-blue-50"
  },
  reflexive: {
    badge: "代",
    borderClass: "border-blue-400",
    textClass: "text-blue-600",
    hoverClass: "hover:bg-blue-50"
  },
  indefinite_pronoun: {
    badge: "代",
    borderClass: "border-blue-400",
    textClass: "text-blue-600",
    hoverClass: "hover:bg-blue-50"
  },
  object_pronoun: {
    badge: "宾",
    borderClass: "border-indigo-400",
    textClass: "text-indigo-700",
    hoverClass: "hover:bg-indigo-50"
  },
  article_definite: {
    badge: "限",
    borderClass: "border-amber-400",
    textClass: "text-amber-600",
    hoverClass: "hover:bg-amber-50"
  },
  article_indefinite: {
    badge: "限",
    borderClass: "border-amber-400",
    textClass: "text-amber-600",
    hoverClass: "hover:bg-amber-50"
  },
  demonstrative: {
    badge: "限",
    borderClass: "border-amber-400",
    textClass: "text-amber-600",
    hoverClass: "hover:bg-amber-50"
  },
  possessive: {
    badge: "限",
    borderClass: "border-amber-400",
    textClass: "text-amber-600",
    hoverClass: "hover:bg-amber-50"
  },
  quantifier: {
    badge: "限",
    borderClass: "border-amber-400",
    textClass: "text-amber-600",
    hoverClass: "hover:bg-amber-50"
  },
  preposition: {
    badge: "介",
    borderClass: "border-emerald-400",
    textClass: "text-emerald-600",
    hoverClass: "hover:bg-emerald-50"
  },
  conjunction: {
    badge: "连",
    borderClass: "border-emerald-400",
    textClass: "text-emerald-600",
    hoverClass: "hover:bg-emerald-50"
  },
  relative_interrogative: {
    badge: "疑",
    borderClass: "border-violet-400",
    textClass: "text-violet-600",
    hoverClass: "hover:bg-violet-50"
  },
  adverb_function: {
    badge: "副",
    borderClass: "border-slate-400",
    textClass: "text-slate-600",
    hoverClass: "hover:bg-slate-50"
  }
};

const lookupMap = new Map<string, { lemma: string; entry: FunctionWordEntry }>(
  Object.entries(dictionary.entries).map(([lemma, entry]) => [
    lemma.toLowerCase(),
    { lemma, entry: entry as FunctionWordEntry }
  ])
);

export const DEFAULT_DISSECT_SENTENCE =
  "Yo me lavo las manos con agua fría todos los días.";

export function normalizeSpanishToken(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^a-záéíóúñü]+|[^a-záéíóúñü]+$/gi, "")
    .trim();
}

export function lookupFunctionWord(token: string) {
  const normalized = normalizeSpanishToken(token);
  if (!normalized) {
    return null;
  }

  return lookupMap.get(normalized) ?? null;
}

export function getAggregationStyle(category: FunctionWordCategory): AggregationStyle {
  const aggregation = AGGREGATION_BY_CATEGORY[category];

  return {
    ...aggregation,
    categoryLabel: CATEGORY_LABELS[category],
    foundationDay: FOUNDATION_DAY_BY_CATEGORY[category]
  };
}

export function getFoundationDayHref(day: number) {
  return `/learn/foundation/day-${day}`;
}

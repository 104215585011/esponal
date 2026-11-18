// Timestamp: 2026-11-18 16:30
// 纯函数模块（无 @/ 别名依赖，支持 Vitest / node --test 直接导入）：
// 将 SLA / 高频词 / 语块 / 原句挖空 / 同源词规律 / 名词冠词强化落到可计算规则。

export type CognateHint = {
  isCognate: boolean;
  isFalseFriend?: boolean;
  englishWord: string;
  patternLabel: string;
  tipZh: string;
};

export type NounArticleCue = {
  article: string;
  pluralArticle: string;
  singularWithArticle: string;
  pluralWithArticle: string | null;
  maskedWithArticle: string;
  gender: "m" | "f" | "mf" | "n";
  genderLabel: string;
};

export type ContextCloze = {
  maskedSentence: string;
  answerForm: string;
  fullSentence: string;
  translatedSentence: string;
  matchedFromEncounter: boolean;
};

const FALSE_FRIENDS: Record<
  string,
  { trap: string; warningZh: string }
> = {
  embarazada: {
    trap: "embarrassed",
    warningZh: "假朋友：不是英文 embarrassed（尴尬），而是“怀孕的”"
  },
  embarazado: {
    trap: "embarrassed",
    warningZh: "假朋友：注意不是英文 embarrassed"
  },
  exito: {
    trap: "exit",
    warningZh: "假朋友：不是 exit（出口），而是“成功”（出口是 salida）"
  },
  soportar: {
    trap: "support",
    warningZh: "假朋友：通常指“忍受/承受”，表“支持”多用 apoyar"
  },
  actual: {
    trap: "actual",
    warningZh: "假朋友：指“当前的/现行的”，不是“实际的”（实际是 real）"
  },
  actualmente: {
    trap: "actually",
    warningZh: "假朋友：意为“目前/眼下”，不是“事实上”（事实上是 en realidad）"
  },
  carpeta: {
    trap: "carpet",
    warningZh: "假朋友：意为“文件夹”，不是“地毯”（地毯是 alfombra）"
  },
  ropa: {
    trap: "rope",
    warningZh: "假朋友：意为“衣服”，不是“绳子”（绳子是 cuerda）"
  },
  largo: {
    trap: "large",
    warningZh: "假朋友：意为“长的”，表“大的”用 grande"
  },
  sensible: {
    trap: "sensible",
    warningZh: "假朋友：多指“敏感的”，表“明智的”用 sensato"
  },
  realizar: {
    trap: "realize",
    warningZh: "注意词义：常指“实现/完成/做”，表“意识到”用 darse cuenta de"
  },
  asistir: {
    trap: "assist",
    warningZh: "假朋友：作“出席/参加（asistir a）”讲，帮助是 ayudar"
  },
  recordar: {
    trap: "record",
    warningZh: "假朋友：意为“记得/想起”，录音/记录是 grabar"
  },
  libreria: {
    trap: "library",
    warningZh: "假朋友：意为“书店”，图书馆是 biblioteca"
  },
  constipado: {
    trap: "constipated",
    warningZh: "假朋友：在西语里常指“感冒/鼻塞”，不是便秘"
  }
};

const EXACT_COGNATES: Record<string, { en: string; tip?: string }> = {
  hotel: { en: "hotel" },
  doctor: { en: "doctor" },
  problema: { en: "problem", tip: "注意：虽然以 -a 结尾，却是阳性 el problema" },
  programa: { en: "program", tip: "注意：以 -a 结尾但为阳性 el programa" },
  sistema: { en: "system", tip: "注意：以 -a 结尾但为阳性 el sistema" },
  tema: { en: "theme / topic", tip: "注意：阳性 el tema" },
  familia: { en: "family" },
  momento: { en: "moment" },
  minuto: { en: "minute" },
  persona: { en: "person" },
  favorito: { en: "favorite" },
  perfecto: { en: "perfect" },
  color: { en: "color" },
  error: { en: "error" },
  actor: { en: "actor" },
  autor: { en: "author" },
  telefono: { en: "telephone" },
  musica: { en: "music" },
  idea: { en: "idea" },
  restaurant: { en: "restaurant" },
  restaurante: { en: "restaurant" },
  chocolate: { en: "chocolate" },
  hospital: { en: "hospital" },
  animal: { en: "animal" },
  natural: { en: "natural" },
  personal: { en: "personal" },
  general: { en: "general" },
  normal: { en: "normal" },
  final: { en: "final" },
  local: { en: "local" },
  social: { en: "social" },
  total: { en: "total" },
  cultural: { en: "cultural" },
  central: { en: "central" },
  capital: { en: "capital" },
  legal: { en: "legal" },
  mental: { en: "mental" },
  vital: { en: "vital" },
  vocabulario: { en: "vocabulary" }
};

function foldAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function unaccentSpanishPrefix(stem: string): string {
  return foldAccents(stem);
}

/**
 * 识别常见英西同源词与经典假朋友（纯规则，零 API 消耗）。
 */
export function detectSpanishCognateHint(
  rawLemma: string,
  meanings: string[] = []
): CognateHint | null {
  const clean = rawLemma.trim().toLowerCase();
  if (!clean || clean.includes(" ")) return null;
  const ascii = foldAccents(clean);

  if (FALSE_FRIENDS[ascii]) {
    const ff = FALSE_FRIENDS[ascii];
    return {
      isCognate: false,
      isFalseFriend: true,
      englishWord: ff.trap,
      patternLabel: "假朋友提醒",
      tipZh: ff.warningZh
    };
  }

  if (EXACT_COGNATES[ascii]) {
    const item = EXACT_COGNATES[ascii];
    return {
      isCognate: true,
      englishWord: item.en,
      patternLabel: "英西同源词",
      tipZh:
        item.tip ??
        `英西同源对照：英文 ${item.en}，看懂意思可直接标「已掌握」省出复习配额`
    };
  }

  // -ción / -sión ↔ -tion / -sion
  if (/cion$/.test(ascii) && ascii.length >= 6) {
    const en = `${ascii.slice(0, -4)}tion`;
    return {
      isCognate: true,
      englishWord: en,
      patternLabel: "后缀 -ción ↔ -tion",
      tipZh: `同源规律：-ción 对应英文 -tion（近似 ${en}），多为阴性名词 la ...`
    };
  }
  if (/sion$/.test(ascii) && ascii.length >= 6) {
    const en = `${ascii.slice(0, -4)}sion`;
    return {
      isCognate: true,
      englishWord: en,
      patternLabel: "后缀 -sión ↔ -sion",
      tipZh: `同源规律：-sión 对应英文 -sion（近似 ${en}），多为阴性名词 la ...`
    };
  }

  // -dad / -tad ↔ -ty (universidad -> university)
  if (/idad$/.test(ascii) && ascii.length >= 7) {
    const en = `${ascii.slice(0, -4)}ity`;
    return {
      isCognate: true,
      englishWord: en,
      patternLabel: "后缀 -dad ↔ -ty",
      tipZh: `同源规律：-idad 常对应英文 -ity（如 ${en}），皆为阴性名词 la ...`
    };
  }
  if (ascii === "ciudad" || ascii === "libertad" || ascii === "dificultad") {
    const map: Record<string, string> = {
      ciudad: "city",
      libertad: "liberty",
      dificultad: "difficulty"
    };
    return {
      isCognate: true,
      englishWord: map[ascii],
      patternLabel: "后缀 -dad/-tad ↔ -ty",
      tipZh: `同源规律：对应英文 ${map[ascii]}，阴性名词 la ${clean}`
    };
  }

  // -mente ↔ -ly (exact root >= 4)
  if (/mente$/.test(ascii) && ascii.length >= 9) {
    const adjAscii = unaccentSpanishPrefix(ascii.slice(0, -5));
    if (/^(normal|total|final|personal|general|natural|especial|exacta|completa|rapida|facil)/.test(adjAscii)) {
      const en = `${adjAscii.replace(/a$/, "")}ly`;
      return {
        isCognate: true,
        englishWord: en,
        patternLabel: "副词 -mente ↔ -ly",
        tipZh: `同源规律：形容词 + -mente 相当于英文 -ly（近似 ${en}）`
      };
    }
  }

  // -oso/-osa ↔ -ous
  if (/(?:os|iv)[oa]$/.test(ascii) && ascii.length >= 6) {
    if (/(?:famos|curios|nervios|delicios|generos|maravillos|peligros|precios)[oa]$/.test(ascii)) {
      const stem = ascii.slice(0, -3);
      const en = `${stem}ous`;
      return {
        isCognate: true,
        englishWord: en,
        patternLabel: "后缀 -oso ↔ -ous",
        tipZh: `同源规律：-oso/-osa 常对应英文 -ous（近似 ${en}）`
      };
    }
    if (/(?:activ|positiv|negativ|creativ|efectiv|objetiv|relativ)[oa]$/.test(ascii)) {
      const en = `${ascii.slice(0, -1)}e`;
      return {
        isCognate: true,
        englishWord: en,
        patternLabel: "后缀 -ivo ↔ -ive",
        tipZh: `同源规律：-ivo/-iva 对应英文 -ive（${en}）`
      };
    }
  }

  // -ante/-ente ↔ -ant/-ent (only recognizable Latin stems >= 8 chars or allowlist)
  if (
    /^(import|restaur|interes|eleg|brill|dist|const)ant(?:e)$/.test(ascii) ||
    /^(difer|excel|pres|evid|urg|independ|intellig)ent(?:e)$/.test(ascii)
  ) {
    const en = ascii.slice(0, -1);
    return {
      isCognate: true,
      englishWord: en,
      patternLabel: "后缀 -ante/-ente ↔ -ant/-ent",
      tipZh: `同源规律：去掉词尾 e 近似英文 ${en}`
    };
  }

  // -ble ↔ -ble (posible -> possible, terrible -> terrible, probable -> probable)
  if (/^(posi|imposi|proba|terri|horri|increi|vis|respeta|acepta)ble$/.test(ascii)) {
    const en = ascii === "posible" ? "possible" : ascii === "imposible" ? "impossible" : ascii;
    return {
      isCognate: true,
      englishWord: en,
      patternLabel: "后缀 -ble ↔ -ble",
      tipZh: `同源规律：与英文 ${en} 同源`
    };
  }

  // Only suppress unused warning if callers pass meanings
  void meanings;
  return null;
}

const ES_MASC_A_EXCEPTIONS = new Set([
  "problema",
  "programa",
  "sistema",
  "tema",
  "idioma",
  "clima",
  "poema",
  "drama",
  "planeta",
  "mapa",
  "dia",
  "día",
  "sofa",
  "sofá"
]);

const ES_FEM_O_EXCEPTIONS = new Set(["mano", "foto", "moto", "radio"]);

function stripLeadingArticle(term: string): { article: string | null; bare: string } {
  const trimmed = term.trim();
  const match = /^(el|la|los|las|der|die|das|le|la|l['’])\s+(.+)$/i.exec(trimmed);
  if (!match) return { article: null, bare: trimmed };
  return { article: match[1].toLowerCase(), bare: match[2].trim() };
}

/**
 * 为名词生成“冠词绑定记忆”结构（el problema / ____ problema）。
 */
export function buildNounArticleCue(params: {
  lemma: string;
  partOfSpeech?: string | null;
  dictData?: unknown;
  language?: string;
}): NounArticleCue | null {
  const lang = (params.language ?? "es").toLowerCase();
  const pos = (params.partOfSpeech ?? "").trim().toLowerCase();
  const dictObj =
    params.dictData && typeof params.dictData === "object"
      ? (params.dictData as Record<string, unknown>)
      : null;
  const nf =
    dictObj?.nounForms && typeof dictObj.nounForms === "object"
      ? (dictObj.nounForms as { singular?: string; plural?: string; gender?: string })
      : null;

  const isNoun =
    Boolean(nf?.singular) ||
    pos.includes("noun") ||
    pos.startsWith("n.") ||
    pos === "名词" ||
    pos.includes("substantiv");
  if (!isNoun) return null;

  if (lang === "de" || lang === "fr") {
    if (!nf?.singular) return null;
    const stripped = stripLeadingArticle(nf.singular);
    if (!stripped.article) return null;
    const g =
      nf.gender === "f" || nf.gender === "n" || nf.gender === "mf" ? nf.gender : "m";
    const genderLabel =
      g === "f" ? "阴性" : g === "n" ? "中性" : g === "mf" ? "阴阳同形" : "阳性";
    const pluralArticle = lang === "de" ? "die" : "les";
    return {
      article: stripped.article,
      pluralArticle,
      singularWithArticle: nf.singular,
      pluralWithArticle: nf.plural ?? null,
      maskedWithArticle: `____ ${stripped.bare}`,
      gender: g,
      genderLabel
    };
  }

  if (lang !== "es") return null;

  const strippedLemma = stripLeadingArticle(params.lemma);
  const rawSingular = nf?.singular?.trim() || strippedLemma.bare;
  const strippedSingular = stripLeadingArticle(rawSingular);
  const bareSingular = strippedSingular.bare || strippedLemma.bare;
  const bareAscii = foldAccents(bareSingular.toLowerCase());

  let gender: "m" | "f" | "mf" | "n" | null =
    nf?.gender === "m" || nf?.gender === "f" || nf?.gender === "mf"
      ? nf.gender
      : null;

  if (!gender) {
    if (strippedSingular.article === "el" || strippedLemma.article === "el") gender = "m";
    else if (strippedSingular.article === "la" || strippedLemma.article === "la") gender = "f";
    else if (pos.includes("noun_mf") || pos.includes("n.mf")) gender = "mf";
    else if (pos.includes("noun_f") || pos.includes("n.f")) gender = "f";
    else if (pos.includes("noun_m") || pos.includes("n.m")) gender = "m";
    else if (ES_MASC_A_EXCEPTIONS.has(bareAscii)) gender = "m";
    else if (ES_FEM_O_EXCEPTIONS.has(bareAscii)) gender = "f";
    else if (/(?:cion|sion|idad|tad|tud|umbre)$/.test(bareAscii)) gender = "f";
    else if (/o$/.test(bareAscii)) gender = "m";
    else if (/a$/.test(bareAscii)) gender = "f";
  }

  if (!gender) return null;

  const article = gender === "f" ? "la" : gender === "mf" ? "el/la" : "el";
  const pluralArticle = gender === "f" ? "las" : gender === "mf" ? "los/las" : "los";
  const genderLabel = gender === "f" ? "阴性" : gender === "mf" ? "阴阳同形" : "阳性";

  const pluralBare = nf?.plural ? stripLeadingArticle(nf.plural).bare : null;
  return {
    article,
    pluralArticle,
    singularWithArticle: `${article} ${bareSingular}`,
    pluralWithArticle: pluralBare ? `${pluralArticle} ${pluralBare}` : null,
    maskedWithArticle: `____ ${bareSingular}`,
    gender,
    genderLabel
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从遇到时的真实句子里把“目标词（含动词变位/名形单复数/语块）”抠成完形填空，
 * 确保卡片测试的不是孤立词典原形，而是句内真实用法。
 */
export function buildContextCloze(params: {
  sentence?: string | null;
  translatedSentence?: string | null;
  lemma: string;
  forms?: string[];
}): ContextCloze | null {
  const fullSentence = params.sentence?.trim() ?? "";
  if (!fullSentence || fullSentence.length < 6) return null;

  const candidates = Array.from(
    new Set(
      [...(params.forms ?? []), params.lemma]
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
    )
  ).sort((a, b) => b.length - a.length);

  // If sentence is basically just the single word itself, skip cloze
  if (fullSentence.toLowerCase() === params.lemma.trim().toLowerCase()) {
    return null;
  }

  for (const term of candidates) {
    const pattern = new RegExp(`(^|[^\\p{L}])(${escapeRegex(term)})(?=$|[^\\p{L}])`, "iu");
    const match = pattern.exec(fullSentence);
    if (match && match[2]) {
      const start = match.index + match[1].length;
      const end = start + match[2].length;
      const maskedSentence = `${fullSentence.slice(0, start)}______${fullSentence.slice(end)}`;
      return {
        maskedSentence,
        answerForm: match[2],
        fullSentence,
        translatedSentence: params.translatedSentence?.trim() ?? "",
        matchedFromEncounter: true
      };
    }
  }

  // Fallback: accent-insensitive comparison word by word (important when user tapped accented/unaccented variant)
  const foldedCandidates = new Set(candidates.map((c) => foldAccents(c.toLowerCase())));
  const tokenRegex = /[\p{L}áéíóúüñÁÉÍÓÚÜÑßäöüÄÖÜ]+/gu;
  let tok: RegExpExecArray | null;
  while ((tok = tokenRegex.exec(fullSentence)) !== null) {
    const folded = foldAccents(tok[0].toLowerCase());
    if (foldedCandidates.has(folded)) {
      const maskedSentence = `${fullSentence.slice(0, tok.index)}______${fullSentence.slice(
        tok.index + tok[0].length
      )}`;
      return {
        maskedSentence,
        answerForm: tok[0],
        fullSentence,
        translatedSentence: params.translatedSentence?.trim() ?? "",
        matchedFromEncounter: true
      };
    }
  }

  return null;
}

const LEVEL_SCORE: Record<string, number> = {
  A1: 30,
  A2: 22,
  B1: 12,
  B2: 5,
  C1: 1,
  C2: 0
};

/**
 * 给未复习过（srsState === null）的候选卡片计算优先分：
 * - 重复遭遇（视频/阅读里查过 >=2 次）最高优先级
 * - Lexicon 高频词 & A1-A2 核心词优先
 * - 实用语块（Chunk）小幅加权
 * - 极易识别的同源词稍微靠后（避免挤占关键结构词额度）
 */
export function scoreNewReviewPriority(params: {
  itemType: "word" | "phrase";
  encounterCount: number;
  lexiconLevel?: string | null;
  lexiconFrequency?: number | null;
  isEasyCognate?: boolean;
  createdAtMs: number;
}): { score: number; priorityReason: string | null } {
  let score = 0;
  const reasons: string[] = [];

  if (params.encounterCount >= 2) {
    score += 40 * Math.min(params.encounterCount, 5);
    reasons.push(`在材料中遇到 ${params.encounterCount} 次`);
  }

  if (params.lexiconFrequency && params.lexiconFrequency > 0) {
    if (params.lexiconFrequency <= 500) {
      score += 32;
      reasons.push("前500高频核心词");
    } else if (params.lexiconFrequency <= 1500) {
      score += 22;
      reasons.push("前1500高频词");
    } else if (params.lexiconFrequency <= 3000) {
      score += 10;
    }
  }

  if (params.lexiconLevel && params.lexiconLevel in LEVEL_SCORE) {
    score += LEVEL_SCORE[params.lexiconLevel];
    if (
      (params.lexiconLevel === "A1" || params.lexiconLevel === "A2") &&
      reasons.length < 2
    ) {
      reasons.push(`${params.lexiconLevel} 核心词`);
    }
  }

  if (params.itemType === "phrase") {
    score += 16;
    if (reasons.length === 0) reasons.push("实用语块");
  }

  if (params.isEasyCognate && params.encounterCount <= 1) {
    score -= 15;
  }

  // Slight deterministic tie-breaker favoring older saved items slightly when scores tie
  const ageDays = Math.max(0, Math.min(30, Math.floor((Date.now() - params.createdAtMs) / 86400000)));
  score += ageDays * 0.2;

  return {
    score,
    priorityReason: reasons.length > 0 ? reasons.join(" · ") : null
  };
}

export function isLowFrequencyWordCandidate(params: {
  encounterCount: number;
  lexiconLevel?: string | null;
  lexiconFrequency?: number | null;
  srsLapses: number;
}): boolean {
  if (params.lexiconFrequency && params.lexiconFrequency > 4000 && params.encounterCount <= 1) {
    return true;
  }
  if ((params.lexiconLevel === "C1" || params.lexiconLevel === "C2") && params.encounterCount <= 1) {
    return true;
  }
  if (
    params.srsLapses >= 2 &&
    params.encounterCount <= 1 &&
    params.lexiconLevel !== "A1" &&
    params.lexiconLevel !== "A2" &&
    (!params.lexiconFrequency || params.lexiconFrequency > 2000)
  ) {
    return true;
  }
  return false;
}

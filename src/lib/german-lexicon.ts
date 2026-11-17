// Timestamp: 2026-11-17 14:48
export type GermanNounForms = {
  singular: string;
  plural: string;
  gender: "m" | "f" | "n";
};

export type CuratedGermanEntry = {
  lemma: string;
  partOfSpeech: string;
  meanings: string[];
  morphInfo?: string;
  example: { de: string; zh: string };
  nounForms?: GermanNounForms;
};

type SeparableVerbDef = {
  lemma: string;
  prefix: string;
  base: string;
  meaningZh: string;
  exampleDe: string;
  exampleZh: string;
};

const SEPARABLE_VERBS: SeparableVerbDef[] = [
  { lemma: "aufstehen", prefix: "auf", base: "stehen", meaningZh: "起床；站起来", exampleDe: "Ich stehe um sieben Uhr auf.", exampleZh: "我七点钟起床。" },
  { lemma: "anfangen", prefix: "an", base: "fangen", meaningZh: "开始", exampleDe: "Der Kurs fängt um neun Uhr an.", exampleZh: "课程九点开始。" },
  { lemma: "anrufen", prefix: "an", base: "rufen", meaningZh: "打电话给……", exampleDe: "Ich rufe dich morgen an.", exampleZh: "我明天给你打电话。" },
  { lemma: "einkaufen", prefix: "ein", base: "kaufen", meaningZh: "购物；采购", exampleDe: "Wir kaufen im Supermarkt ein.", exampleZh: "我们在超市采购。" },
  { lemma: "fernsehen", prefix: "fern", base: "sehen", meaningZh: "看电视", exampleDe: "Abends sieht er gern fern.", exampleZh: "晚上他喜欢看电视。" },
  { lemma: "mitkommen", prefix: "mit", base: "kommen", meaningZh: "一起来；同行", exampleDe: "Kommst du heute Abend mit?", exampleZh: "你今晚一起来吗？" },
  { lemma: "aufmachen", prefix: "auf", base: "machen", meaningZh: "打开（门、窗等）", exampleDe: "Mach bitte das Fenster auf!", exampleZh: "请把窗户打开！" },
  { lemma: "zumachen", prefix: "zu", base: "machen", meaningZh: "关上（门、窗等）", exampleDe: "Er macht die Tür zu.", exampleZh: "他关上了门。" },
  { lemma: "abfahren", prefix: "ab", base: "fahren", meaningZh: "出发；发车", exampleDe: "Der Zug fährt pünktlich ab.", exampleZh: "火车准时发车。" },
  { lemma: "ankommen", prefix: "an", base: "kommen", meaningZh: "到达；抵达", exampleDe: "Wann kommst du in Berlin an?", exampleZh: "你什么时候到达柏林？" },
  { lemma: "ausgehen", prefix: "aus", base: "gehen", meaningZh: "外出；熄灭", exampleDe: "Am Wochenende gehen wir aus.", exampleZh: "周末我们出去玩。" },
  { lemma: "einladen", prefix: "ein", base: "laden", meaningZh: "邀请", exampleDe: "Sie lädt ihre Freunde ein.", exampleZh: "她邀请她的朋友们。" },
  { lemma: "vorstellen", prefix: "vor", base: "stellen", meaningZh: "介绍；想象", exampleDe: "Ich stelle dir meinen Freund vor.", exampleZh: "我向你介绍我的朋友。" },
  { lemma: "zurückkommen", prefix: "zurück", base: "kommen", meaningZh: "回来；返回", exampleDe: "Er kommt nächste Woche zurück.", exampleZh: "他下周回来。" },
  { lemma: "zuhören", prefix: "zu", base: "hören", meaningZh: "倾听；专心听", exampleDe: "Hör mir bitte gut zu!", exampleZh: "请好好听我说！" },
  { lemma: "aufräumen", prefix: "auf", base: "räumen", meaningZh: "整理；收拾", exampleDe: "Ich räume mein Zimmer auf.", exampleZh: "我收拾我的房间。" },
  { lemma: "aussehen", prefix: "aus", base: "sehen", meaningZh: "看起来；显得", exampleDe: "Das sieht sehr gut aus!", exampleZh: "这看起来很不错！" },
  { lemma: "mitbringen", prefix: "mit", base: "bringen", meaningZh: "带来；顺便带", exampleDe: "Bringst du etwas zu trinken mit?", exampleZh: "你会带点喝的来吗？" },
  { lemma: "mitnehmen", prefix: "mit", base: "nehmen", meaningZh: "带走；随身带", exampleDe: "Ich nehme meinen Regenschirm mit.", exampleZh: "我带上我的雨伞。" },
  { lemma: "vorbereiten", prefix: "vor", base: "bereiten", meaningZh: "准备；筹备", exampleDe: "Wir bereiten das Essen vor.", exampleZh: "我们准备晚饭。" },
  { lemma: "aufwachen", prefix: "auf", base: "wachen", meaningZh: "醒来", exampleDe: "Sie wacht jeden Tag früh auf.", exampleZh: "她每天很早醒来。" },
  { lemma: "einschlafen", prefix: "ein", base: "schlafen", meaningZh: "入睡；睡着", exampleDe: "Das Kind schläft schnell ein.", exampleZh: "孩子很快睡着了。" },
  { lemma: "abholen", prefix: "ab", base: "holen", meaningZh: "去接；去取", exampleDe: "Ich hole dich vom Bahnhof ab.", exampleZh: "我去火车站接你。" },
  { lemma: "einsteigen", prefix: "ein", base: "steigen", meaningZh: "上车", exampleDe: "Wir steigen hier ein.", exampleZh: "我们在这里上车。" },
  { lemma: "aussteigen", prefix: "aus", base: "steigen", meaningZh: "下车", exampleDe: "Nächste Station steige ich aus.", exampleZh: "下一站我下车。" },
  { lemma: "umsteigen", prefix: "um", base: "steigen", meaningZh: "换乘（车）", exampleDe: "In Frankfurt müssen wir umsteigen.", exampleZh: "在法兰克福我们必须换乘。" },
  { lemma: "aufhören", prefix: "auf", base: "hören", meaningZh: "停止；结束", exampleDe: "Es hört gleich auf zu regnen.", exampleZh: "雨马上就要停了。" },
  { lemma: "teilnehmen", prefix: "teil", base: "nehmen", meaningZh: "参加；参与", exampleDe: "Alle nehmen am Kurs teil.", exampleZh: "大家都参加这门课。" },
  { lemma: "stattfinden", prefix: "statt", base: "finden", meaningZh: "举行；发生", exampleDe: "Das Konzert findet heute statt.", exampleZh: "音乐会今天举行。" },
  { lemma: "nachdenken", prefix: "nach", base: "denken", meaningZh: "思考；考虑", exampleDe: "Ich denke darüber nach.", exampleZh: "我思考一下这件事。" },
  { lemma: "weitergehen", prefix: "weiter", base: "gehen", meaningZh: "继续走；继续进行", exampleDe: "Wir gehen jetzt weiter.", exampleZh: "我们现在继续往前走。" },
  { lemma: "anmachen", prefix: "an", base: "machen", meaningZh: "打开（灯、电器）", exampleDe: "Mach bitte das Licht an.", exampleZh: "请把灯打开。" },
  { lemma: "ausmachen", prefix: "aus", base: "machen", meaningZh: "关掉（灯、电器）；约定", exampleDe: "Sie macht das Radio aus.", exampleZh: "她关掉了收音机。" },
  { lemma: "ausfüllen", prefix: "aus", base: "füllen", meaningZh: "填写（表格）", exampleDe: "Bitte füllen Sie das Formular aus.", exampleZh: "请填写这份表格。" }
];

const BASE_VERB_FORMS: Record<string, string[]> = {
  stehen: ["stehen", "stehe", "stehst", "steht", "stand", "standen", "standst", "standet", "gestanden", "steh"],
  fangen: ["fangen", "fange", "fängst", "fängt", "fangt", "fing", "fingen", "gefangen", "fang"],
  rufen: ["rufen", "rufe", "rufst", "ruft", "rief", "riefen", "gerufen", "ruf"],
  kaufen: ["kaufen", "kaufe", "kaufst", "kauft", "kaufte", "kauften", "gekauft", "kauf"],
  sehen: ["sehen", "sehe", "siehst", "sieht", "seht", "sah", "sahen", "gesehen", "sieh"],
  kommen: ["kommen", "komme", "kommst", "kommt", "kam", "kamen", "gekommen", "komm"],
  machen: ["machen", "mache", "machst", "macht", "machte", "machten", "gemacht", "mach"],
  fahren: ["fahren", "fahre", "fährst", "fährt", "fahrt", "fuhr", "fuhren", "gefahren", "fahr"],
  gehen: ["gehen", "gehe", "gehst", "geht", "ging", "gingen", "gegangen", "geh"],
  laden: ["laden", "lade", "lädst", "lädt", "ladet", "lud", "luden", "geladen", "lad"],
  stellen: ["stellen", "stelle", "stellst", "stellt", "stellte", "stellten", "gestellt", "stell"],
  hören: ["hören", "höre", "hörst", "hört", "hörte", "hörten", "gehört", "hör"],
  räumen: ["räumen", "räume", "räumst", "räumt", "räumte", "räumten", "geräumt", "räum"],
  bringen: ["bringen", "bringe", "bringst", "bringt", "brachte", "brachten", "gebracht", "bring"],
  nehmen: ["nehmen", "nehme", "nimmst", "nimmt", "nehmt", "nahm", "nahmen", "genommen", "nimm"],
  bereiten: ["bereiten", "bereite", "bereitest", "bereitet", "bereitete", "bereitet"],
  wachen: ["wachen", "wache", "wachst", "wacht", "wachte", "gewacht", "wach"],
  schlafen: ["schlafen", "schlafe", "schläfst", "schläft", "schlaft", "schlief", "schliefen", "geschlafen", "schlaf"],
  holen: ["holen", "hole", "holst", "holt", "holte", "geholt", "hol"],
  steigen: ["steigen", "steige", "steigst", "steigt", "stieg", "stiegen", "gestiegen", "steig"],
  finden: ["finden", "finde", "findest", "findet", "fand", "fanden", "gefunden", "find"],
  denken: ["denken", "denke", "denkst", "denkt", "dachte", "dachten", "gedacht", "denk"],
  füllen: ["füllen", "fülle", "füllst", "füllt", "füllte", "gefüllt", "füll"]
};

const FORM_TO_BASES = new Map<string, string[]>();
for (const [base, forms] of Object.entries(BASE_VERB_FORMS)) {
  for (const f of forms) {
    const bucket = FORM_TO_BASES.get(f) ?? [];
    if (!bucket.includes(base)) bucket.push(base);
    FORM_TO_BASES.set(f, bucket);
  }
}

const VERB_BY_LEMMA = new Map<string, SeparableVerbDef>();
const VERB_BY_KEY = new Map<string, SeparableVerbDef>();
const ATTACHED_FORM_TO_VERB = new Map<string, SeparableVerbDef>();

for (const v of SEPARABLE_VERBS) {
  VERB_BY_LEMMA.set(v.lemma, v);
  VERB_BY_KEY.set(`${v.prefix}::${v.base}`, v);
  for (const form of BASE_VERB_FORMS[v.base] ?? [v.base]) {
    ATTACHED_FORM_TO_VERB.set(`${v.prefix}${form}`, v);
    if (form.startsWith("ge")) {
      ATTACHED_FORM_TO_VERB.set(`${v.prefix}${form}`, v);
    }
    if (form === v.base) {
      ATTACHED_FORM_TO_VERB.set(`${v.prefix}zu${v.base}`, v);
    }
  }
}

const PREFIXES = new Set(SEPARABLE_VERBS.map((v) => v.prefix));

export type SeparableVerbMatch = {
  lemma: string;
  matchedForm: string;
  morphHint: string;
};

/**
 * 识别德语可分动词（支持 `Ich stehe um sieben Uhr auf.` 分开书写与合写/过去分词/带 zu 不定式）。
 */
export function resolveGermanSeparableVerb(
  word: string,
  context?: string
): SeparableVerbMatch | null {
  const cleanWord = word
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}äöüß]+|[^\p{L}äöüß]+$/giu, "");
  if (!cleanWord) return null;

  // 1) 直接连写形式（aufstehen, aufgestanden, aufzustehen, fängt... 均按全词匹配）
  const directVerb = VERB_BY_LEMMA.get(cleanWord) ?? ATTACHED_FORM_TO_VERB.get(cleanWord);
  if (directVerb) {
    return {
      lemma: directVerb.lemma,
      matchedForm: cleanWord,
      morphHint:
        cleanWord === directVerb.lemma
          ? `可分动词（${directVerb.prefix} · ${directVerb.base}）`
          : `可分动词变位（原形：${directVerb.lemma}）`
    };
  }

  if (!context || !context.trim()) {
    return null;
  }

  // 把上下文按子句标点拆成独立分句，避免跨分句误配
  const clauses = context
    .split(/[.!?;,\n]+/u)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const tokens = clause
      .split(/\s+/)
      .map((t) => t.toLowerCase().replace(/^[^\p{L}äöüß]+|[^\p{L}äöüß]+$/giu, ""))
      .filter(Boolean);

    const idx = tokens.indexOf(cleanWord);
    if (idx < 0) continue;

    // 2a) 用户点的是动词变位（如 "stehe"），往同一分句后面找分离出去的前缀（如 "auf"）
    const candidateBases = FORM_TO_BASES.get(cleanWord);
    if (candidateBases && candidateBases.length > 0) {
      for (let j = idx + 1; j < tokens.length; j += 1) {
        const tok = tokens[j];
        if (!PREFIXES.has(tok)) continue;
        for (const base of candidateBases) {
          const found = VERB_BY_KEY.get(`${tok}::${base}`);
          if (found) {
            return {
              lemma: found.lemma,
              matchedForm: `${cleanWord} ... ${tok}`,
              morphHint: `可分动词 · ${cleanWord} ... ${tok} → ${found.lemma}`
            };
          }
        }
      }
    }

    // 2b) 用户点的是句尾的可分前缀（如 "auf"），往同一分句前面找配对变位动词（如 "stehe"）
    if (PREFIXES.has(cleanWord)) {
      for (let j = idx - 1; j >= 0; j -= 1) {
        const prev = tokens[j];
        const bases = FORM_TO_BASES.get(prev);
        if (!bases) continue;
        for (const base of bases) {
          const found = VERB_BY_KEY.get(`${cleanWord}::${base}`);
          if (found) {
            return {
              lemma: found.lemma,
              matchedForm: `${prev} ... ${cleanWord}`,
              morphHint: `可分动词 · ${prev} ... ${cleanWord} → ${found.lemma}`
            };
          }
        }
      }
    }
  }

  return null;
}

const RAW_GERMAN_NOUNS: Array<{
  lemma: string;
  gender: "m" | "f" | "n";
  plural: string;
  meanings: string[];
  exampleDe: string;
  exampleZh: string;
}> = [
  { lemma: "Fahrrad", gender: "n", plural: "die Fahrräder", meanings: ["自行车", "脚踏车"], exampleDe: "Ich fahre mit dem Fahrrad zur Arbeit.", exampleZh: "我骑自行车去上班。" },
  { lemma: "Haus", gender: "n", plural: "die Häuser", meanings: ["房子", "家"], exampleDe: "Das Haus hat einen großen Garten.", exampleZh: "这座房子有一个大花园。" },
  { lemma: "Buch", gender: "n", plural: "die Bücher", meanings: ["书", "书籍"], exampleDe: "Ich lese jeden Abend ein Buch.", exampleZh: "我每天晚上读一本书。" },
  { lemma: "Tisch", gender: "m", plural: "die Tische", meanings: ["桌子"], exampleDe: "Das Handy liegt auf dem Tisch.", exampleZh: "手机放在桌子上。" },
  { lemma: "Schule", gender: "f", plural: "die Schulen", meanings: ["学校"], exampleDe: "Die Kinder gehen zu Fuß zur Schule.", exampleZh: "孩子们步行去上学。" },
  { lemma: "Stadt", gender: "f", plural: "die Städte", meanings: ["城市", "城镇"], exampleDe: "Berlin ist eine große Stadt.", exampleZh: "柏林是一座大城市。" },
  { lemma: "Zug", gender: "m", plural: "die Züge", meanings: ["火车", "列车"], exampleDe: "Der Zug fährt um acht Uhr ab.", exampleZh: "火车八点整出发。" },
  { lemma: "Bahnhof", gender: "m", plural: "die Bahnhöfe", meanings: ["火车站"], exampleDe: "Wir treffen uns vor dem Bahnhof.", exampleZh: "我们在火车站前碰面。" },
  { lemma: "Freund", gender: "m", plural: "die Freunde", meanings: ["朋友（男性）", "男朋友"], exampleDe: "Mein Freund wohnt in Hamburg.", exampleZh: "我的朋友住在汉堡。" },
  { lemma: "Tag", gender: "m", plural: "die Tage", meanings: ["天", "白天"], exampleDe: "Ich wünsche dir einen schönen Tag!", exampleZh: "祝你今天愉快！" },
  { lemma: "Uhr", gender: "f", plural: "die Uhren", meanings: ["点钟", "手表", "时钟"], exampleDe: "Ich stehe um sieben Uhr auf.", exampleZh: "我七点钟起床。" },
  { lemma: "Kaffee", gender: "m", plural: "die Kaffees", meanings: ["咖啡"], exampleDe: "Morgens trinke ich eine Tasse Kaffee.", exampleZh: "早上我喝一杯咖啡。" },
  { lemma: "Arbeit", gender: "f", plural: "die Arbeiten", meanings: ["工作", "劳动"], exampleDe: "Nach der Arbeit fahre ich nach Hause.", exampleZh: "下班后我骑车回家。" },
  { lemma: "Kind", gender: "n", plural: "die Kinder", meanings: ["孩子", "儿童"], exampleDe: "Das Kind spielt im Park.", exampleZh: "孩子在公园里玩耍。" },
  { lemma: "Woche", gender: "f", plural: "die Wochen", meanings: ["周", "星期"], exampleDe: "Nächste Woche habe ich Urlaub.", exampleZh: "下周我休假。" }
];

const ARTICLE_BY_GENDER: Record<"m" | "f" | "n", string> = {
  m: "der",
  f: "die",
  n: "das"
};

export const CURATED_GERMAN_ENTRIES = new Map<string, CuratedGermanEntry>();

for (const v of SEPARABLE_VERBS) {
  CURATED_GERMAN_ENTRIES.set(v.lemma.toLowerCase(), {
    lemma: v.lemma,
    partOfSpeech: "v.sep.",
    meanings: [v.meaningZh],
    morphInfo: `可分动词：${v.prefix} + ${v.base}`,
    example: { de: v.exampleDe, zh: v.exampleZh }
  });
}

for (const n of RAW_GERMAN_NOUNS) {
  const art = ARTICLE_BY_GENDER[n.gender];
  CURATED_GERMAN_ENTRIES.set(n.lemma.toLowerCase(), {
    lemma: n.lemma,
    partOfSpeech: `n.${n.gender}.`,
    meanings: n.meanings,
    morphInfo: `名词 · ${art} ${n.lemma} → ${n.plural}`,
    example: { de: n.exampleDe, zh: n.exampleZh },
    nounForms: {
      gender: n.gender,
      singular: `${art} ${n.lemma}`,
      plural: n.plural
    }
  });
  // Also allow looking up the plural form directly (e.g. "Fahrräder" -> "Fahrrad")
  const pluralBare = n.plural.replace(/^(der|die|das)\s+/i, "").trim().toLowerCase();
  if (pluralBare && !CURATED_GERMAN_ENTRIES.has(pluralBare)) {
    CURATED_GERMAN_ENTRIES.set(pluralBare, {
      lemma: n.lemma,
      partOfSpeech: `n.${n.gender}.`,
      meanings: n.meanings,
      morphInfo: `复数形式 → ${art} ${n.lemma} → ${n.plural}`,
      example: { de: n.exampleDe, zh: n.exampleZh },
      nounForms: {
        gender: n.gender,
        singular: `${art} ${n.lemma}`,
        plural: n.plural
      }
    });
  }
}

export function lookupCuratedGermanEntry(
  word: string,
  context?: string
): CuratedGermanEntry | null {
  const sep = resolveGermanSeparableVerb(word, context);
  if (sep) {
    const found = CURATED_GERMAN_ENTRIES.get(sep.lemma.toLowerCase());
    if (found) {
      return {
        ...found,
        morphInfo: sep.morphHint
      };
    }
  }

  const key = word
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}äöüß]+|[^\p{L}äöüß]+$/giu, "");
  if (!key) return null;
  return CURATED_GERMAN_ENTRIES.get(key) ?? null;
}

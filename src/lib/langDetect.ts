// Timestamp: 2026-11-14 22:32

/**
 * 朗读语言识别。
 *
 * 为什么需要：设备 TTS 只会按 `language` 去找音色。传 "es-ES" 而机器上没装西语音色时，
 * Android 会退回默认音色（通常是 en-US），于是西语单词被用英语发音念出来——
 * 听起来就是「单词音频全是英语」，而且不报错、极难从代码上看出来。
 *
 * 但这个函数**不是万能的**，必须说清边界：
 *   - 单词级短文本（"no" / "le" / "son"）在英语、西语、法语里都成立，无法可靠判定
 *   - 所以调用方必须给 fallback：西语学习类界面 fallback 用 es，角色对话 fallback 用角色语言
 *   - 识别的作用是「纠正明显的错判」，比如西语对话里出现 "How are you?"、英语角色说了 "¡Hola!"
 */

export type LangCode = "es" | "en" | "fr" | "ja" | "zh";

const KANA = /[\u3040-\u30ff]/;
const HAN = /[\u4e00-\u9fff]/;

/** 只有西语用 ñ / ¿ / ¡ */
const ES_ONLY = /[ñ¿¡]/i;
/** á í ó ú ü 也出现在葡语、德语里，但配合其它信号足够用 */
const ES_ACCENT = /[áíóúü]/i;
/** ç œ æ 基本只出现在法语（葡语也有 ç，单独不强） */
const FR_ONLY = /[œæ]/i;
const FR_ACCENT = /[èêëàâîôûù]/i;

const ES_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "que", "y", "es",
  "son", "está", "están", "por", "para", "con", "pero", "muy", "como", "más", "también",
  "hola", "gracias", "porque", "cuando", "donde", "todo", "todos", "se", "su", "sus",
  "mi", "tu", "yo", "tú", "él", "ella", "nosotros", "vosotros", "ellos", "esto", "eso",
  "hay", "ser", "estar", "tener", "hacer", "muy", "bien", "mal", "sí", "no"
]);

const EN_WORDS = new Set([
  "the", "a", "an", "and", "of", "to", "is", "are", "was", "were", "you", "i", "he",
  "she", "it", "we", "they", "that", "this", "with", "for", "but", "very", "hello",
  "thanks", "because", "when", "where", "all", "my", "your", "his", "her", "our",
  "their", "have", "has", "do", "does", "what", "how", "why", "not", "yes"
]);

const FR_WORDS = new Set([
  "le", "les", "des", "une", "est", "sont", "et", "pour", "avec", "mais", "très",
  "bonjour", "merci", "parce", "quand", "où", "tout", "mon", "ton", "son", "nous",
  "vous", "ils", "elles", "je", "tu", "il", "elle", "ce", "cette", "dans", "sur"
]);

/**
 * 多语言共有的短词。这些词在西/英/法里都成立（le、son、de、no……），
 * 单看它们判语言必然出错：把 "le" 判成法语，西语学习者就会听到法语发音。
 * 所以进了这张表的词，一律不参与判定，交回调用方的 fallback。
 */
const SHARED_WORDS = new Set([
  "le", "la", "les", "son", "de", "no", "se", "su", "mi", "tu", "es", "un", "una",
  "con", "que", "a", "y", "il", "ce", "ma", "mon", "ton", "si", "on", "en", "me", "te"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 返回识别出的语言；证据不足时返回 null（交给调用方的 fallback）。
 * 不做「猜一个最像的」——猜错比不猜更糟，因为猜错时音色是错的而且没人知道。
 */
export function detectLang(text: string | null | undefined): LangCode | null {
  const content = (text ?? "").trim();
  if (!content) return null;

  if (KANA.test(content)) return "ja";
  if (HAN.test(content)) return "zh";
  if (FR_ONLY.test(content)) return "fr";
  if (ES_ONLY.test(content)) return "es";

  const tokens = tokenize(content);
  if (tokens.length === 0) return null;

  // 单个词：只有"只属于某一门语言"才敢判，否则一律不判（见 SHARED_WORDS 的注释）
  if (tokens.length === 1) {
    const token = tokens[0];
    if (SHARED_WORDS.has(token)) return null;

    const hits = [
      ES_WORDS.has(token) ? "es" : null,
      EN_WORDS.has(token) ? "en" : null,
      FR_WORDS.has(token) ? "fr" : null
    ].filter(Boolean) as LangCode[];

    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null;

    // 词典里没有的词，看拼写线索：西语特有的词尾
    if (/(ción|ciones|dad|dades|mente|ado|ada|ido|ida)$/i.test(token)) return "es";
    if (FR_ACCENT.test(token) && !ES_ACCENT.test(token)) return "fr";
    // 带西语重音符号但不带法语符号的，按西语处理（café 这类两可词影响很小）
    if (ES_ACCENT.test(token)) return "es";

    return null;
  }

  let es = 0;
  let en = 0;
  let fr = 0;

  tokens.forEach((token) => {
    if (ES_WORDS.has(token)) es += 1;
    if (EN_WORDS.has(token)) en += 1;
    if (FR_WORDS.has(token)) fr += 1;
  });

  if (ES_ACCENT.test(content)) es += 1;
  if (FR_ACCENT.test(content)) fr += 1;

  // 西语常见词尾：-ción / -dad / -ado / -ido / -mente
  if (/(ción|ciones|dad|dades|ado|ada|idos|mente)$/i.test(content)) es += 1;

  const scores: Array<[LangCode, number]> = [
    ["es", es],
    ["en", en],
    ["fr", fr]
  ];
  const ranked = scores.sort((a, b) => b[1] - a[1]);

  const [best, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  // 至少要有一条明确证据，且明显优于第二名（避免 "le" 这种三语都通的情况乱判）
  if (bestScore >= 1 && bestScore > secondScore) return best;
  return null;
}

/** 把识别结果或 fallback 归一成 BCP-47 语言标签 */
export function resolveLang(
  text: string | null | undefined,
  fallback: string = "es"
): string {
  const detected = detectLang(text);
  if (detected) return detected;
  return fallback;
}

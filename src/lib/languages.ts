// Timestamp: 2026-11-17 14:45
import { prisma } from "@/lib/prisma";

export const SUPPORTED_LANGUAGES = ["es", "de", "en", "fr", "ja"] as const;
export type LearningLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LearningLanguage = "es";

export const LANGUAGE_LABELS: Record<LearningLanguage, string> = {
  es: "西班牙语",
  de: "德语",
  en: "英语",
  fr: "法语",
  ja: "日语"
};

/**
 * 把任意 locale / 语言标签归一成短语种代码（es / en / fr / ja）。
 * 不识别的值回退到 "es"，保证老接口和历史数据安全。
 */
export function normalizeLanguage(raw?: string | null): LearningLanguage {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return DEFAULT_LANGUAGE;

  const base = value.split(/[-_]/)[0] ?? "";
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(base)) {
    return base as LearningLanguage;
  }
  return DEFAULT_LANGUAGE;
}

export function isSupportedLanguage(raw?: string | null): raw is LearningLanguage {
  const value = (raw ?? "").trim().toLowerCase();
  const base = value.split(/[-_]/)[0] ?? "";
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base);
}

/**
 * 轻量脚本/特征识别，用来在「主学西语」时预警用户点查到了日语/英语高频特征词。
 * 仅在高置信度时返回语种，避免西英同形词（如 hotel/doctor/animal）误报。
 */
const COMMON_ENGLISH_ONLY_WORDS = new Set([
  "the", "this", "that", "these", "those", "with", "from", "they", "their",
  "there", "where", "when", "what", "which", "would", "could", "should",
  "about", "because", "through", "between", "under", "after", "before",
  "going", "getting", "making", "working", "looking", "thinking", "something",
  "anything", "everything", "nothing", "morning", "evening", "weekend",
  "you", "your", "yours", "we", "our", "she", "him", "his", "its",
  "and", "but", "for", "not", "are", "was", "were", "have", "has", "had",
  "will", "can", "just", "very", "really", "actually", "maybe", "always",
  "never", "sometimes", "still", "already", "enough", "welcome", "please",
  "thank", "thanks", "sorry", "hello", "today", "tomorrow", "yesterday"
]);

const COMMON_GERMAN_ONLY_WORDS = new Set([
  "der", "die", "das", "ein", "eine", "einen", "einem", "eines", "einer",
  "ich", "du", "er", "wir", "ihr", "und", "oder", "aber", "nicht", "kein",
  "keine", "mit", "auf", "aus", "bei", "nach", "seit", "von", "für", "um",
  "über", "unter", "uhr", "sieben", "heute", "morgen", "fahrrad", "aufstehen",
  "stehe", "stehen", "ist", "sind", "bin", "bist", "haben", "habe"
]);

const COMMON_FRENCH_ONLY_WORDS = new Set([
  "bonjour", "bonsoir", "merci", "salut", "oui", "toujours", "jamais",
  "avec", "dans", "pour", "vous", "nous", "elles", "suis", "sont",
  "cette", "mais", "très", "être", "avoir", "faire", "aller", "demain",
  "aujourd'hui", "français", "française", "gare", "matin", "prendre"
]);

export function detectQueryLanguage(text: string): LearningLanguage | null {
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;

  if (/[\u3040-\u30ff]/.test(cleaned)) return "ja";
  if (/ß/.test(cleaned)) return "de";
  if (/[ñ¿¡]/i.test(cleaned)) return "es";
  if (/[äö]/i.test(cleaned)) return "de";
  if (/[àâæçèêëîïôœùûÿ]/i.test(cleaned)) return "fr";
  if (/[áéíóú]/i.test(cleaned)) return "es";

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => COMMON_GERMAN_ONLY_WORDS.has(token))) {
    return "de";
  }
  if (tokens.some((token) => COMMON_FRENCH_ONLY_WORDS.has(token))) {
    return "fr";
  }
  if (tokens.some((token) => COMMON_ENGLISH_ONLY_WORDS.has(token))) {
    return "en";
  }
  if (/^[a-z]+(ing|tion|ness|ment|ful|less|ship|ight|ought)$/.test(cleaned)) {
    return "en";
  }
  return null;
}

/**
 * 统一解析当前请求的目标学习语言：
 * 1) 显式参数（query ?lang= 或 body.language）
 * 2) 请求头 X-Learning-Lang（移动端 apiFetch 自动携带）
 * 3) 用户表 User.activeLanguage
 * 4) 兜底 "es"
 */
export async function resolveRequestLanguage(
  request: Request | null,
  explicit?: unknown,
  userId?: string | null
): Promise<LearningLanguage> {
  if (typeof explicit === "string" && explicit.trim()) {
    return normalizeLanguage(explicit);
  }

  const headerLang = request?.headers.get("x-learning-lang")?.trim();
  if (headerLang) {
    return normalizeLanguage(headerLang);
  }

  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeLanguage: true }
      });
      if (user?.activeLanguage) {
        return normalizeLanguage(user.activeLanguage);
      }
    } catch {
      // ignore if user lookup fails
    }
  }

  return DEFAULT_LANGUAGE;
}

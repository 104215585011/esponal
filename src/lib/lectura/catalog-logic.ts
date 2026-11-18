// Timestamp: 2026-11-18 17:30
export type LecturaLevel = "A1" | "A2" | "B1";
export type LecturaContentKind = "story" | "blog" | "news";
export type LecturaAudioType = "native" | "tts";

export type LecturaCatalogItem = {
  slug: string;
  language: "es" | "de" | "en" | "fr" | "ja";
  contentKind: LecturaContentKind;
  sourceId: string;
  sourceLabel: string;
  title: string;
  titleZh: string;
  summaryZh: string;
  topic: string;
  level: LecturaLevel | null;
  levelSource?: "curated" | "inferred" | null;
  durationMin: number;
  paragraphs: string[];
  paragraphCount: number;
  isFullText: boolean;
  bodyStatus: "ready" | "excerpt" | "failed";
  glossary: Array<{ word: string; note: string }>;
  audioUrl?: string | null;
  audioType: LecturaAudioType;
  coverUrl?: string | null;
  sourceUrl?: string | null;
  publishedAt?: string;
  sortWeight?: number;
};

const INCOMPLETE_PATTERNS = [
  /suscr[ií]bete.*para seguir leyendo/i,
  /el resto de este art[ií]culo/i,
  /solo est[aá] disponible para suscriptores/i,
  /continue reading on/i,
  /\[\.\.\.\]$/
];

const BOILERPLATE_PARA_RE =
  /^(utilizamos cookies|pol[ií]tica de privacidad|copyright|todos los derechos|men[uú] de navegaci[oó]n|compartir en redes)/i;

export function isMediaPromoPage(paragraphs: string[]): boolean {
  const body = paragraphs.join(" ");
  const isVideoPromo =
    /our spanish learning videos/i.test(body) &&
    /get the full real fluency collection course/i.test(body);
  const isPodcastPromo =
    /podcast:\s*play in new window/i.test(body) &&
    /echa un vistazo a nuestros cursos online/i.test(body);
  return isVideoPromo || isPodcastPromo;
}

export function assessArticleBody(
  rawParagraphs: string[],
  maxParagraphs = 120
): {
  paragraphs: string[];
  wordCount: number;
  isFullText: boolean;
  bodyStatus: "ready" | "excerpt" | "failed";
  durationMin: number;
} {
  const cleaned = (rawParagraphs ?? [])
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 25 && !BOILERPLATE_PARA_RE.test(p));

  const wordCount = cleaned.join(" ").split(/\s+/).filter(Boolean).length;
  if (cleaned.length < 4 || wordCount < 85 || isMediaPromoPage(cleaned)) {
    return {
      paragraphs: cleaned,
      wordCount,
      isFullText: false,
      bodyStatus: "failed",
      durationMin: Math.max(1, Math.ceil(wordCount / 110))
    };
  }

  const last = cleaned[cleaned.length - 1] ?? "";
  const hitTruncatedMarker =
    cleaned.length >= maxParagraphs || INCOMPLETE_PATTERNS.some((re) => re.test(last));
  const isFullText = !hitTruncatedMarker;
  const durationMin = Math.max(2, Math.min(25, Math.ceil(wordCount / 110)));

  return {
    paragraphs: cleaned,
    wordCount,
    isFullText,
    bodyStatus: isFullText ? "ready" : "excerpt",
    durationMin
  };
}

export function inferCuratedStoryTopic(story: {
  slug: string;
  title: string;
  titleZh: string;
  summaryZh: string;
}): string {
  const text = `${story.slug} ${story.title} ${story.titleZh} ${story.summaryZh}`.toLowerCase();
  if (/tortuga|leon|flautista|fábula|寓言/.test(text)) return "经典故事";
  if (/madrid|camino|fermin|san-fermin|valencia|fallas|tomatina|inti|peru|colombia|旅行|散步|城市/.test(text)) {
    return "旅行探索";
  }
  if (/cafe|café|tapas|mate|asado|empanada|ceviche|咖啡|美食|烤肉|下午茶/.test(text)) {
    return "饮食风味";
  }
  if (/siesta|sobremesa|muertos|mariachi|pinata|posadas|guadalupe|lucha|quinceanera|tango|salsa|bachata|uvas|reyes|apellidos|hora|apodos/.test(text)) {
    return "生活文化";
  }
  return "日常故事";
}

export function normalizeLevelFilter(raw?: string | null): "ALL" | LecturaLevel | "UNCONFIRMED" {
  const val = (raw ?? "").trim().toUpperCase();
  if (val === "A1" || val === "A2" || val === "B1") return val;
  if (val === "UNCONFIRMED" || val === "NULL" || val === "PENDING") return "UNCONFIRMED";
  return "ALL";
}

/**
 * 跨来源混排精选：穿插分级短文（story）、生活文化博客（blog）和少量精选新闻（news），
 * 兼顾难度与阅读时长，不再让时事新闻霸占推荐顶部。
 */
export function mixLecturaRecommendations<
  T extends {
    slug: string;
    contentKind: LecturaContentKind;
    level: LecturaLevel | null;
    durationMin: number;
    isRead?: boolean;
    completed?: boolean;
    sortWeight?: number;
  }
>(items: T[]): T[] {
  const active = [...items].sort((a, b) => (b.sortWeight ?? 0) - (a.sortWeight ?? 0));
  const unread = active.filter((i) => !(i.completed ?? i.isRead));
  const done = active.filter((i) => Boolean(i.completed ?? i.isRead));

  const interleave = (pool: T[]) => {
    const stories = pool.filter((i) => i.contentKind === "story");
    const blogs = pool.filter((i) => i.contentKind === "blog");
    const news = pool.filter((i) => i.contentKind === "news");

    // 按 A1/A2/B1/待确认穿插，让前面既有入门故事也有真实生活博客，news 适度穿插靠后
    const out: T[] = [];
    const seen = new Set<string>();
    const pushIf = (item?: T) => {
      if (!item || seen.has(item.slug)) return false;
      seen.add(item.slug);
      out.push(item);
      return true;
    };

    let sIdx = 0;
    let bIdx = 0;
    let nIdx = 0;
    while (sIdx < stories.length || bIdx < blogs.length || nIdx < news.length) {
      // 每轮节奏：1 blog（生活文化） + 2 story（短文） + 每两轮 1 news（时事）
      if (bIdx < blogs.length) pushIf(blogs[bIdx++]);
      if (sIdx < stories.length) pushIf(stories[sIdx++]);
      if (sIdx < stories.length) pushIf(stories[sIdx++]);
      if (bIdx < blogs.length) pushIf(blogs[bIdx++]);
      if (nIdx < news.length && out.length % 5 < 2) pushIf(news[nIdx++]);
      else if (sIdx >= stories.length && bIdx >= blogs.length && nIdx < news.length) {
        pushIf(news[nIdx++]);
      }
    }
    return out;
  };

  return [...interleave(unread), ...interleave(done)];
}

const ADJACENT_LEVELS: Record<string, string[]> = {
  A1: ["A1", "A2", "B1"],
  A2: ["A2", "A1", "B1"],
  B1: ["B1", "A2", "A1"],
  UNCONFIRMED: ["A2", "B1", "A1"]
};

export type NextStoryRecommendation = {
  slug: string;
  title: string;
  titleZh: string;
  summaryZh: string;
  topic: string;
  level: LecturaLevel | null;
  durationMin: number;
  contentKind: LecturaContentKind;
  matchedWords: string[];
  reasonZh: string;
};

/**
 * 读完当前文章后推荐下一篇：
 * 1) 优先未读完、相近难度与相关主题；
 * 2) 若近期/本篇收藏的词在候选文章正文中复现，优先推荐以自然巩固。
 */
export function recommendNextLecturaStory<
  T extends {
    slug: string;
    language?: string;
    title: string;
    titleZh: string;
    summaryZh: string;
    topic: string;
    level: LecturaLevel | null;
    durationMin: number;
    contentKind: LecturaContentKind;
    paragraphs?: string[];
  }
>(params: {
  current: T;
  candidates: T[];
  completedSlugs: Set<string>;
  savedWords?: string[];
}): NextStoryRecommendation | null {
  const { current, candidates, completedSlugs, savedWords = [] } = params;
  const levelPriority = ADJACENT_LEVELS[current.level ?? "UNCONFIRMED"] ?? ["A2", "A1", "B1"];

  const normalizedWords = Array.from(
    new Set(
      savedWords
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 3)
    )
  ).slice(0, 30);

  const pool = candidates.filter(
    (c) =>
      c.slug !== current.slug &&
      !completedSlugs.has(c.slug) &&
      (!current.language || !c.language || c.language === current.language)
  );

  const fallbackPool =
    pool.length > 0
      ? pool
      : candidates.filter((c) => c.slug !== current.slug);

  if (fallbackPool.length === 0) return null;

  let best: { item: T; score: number; matchedWords: string[] } | null = null;

  for (const item of fallbackPool) {
    let score = 0;

    // 难度匹配分
    const lvlKey = item.level ?? "UNCONFIRMED";
    const lvlRank = levelPriority.indexOf(lvlKey);
    if (lvlRank === 0) score += 30;
    else if (lvlRank === 1) score += 18;
    else if (lvlRank === 2) score += 8;
    else score += 10;

    // 相关题材加分
    if (item.topic === current.topic) score += 22;
    if (item.contentKind === "blog" || item.contentKind === "story") score += 6;

    // 复现已收藏词汇加分
    const bodyLower = `${item.title} ${(item.paragraphs ?? []).join(" ")}`.toLowerCase();
    const matchedWords: string[] = [];
    for (const w of normalizedWords) {
      if (bodyLower.includes(w)) {
        matchedWords.push(w);
        score += 14;
      }
      if (matchedWords.length >= 3) break;
    }

    if (!best || score > best.score) {
      best = { item, score, matchedWords };
    }
  }

  if (!best) return null;

  const { item, matchedWords } = best;
  const reasons: string[] = [];
  if (matchedWords.length > 0) {
    reasons.push(`复现你收藏过的词（${matchedWords.slice(0, 2).join(" / ")}）`);
  }
  if (item.topic === current.topic) {
    reasons.push(`同属「${item.topic}」主题`);
  }
  if (item.level && current.level && item.level === current.level) {
    reasons.push(`相近难度 ${item.level}`);
  } else if (item.level) {
    reasons.push(`适合当前阅读衔接（${item.level}）`);
  }

  return {
    slug: item.slug,
    title: item.title,
    titleZh: item.titleZh,
    summaryZh: item.summaryZh,
    topic: item.topic,
    level: item.level,
    durationMin: item.durationMin,
    contentKind: item.contentKind,
    matchedWords,
    reasonZh: reasons.join(" · ") || "为你挑选的下一篇延伸阅读"
  };
}

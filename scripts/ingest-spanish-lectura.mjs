// Timestamp: 2026-11-18 11:10
/**
 * 西语文章库采集、正文完整性核验与中文选文信息生成脚本。
 *
 * 1) 收录 Esponal 内置 36 篇西语分级短文，补全主题标签与时长；
 * 2) 从精选博客（Español con Juan 博客 / Habla Cultura / Notes in Spanish）与新闻（BBC Mundo / RFI）
 *    抓取全文，严格校验段落完整性（>=4 段、>=85 词，排除仅标题/摘要/防爬碎片），区分全文与节选；
 * 3) 调用 DeepSeek 逐篇生成真实「中文标题 + 一句具体看点 + 主题 + 单篇难度（依据不足允许 null）」，
 *    杜绝旧版「来源名 · 真实西语阅读」占位标题；
 * 4) 写入 `src/data/spanish-lectura-catalog.json`，并支持 `--sync-db` 同步入 Postgres `lectura_catalog`。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assessArticleBody,
  inferCuratedStoryTopic
} from "../src/lib/lectura/catalog-logic.ts";
import {
  decodeHtmlEntities,
  extractArticleParagraphsFromHtml,
  extractArticleParagraphsFromMarkdown,
  extractCoverUrlFromRssBlock,
  extractOgImageFromHtml,
  stripHtmlToText
} from "../src/lib/rss-extract.ts";

// 加载 .env
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)="?([^"\r\n]*)"?$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const args = process.argv.slice(2);
const syncDb = args.includes("--sync-db");

function stableHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function extractXmlTag(block, tag) {
  const escaped = tag.replace(":", "\\:");
  const match = block.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i")
  );
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function extractEnclosure(block) {
  const match = block.match(/<enclosure\b([^>]*)\/?>/i);
  if (!match) return null;
  const url = match[1].match(/\burl=["']([^"']+)["']/i)?.[1];
  return url ? decodeHtmlEntities(url) : null;
}

function parseFeedItems(xml, limit) {
  const firstItemIdx = xml.search(/<item\b/i);
  const header = firstItemIdx >= 0 ? xml.slice(0, firstItemIdx) : xml.slice(0, 8000);
  const channelCover = extractCoverUrlFromRssBlock(header);
  const items = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    if (items.length >= limit) break;
    const block = m[1];
    const title = stripHtmlToText(extractXmlTag(block, "title"));
    const link = extractXmlTag(block, "link");
    if (!title || !link) continue;
    const pubDate = extractXmlTag(block, "pubDate");
    const description = stripHtmlToText(extractXmlTag(block, "description"));
    const contentHtml = extractXmlTag(block, "content:encoded") || extractXmlTag(block, "description");
    const audioUrl = extractEnclosure(block);
    const coverUrl = extractCoverUrlFromRssBlock(block, contentHtml, link) || channelCover;
    items.push({ title, link, pubDate, description, contentHtml, audioUrl, coverUrl });
  }
  return items;
}

async function fetchFullParagraphs(sourceUrl, inlineParagraphs) {
  let ogImage = null;
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const html = await res.text();
      ogImage = extractOgImageFromHtml(html, sourceUrl);
      const extracted = extractArticleParagraphsFromHtml(html, 120);
      if (extracted.length >= 4) {
        return { paragraphs: extracted, ogImage };
      }
    }
  } catch {
    // Fallback to Jina Reader
  }

  try {
    const jinaRes = await fetch(`https://r.jina.ai/${sourceUrl}`, {
      headers: { "User-Agent": "EsponalReader/1.0", Accept: "text/plain" },
      signal: AbortSignal.timeout(10000)
    });
    if (jinaRes.ok) {
      const md = await jinaRes.text();
      const extracted = extractArticleParagraphsFromMarkdown(md, 120);
      if (extracted.length >= 4) {
        return { paragraphs: extracted, ogImage };
      }
    }
  } catch {
    // Fallback to inline RSS content
  }

  return { paragraphs: inlineParagraphs, ogImage };
}

async function enrichChineseMetadata({ title, sourceLabel, contentKind, paragraphs }) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";

  const preview = paragraphs.slice(0, 4).join("\n").slice(0, 1200);
  if (!apiKey) {
    return {
      titleZh: title,
      summaryZh: `${sourceLabel} 原文阅读，共 ${paragraphs.length} 段。`,
      topic: contentKind === "news" ? "时事热点" : "生活文化",
      level: null,
      levelSource: null
    };
  }

  const prompt = [
    "你是面向中文西班牙语学习者的编辑。请根据以下西语文章标题和正文前几段，输出严格 JSON（不要 markdown 代码块）：",
    "{",
    '  "titleZh": "吸引人、自然准确的中文主标题（10-24字，直接概括主题，禁止出现\'真实西语阅读\'或媒体名）",',
    '  "summaryZh": "一句具体中文看点（20-45字，告诉读者这篇具体讲了什么故事/话题）",',
    '  "topic": "从以下严格选一：生活文化 | 日常故事 | 旅行探索 | 饮食风味 | 语言成长 | 时事热点",',
    '  "level": "A1 或 A2 或 B1，如果难以明确判断则输出 null",',
    '  "worthReading": true 或 false（如果是广告促销/纯课程推销/碎片通知则 false）',
    "}",
    "",
    `来源：${sourceLabel}（${contentKind}）`,
    `原标题：${title}`,
    `正文节选：\n${preview}`
  ].join("\n");

  try {
    const r = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }]
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    const validLevel = parsed.level === "A1" || parsed.level === "A2" || parsed.level === "B1" ? parsed.level : null;
    return {
      worthReading: parsed.worthReading !== false,
      titleZh: typeof parsed.titleZh === "string" && parsed.titleZh.trim() ? parsed.titleZh.trim() : title,
      summaryZh: typeof parsed.summaryZh === "string" && parsed.summaryZh.trim() ? parsed.summaryZh.trim() : `${sourceLabel} 精选全文`,
      topic: typeof parsed.topic === "string" && parsed.topic.trim() ? parsed.topic.trim() : (contentKind === "news" ? "时事热点" : "生活文化"),
      level: validLevel,
      levelSource: validLevel ? "inferred" : null
    };
  } catch {
    return {
      worthReading: true,
      titleZh: title,
      summaryZh: `${sourceLabel} 原文阅读，共 ${paragraphs.length} 段。`,
      topic: contentKind === "news" ? "时事热点" : "生活文化",
      level: null,
      levelSource: null
    };
  }
}

// 1. 加载现有全部内置西语分级短文
const contentDir = path.join(process.cwd(), "content", "lectura");
const tsFiles = fs
  .readdirSync(contentDir)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts" && !/^(de|en|fr|ja)-/.test(f));

const catalog = [];
const seenSlugs = new Set();

for (const file of tsFiles) {
  const mod = await import(pathToFileURL(path.join(contentDir, file)).href);
  const story = Object.values(mod).find((v) => v && typeof v === "object" && "slug" in v && "paragraphs" in v);
  if (!story || (story.language && story.language !== "es")) continue;
  if (seenSlugs.has(story.slug)) continue;
  seenSlugs.add(story.slug);

  const assessed = assessArticleBody(story.paragraphs, 120);
  catalog.push({
    slug: story.slug,
    language: "es",
    contentKind: "story",
    sourceId: "esponal-curated",
    sourceLabel: story.source || "Esponal 分级短文",
    title: story.title,
    titleZh: story.titleZh,
    summaryZh: story.summaryZh,
    topic: inferCuratedStoryTopic(story),
    level: story.level ?? null,
    levelSource: "curated",
    durationMin: story.durationMin || assessed.durationMin,
    paragraphs: story.paragraphs,
    paragraphCount: story.paragraphs.length,
    isFullText: true,
    bodyStatus: "ready",
    glossary: story.glossary ?? [],
    audioUrl: null,
    audioType: "tts",
    coverUrl: null,
    sourceUrl: null,
    publishedAt: "",
    sortWeight: 10
  });
}

console.log(`Loaded ${catalog.length} built-in Spanish curated stories.`);

// 2. 抓取并严格核验西语博客（生活叙事/文化）+ 精选新闻
const SPANISH_RSS_SOURCES = [
  { id: "juan", label: "Español con Juan 博客", kind: "blog", url: "https://1001reasonstolearnspanish.com/feed/", limit: 10 },
  { id: "hablacultura", label: "Habla Cultura 文化日志", kind: "blog", url: "https://hablacultura.com/feed/", limit: 8 },
  { id: "notesinspanish", label: "Notes in Spanish", kind: "blog", url: "https://www.notesinspanish.com/feed/", limit: 6 },
  { id: "bbc", label: "BBC Mundo", kind: "news", url: "https://feeds.bbci.co.uk/mundo/rss.xml", limit: 6 },
  { id: "rfi", label: "RFI 西语之声", kind: "news", url: "https://www.rfi.fr/es/rss", limit: 5 }
];

for (const feed of SPANISH_RSS_SOURCES) {
  try {
    const r = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/126.0.0.0", Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) {
      console.warn(`Feed HTTP ${r.status}: ${feed.label}`);
      continue;
    }
    const xml = await r.text();
    const entries = parseFeedItems(xml, feed.limit);
    let kept = 0;

    for (const entry of entries) {
      const slug = `rss-${feed.id}-${stableHash(entry.link)}`;
      if (seenSlugs.has(slug)) continue;

      const inlineParas = stripHtmlToText(entry.contentHtml)
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length >= 25);

      const { paragraphs, ogImage } = await fetchFullParagraphs(entry.link, inlineParas);
      const assessed = assessArticleBody(paragraphs, 120);
      if (assessed.bodyStatus === "failed") {
        continue; // 正文不完整或仅标题摘要，绝不进入推荐池
      }

      const zhMeta = await enrichChineseMetadata({
        title: entry.title,
        sourceLabel: feed.label,
        contentKind: feed.kind,
        paragraphs: assessed.paragraphs
      });
      if (zhMeta.worthReading === false) {
        continue;
      }

      seenSlugs.add(slug);
      kept += 1;
      catalog.push({
        slug,
        language: "es",
        contentKind: feed.kind,
        sourceId: feed.id,
        sourceLabel: feed.label,
        title: entry.title,
        titleZh: zhMeta.titleZh,
        summaryZh: zhMeta.summaryZh,
        topic: zhMeta.topic,
        level: zhMeta.level,
        levelSource: zhMeta.levelSource,
        durationMin: assessed.durationMin,
        paragraphs: assessed.paragraphs,
        paragraphCount: assessed.paragraphs.length,
        isFullText: assessed.isFullText,
        bodyStatus: assessed.bodyStatus,
        glossary: [],
        audioUrl: entry.audioUrl && /^https?:\/\//i.test(entry.audioUrl) ? entry.audioUrl : null,
        audioType: entry.audioUrl ? "native" : "tts",
        coverUrl: entry.coverUrl || ogImage || null,
        sourceUrl: entry.link,
        publishedAt: entry.pubDate || "",
        sortWeight: feed.kind === "blog" ? 12 : 4
      });
    }
    console.log(`Ingested ${kept} verified ${feed.kind} articles from ${feed.label}.`);
  } catch (err) {
    console.warn(`Feed failed (${feed.label}):`, err instanceof Error ? err.message : err);
  }
}

const outPath = path.join(process.cwd(), "src", "data", "spanish-lectura-catalog.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2));

const summary = {
  total: catalog.length,
  byKind: {
    story: catalog.filter((i) => i.contentKind === "story").length,
    blog: catalog.filter((i) => i.contentKind === "blog").length,
    news: catalog.filter((i) => i.contentKind === "news").length
  },
  byLevel: {
    A1: catalog.filter((i) => i.level === "A1").length,
    A2: catalog.filter((i) => i.level === "A2").length,
    B1: catalog.filter((i) => i.level === "B1").length,
    unconfirmed: catalog.filter((i) => i.level === null).length
  },
  nativeAudio: catalog.filter((i) => i.audioType === "native").length,
  excerpts: catalog.filter((i) => !i.isFullText).length
};
console.log("Lectura catalog saved ->", outPath, summary);

if (syncDb) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  for (const item of catalog) {
    await prisma.lecturaCatalog.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        language: "es",
        contentKind: item.contentKind,
        sourceId: item.sourceId,
        sourceLabel: item.sourceLabel,
        title: item.title,
        titleZh: item.titleZh,
        summaryZh: item.summaryZh,
        topic: item.topic,
        level: item.level,
        levelSource: item.levelSource ?? null,
        durationMin: item.durationMin,
        paragraphs: item.paragraphs,
        paragraphCount: item.paragraphCount,
        isFullText: item.isFullText,
        bodyStatus: item.bodyStatus,
        glossary: item.glossary ?? [],
        audioUrl: item.audioUrl ?? null,
        audioType: item.audioType,
        coverUrl: item.coverUrl ?? null,
        sourceUrl: item.sourceUrl ?? null,
        publishedAt: item.publishedAt ?? "",
        sortWeight: item.sortWeight ?? 0,
        isActive: true
      },
      update: {
        contentKind: item.contentKind,
        sourceLabel: item.sourceLabel,
        title: item.title,
        titleZh: item.titleZh,
        summaryZh: item.summaryZh,
        topic: item.topic,
        level: item.level,
        levelSource: item.levelSource ?? null,
        durationMin: item.durationMin,
        paragraphs: item.paragraphs,
        paragraphCount: item.paragraphCount,
        isFullText: item.isFullText,
        bodyStatus: item.bodyStatus,
        audioUrl: item.audioUrl ?? null,
        audioType: item.audioType,
        coverUrl: item.coverUrl ?? null,
        sortWeight: item.sortWeight ?? 0,
        isActive: true
      }
    });
  }
  await prisma.$disconnect();
  console.log("Synced LecturaCatalog to Postgres.");
}

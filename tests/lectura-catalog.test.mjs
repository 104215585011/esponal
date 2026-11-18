// Timestamp: 2026-11-18 11:30
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assessArticleBody,
  mixLecturaRecommendations,
  recommendNextLecturaStory
} from "../src/lib/lectura/catalog-logic.ts";

test("LecturaCatalog & LecturaRead progress schema and migration exist", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const migration = await readFile(
    "prisma/migrations/20261118113000_add_lectura_catalog_and_progress/migration.sql",
    "utf8"
  );

  assert.match(schema, /model LecturaCatalog[\s\S]*contentKind[\s\S]*isFullText[\s\S]*audioType/);
  assert.match(schema, /model LecturaRead[\s\S]*lastParagraphIndex[\s\S]*completed/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "lectura_catalog"/);
  assert.match(migration, /lastParagraphIndex/);
  assert.match(migration, /completed/);
});

test("assessArticleBody validates full text beyond 35 paragraphs and rejects incomplete snippets", () => {
  const shortFail = assessArticleBody(["Solo un título corto."]);
  assert.equal(shortFail.bodyStatus, "failed");

  const fullLong = Array.from({ length: 42 }, (_, idx) =>
    `Párrafo número ${idx + 1} con suficiente contexto y vocabulario español cotidiano para leer con calma.`
  );
  const fullResult = assessArticleBody(fullLong, 120);
  assert.equal(fullResult.bodyStatus, "ready");
  assert.equal(fullResult.isFullText, true);
  assert.equal(fullResult.paragraphs.length, 42);
});

test("mixLecturaRecommendations places blogs & stories ahead of news rather than burying them", () => {
  const items = [
    { slug: "n1", contentKind: "news", level: "B1", durationMin: 4 },
    { slug: "n2", contentKind: "news", level: "B1", durationMin: 5 },
    { slug: "s1", contentKind: "story", level: "A1", durationMin: 3 },
    { slug: "b1", contentKind: "blog", level: "A2", durationMin: 3 },
    { slug: "s2", contentKind: "story", level: "A2", durationMin: 3 }
  ];
  const mixed = mixLecturaRecommendations(items);
  assert.notEqual(mixed[0].contentKind, "news");
  assert.equal(mixed.length, 5);
});

test("recommendNextLecturaStory matches adjacent level, related topic, and saved vocabulary words", () => {
  const current = {
    slug: "c1",
    language: "es",
    title: "En el mercado",
    titleZh: "去集市买菜",
    summaryZh: "周末买菜故事",
    topic: "饮食风味",
    level: "A2",
    durationMin: 3,
    contentKind: "story"
  };

  const rec = recommendNextLecturaStory({
    current,
    candidates: [
      current,
      {
        slug: "other-topic",
        language: "es",
        title: "Noticia de economía",
        titleZh: "经济新闻",
        summaryZh: "汇率变动",
        topic: "时事热点",
        level: "B1",
        durationMin: 6,
        contentKind: "news",
        paragraphs: ["El mercado financiero cerró con cambios moderados esta semana."]
      },
      {
        slug: "ideal-next",
        language: "es",
        title: "Desayuno con café",
        titleZh: "早餐和咖啡",
        summaryZh: "西班牙人的早餐日常",
        topic: "饮食风味",
        level: "A2",
        durationMin: 3,
        contentKind: "blog",
        paragraphs: ["Cada mañana preparo una tostada con aceite de oliva y café caliente."]
      }
    ],
    completedSlugs: new Set(),
    savedWords: ["tostada", "aceite"]
  });

  assert.equal(rec?.slug, "ideal-next");
  assert.ok(rec?.matchedWords.includes("tostada"));
});

test("Lectura API routes and Web pages wire shared catalog, progress, and completion flow", async () => {
  const storiesRoute = await readFile("src/app/api/lectura/stories/route.ts", "utf8");
  assert.match(storiesRoute, /continueReading/);
  assert.match(storiesRoute, /getLecturaFeedForUser/);

  const readRoute = await readFile("src/app/api/lectura/[slug]/read/route.ts", "utf8");
  assert.match(readRoute, /isProgressOnly/);
  assert.match(readRoute, /nextStory/);

  const pageSrc = await readFile("src/app/lectura/page.tsx", "utf8");
  assert.match(pageSrc, /LecturaDiscoveryClient/);
  assert.match(pageSrc, /getLecturaFeedForUser/);

  const readerSrc = await readFile("src/app/lectura/LecturaReader.tsx", "utf8");
  assert.match(readerSrc, /读完了/);
  assert.match(readerSrc, /reportProgress/);
});

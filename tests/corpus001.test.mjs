// Timestamp: 2026-06-03 10:05
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("CORPUS-001 adds video history and saved phrase data models", async () => {
  const schema = await readText("prisma/schema.prisma");

  assert.match(schema, /videoViews\s+VideoView\[\]/);
  assert.match(schema, /savedPhrases\s+SavedPhrase\[\]/);
  assert.match(schema, /model\s+VideoView\s*\{[\s\S]*userId\s+String[\s\S]*videoId\s+String[\s\S]*title\s+String[\s\S]*channelTitle\s+String[\s\S]*thumbnail\s+String\?[\s\S]*viewedAt\s+DateTime[\s\S]*@@unique\(\[userId,\s*videoId\]\)[\s\S]*@@index\(\[userId,\s*viewedAt\]\)[\s\S]*@@map\("video_views"\)[\s\S]*\}/);
  assert.match(schema, /model\s+SavedPhrase\s*\{[\s\S]*userId\s+String[\s\S]*lemma\s+String[\s\S]*kind\s+LexiconKind[\s\S]*data\s+Json\?[\s\S]*createdAt\s+DateTime[\s\S]*@@unique\(\[userId,\s*lemma,\s*kind\]\)[\s\S]*@@index\(\[userId,\s*createdAt\]\)[\s\S]*@@map\("saved_phrases"\)[\s\S]*\}/);

  const migrations = await readText("prisma/migrations/20260603095000_add_corpus_models/migration.sql");
  assert.match(migrations, /CREATE TABLE "video_views"/);
  assert.match(migrations, /CREATE UNIQUE INDEX "video_views_userId_videoId_key"/);
  assert.match(migrations, /CREATE TABLE "saved_phrases"/);
  assert.match(migrations, /CREATE UNIQUE INDEX "saved_phrases_userId_lemma_kind_key"/);
});

test("CORPUS-001 exposes protected video history API without YouTube list calls", async () => {
  const routePath = "src/app/api/watch/history/route.ts";
  assert.equal(existsSync(routePath), true);
  const route = await readText(routePath);
  const helper = await readText("src/lib/corpus.ts");

  assert.match(route, /export async function POST/);
  assert.match(route, /export async function GET/);
  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /checkRateLimit[\s\S]*addLimiter|addLimiter[\s\S]*checkRateLimit/);
  assert.match(route, /videoId/);
  assert.match(route, /title/);
  assert.match(route, /channelTitle/);
  assert.match(route, /upsertVideoView/);
  assert.match(route, /getVideoViewsByUser/);
  assert.doesNotMatch(route, /fetchYouTubeJson|\/api\/youtube|youtube\/search|youtube\/channel/);

  assert.match(helper, /prisma\.videoView\.upsert/);
  assert.match(helper, /userId_videoId/);
  assert.match(helper, /viewedAt:\s*new Date\(\)/);
  assert.match(helper, /orderBy:\s*\{\s*viewedAt:\s*"desc"/);
});

test("CORPUS-001 watch player records authenticated history on page open", async () => {
  const client = await readText("src/app/watch/WatchClient.tsx");

  assert.match(client, /\/api\/watch\/history/);
  assert.match(client, /method:\s*"POST"/);
  assert.match(client, /videoId/);
  assert.match(client, /videoInfo\.title/);
  assert.match(client, /videoInfo\.channelTitle/);
  assert.match(client, /img\.youtube\.com\/vi/);
  assert.match(client, /response\.status === 401/);
});

test("CORPUS-001 exposes protected saved phrase API", async () => {
  const routePath = "src/app/api/vocab/phrase/add/route.ts";
  assert.equal(existsSync(routePath), true);
  const route = await readText(routePath);
  const helper = await readText("src/lib/corpus.ts");

  assert.match(route, /export async function POST/);
  assert.match(route, /export async function GET/);
  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /"collocation"[\s\S]*"phrase"[\s\S]*"idiom"/);
  assert.match(route, /invalid phrase kind/);
  assert.match(route, /savePhraseForUser/);
  assert.match(route, /getSavedPhrasesByUser/);
  assert.match(helper, /prisma\.savedPhrase\.upsert/);
  assert.match(helper, /userId_lemma_kind/);
});

test("CORPUS-001 LookupCard lets phrase lookups be saved separately from words", async () => {
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");

  assert.match(lookupCard, /\/api\/vocab\/phrase\/add/);
  assert.match(lookupCard, /isPhraseLookup/);
  assert.match(lookupCard, /handleSavePhrase/);
  assert.match(lookupCard, /phraseKind/);
  assert.match(lookupCard, /收藏短语|鏀惰棌鐭/);
  assert.doesNotMatch(lookupCard, /lookupKind === "phrase"[\s\S]{0,200}handleAddToVocab/);
});

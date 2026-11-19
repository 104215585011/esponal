// Timestamp: 2026-11-19 17:10
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTimedTextXml,
  pickPreferredCaptionTrack
} from "../src/lib/youtube-subtitles.ts";

test("subtitle ingest route accepts authenticated mobile/web users alongside extension token", async () => {
  const route = await readFile("src/app/api/subtitle/ingest/route.ts", "utf8");

  assert.match(route, /getOptionalUserId/);
  assert.match(route, /client_youtube/);
  assert.match(route, /Authorization/);
  assert.match(route, /recordCatalogSubtitleVerification/);
  assert.doesNotMatch(route, /redis\.get/);
});

test("subtitle route surfaces Supadata quota/provider failures instead of masking all failures as no_subtitle", async () => {
  const route = await readFile("src/app/api/subtitle/route.ts", "utf8");

  assert.match(route, /provider_unavailable/);
  assert.match(route, /quota_exceeded/);
  assert.match(route, /client_youtube/);
  assert.match(route, /failureReason/);
});

test("youtube-subtitles parser handles format-3 and legacy timedtext XML and prefers manual tracks", () => {
  const xml3 =
    '<timedtext format="3"><body><p t="1500" d="2400"><s>Hola </s><s>mundo &amp; amigos</s></p></body></timedtext>';
  const cues3 = parseTimedTextXml(xml3);
  assert.equal(cues3.length, 1);
  assert.equal(cues3[0].start, 1.5);
  assert.equal(cues3[0].dur, 2.4);
  assert.equal(cues3[0].text, "Hola mundo & amigos");

  const xmlLegacy = '<transcript><text start="3.5" dur="1.8">Buenos d&#237;as</text></transcript>';
  const cuesLegacy = parseTimedTextXml(xmlLegacy);
  assert.equal(cuesLegacy.length, 1);
  assert.equal(cuesLegacy[0].text, "Buenos días");

  const picked = pickPreferredCaptionTrack(
    [
      { languageCode: "es", kind: "asr", baseUrl: "https://example.com/asr" },
      { languageCode: "es-419", baseUrl: "https://example.com/manual-419" },
      { languageCode: "en", baseUrl: "https://example.com/en" }
    ],
    "es"
  );
  assert.equal(picked?.baseUrl, "https://example.com/manual-419");

  const asrPicked = pickPreferredCaptionTrack(
    [{ languageCode: "es", kind: "asr", baseUrl: "https://example.com/asr" }],
    "es"
  );
  assert.equal(asrPicked?.baseUrl, "https://example.com/asr");
});

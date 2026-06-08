import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-2 adds an OCR provider module plus credits config and ledger label coverage", async () => {
  const ocrPath = "src/lib/import/ocr.ts";
  assert.equal(existsSync(ocrPath), true, `${ocrPath} missing`);

  const [ocrSource, configSource, labelsSource] = await Promise.all([
    read(ocrPath),
    read("src/lib/credits/config.ts"),
    read("src/lib/credits/labels.ts"),
  ]);

  assert.match(ocrSource, /export const OCR_PAGE_LIMIT\s*=\s*300/);
  assert.match(ocrSource, /export async function runOcr/);
  assert.match(ocrSource, /fetch\(/);

  assert.match(configSource, /ocr_per_page/);
  assert.match(labelsSource, /ocr:\s*"扫描件文字识别"/);
});

test("IMPORT-2 routes scanned-PDF OCR through credit guards and explicit OCR failure reasons", async () => {
  const [processSource, fileRouteSource] = await Promise.all([
    read("src/lib/import/process.ts"),
    read("src/app/api/import/file/route.ts"),
  ]);

  assert.match(fileRouteSource, /userId:\s*userId/);

  assert.match(processSource, /requireCredits/);
  assert.match(processSource, /spendCredits/);
  assert.match(processSource, /ACTION_COST_MINOR\.ocr_per_page/);
  assert.match(processSource, /error instanceof NeedsOcrError/);
  assert.match(processSource, /error\.pageCount/);
  assert.match(processSource, /refType:\s*"ocr"|"ocr"/);
  assert.match(processSource, /failReason:\s*"insufficient_credits"/);
  assert.match(processSource, /failReason:\s*"ocr_page_limit"/);
  assert.match(processSource, /failReason:\s*"ocr_failed"/);
});

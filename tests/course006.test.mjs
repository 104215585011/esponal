import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

async function readText(path) {
  return readFileSync(path, "utf8");
}

test("COURSE-006 adds a dissect analyze API with implied-subject JSON contract", async () => {
  const routePath = "src/app/api/dissect/analyze/route.ts";
  assert.ok(existsSync(routePath), "analyze route should exist");

  const route = await readText(routePath);

  assert.match(route, /POST/);
  assert.match(route, /sentence/);
  assert.match(route, /tokens/);
  assert.match(route, /impliedSubject/);
  assert.match(route, /naturalEnglish/);
  assert.match(route, /insertBeforeIndex/);
  assert.match(route, /json/);
  assert.match(route, /400/);
});

test("COURSE-006 analysis model and fallback heuristics cover the new implied-subject cases", async () => {
  const analysis = await readText("src/app/dissect/analysis.ts");

  assert.match(analysis, /type ImpliedSubjectType = "prodrop" \| "impersonal" \| "existential" \| "se_impersonal"/);
  assert.match(analysis, /type: ImpliedSubjectType/);
  assert.match(analysis, /inversionNote\?: "gustar"/);
  assert.match(analysis, /pronoun: "ello"/);
  assert.match(analysis, /english: "it"/);
  assert.match(analysis, /pronoun: "there"/);
  assert.match(analysis, /english: "there"/);
  assert.match(analysis, /pronoun: "se"/);
  assert.match(analysis, /english: "one"/);
  assert.match(analysis, /type: "impersonal"/);
  assert.match(analysis, /type: "existential"/);
  assert.match(analysis, /type: "se_impersonal"/);
  assert.match(analysis, /type: "prodrop"/);
  assert.match(analysis, /detectGustarInversion/);
  assert.match(analysis, /hace/);
  assert.match(analysis, /hay/);
  assert.match(analysis, /gusta/);
  assert.match(analysis, /eres/);
});

test("COURSE-006 prompt and client source lock the new implied-subject cases and gustar note UI", async () => {
  const route = await readText("src/app/api/dissect/analyze/route.ts");
  const client = await readText("src/app/dissect/DissectorClient.tsx");

  assert.match(route, /CASE 1 - Personal pro-drop/);
  assert.match(route, /CASE 2 - Impersonal weather/);
  assert.match(route, /CASE 3 - Impersonal es\/parece\/resulta \+ adj\/clause/);
  assert.match(route, /CASE 4 - Existential hay/);
  assert.match(route, /CASE 5 - Se impersonal \/ pasiva refleja/);
  assert.match(route, /CASE 6 - Gustar-type inversion/);
  assert.match(route, /inversionNote/);
  assert.match(route, /type: "prodrop"/);
  assert.match(route, /type: "impersonal"/);
  assert.match(route, /type: "existential"/);
  assert.match(route, /type: "se_impersonal"/);

  assert.match(client, /analysis/);
  assert.match(client, /"loading"/);
  assert.match(client, /"error"/);
  assert.match(client, /fetch\("\/api\/dissect\/analyze"/);
  assert.match(client, /setActivePopover\(null\)/);
  assert.match(client, /text-xs text-gray-400 mt-1/);
  assert.match(client, /inversionNote/);
  assert.match(client, /gustar/);
  assert.match(client, /naturalEnglish/);
  assert.match(client, /text-brand-600/);
  assert.match(client, /impliedSubject/);
});

test("COURSE-006 interlinear gloss UI uses aligned token columns and separate natural English footer", async () => {
  const client = await readText("src/app/dissect/DissectorClient.tsx");

  assert.match(client, /flex flex-nowrap items-start overflow-x-auto/);
  assert.match(client, /inline-flex shrink-0 flex-col items-center/);
  assert.match(client, /min-w-\[3\.5rem\]/);
  assert.match(client, /bg-brand-50/);
  assert.match(client, /text-brand-600/);
  assert.match(client, /rounded/);
  assert.match(client, /px-1\.5/);
  assert.match(client, /italic/);
  assert.match(client, /text-brand-400/);
  assert.match(client, /text-\[10px\]/);
  assert.match(client, /text-brand-300/);
  assert.match(client, /border-t/);
});

test("COURSE-006 interlinear gloss columns do not collapse on desktop", async () => {
  const client = await readText("src/app/dissect/DissectorClient.tsx");

  assert.match(client, /shrink-0/);
  assert.match(client, /min-w-\[3\.5rem\]/);
  assert.match(client, /whitespace-nowrap/);
  assert.match(client, /break-words/);
  assert.match(client, /leading-tight/);
});

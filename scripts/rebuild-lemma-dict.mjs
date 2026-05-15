/**
 * Rebuilds extension/lemma-dict.json with real Chinese translations.
 * Sources (in priority order):
 *   1. content/curriculum/phase1-words.json
 *   2. content/curriculum/unidad-N.json vocabGroups
 *   3. Tencent TMT API for any remaining gaps
 */

import { createHash, createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const POS_MAP = {
  noun: "n.",
  verb: "v.",
  adjective: "adj.",
  adverb: "adv.",
  pronoun: "pron.",
  preposition: "prep.",
  conjunction: "conj.",
  interjection: "interj.",
  article: "art.",
  numeral: "num.",
  phrase: "",
};

// ---------- TMT helpers ----------

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function buildAuthHeader(secretId, secretKey, payload, timestamp) {
  const service = "tmt";
  const algorithm = "TC3-HMAC-SHA256";
  const date = new Date(timestamp * 1000).toISOString().split("T")[0];
  const canonicalHeaders = `content-type:application/json\nhost:tmt.tencentcloudapi.com\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST", "/", "",
    canonicalHeaders, signedHeaders, sha256Hex(payload),
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [algorithm, timestamp.toString(), credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning).update(stringToSign).digest("hex");
  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function tmtTranslate(text, secretId, secretKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ SourceText: text, Source: "es", Target: "zh", ProjectId: 0 });
  const auth = buildAuthHeader(secretId, secretKey, payload, timestamp);

  const res = await fetch("https://tmt.tencentcloudapi.com/", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Host: "tmt.tencentcloudapi.com",
      "X-TC-Action": "TextTranslate",
      "X-TC-Timestamp": timestamp.toString(),
      "X-TC-Version": "2018-03-21",
      "X-TC-Region": "ap-guangzhou",
    },
    body: payload,
  });

  const data = await res.json();
  if (data.Response?.Error) throw new Error(data.Response.Error.Message);
  return data.Response?.TargetText?.trim() ?? text;
}

// ---------- load .env manually ----------

async function loadEnv() {
  try {
    const envText = await readFile(path.join(root, ".env"), "utf8");
    const env = {};
    for (const line of envText.split("\n")) {
      const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]+)"?/);
      if (m) env[m[1]] = m[2].trim();
    }
    return env;
  } catch {
    return {};
  }
}

// ---------- main ----------

async function main() {
  const env = await loadEnv();
  const secretId = env.TENCENT_SECRET_ID;
  const secretKey = env.TENCENT_SECRET_KEY;

  if (!secretId || !secretKey) {
    console.error("❌ TENCENT_SECRET_ID / TENCENT_SECRET_KEY not found in .env");
    process.exit(1);
  }

  // 1. Load lemma-dict
  const lemmaDict = JSON.parse(
    await readFile(path.join(root, "extension/lemma-dict.json"), "utf8")
  );

  // 2. Build lookup from phase1-words.json
  const phase1 = JSON.parse(
    await readFile(path.join(root, "content/curriculum/phase1-words.json"), "utf8")
  );
  const phase1Map = {};
  for (const word of phase1.words ?? []) {
    const entry = { zh: word.chinese, pos: POS_MAP[word.partOfSpeech] ?? "" };
    phase1Map[word.spanish.toLowerCase()] = entry;
    phase1Map[word.id.toLowerCase()] = entry;
  }

  // 3. Build lookup from unit JSONs
  const unitMap = {};
  for (let i = 1; i <= 9; i++) {
    const unit = JSON.parse(
      await readFile(path.join(root, `content/curriculum/unidad-${i}.json`), "utf8")
    );
    for (const group of unit.vocabGroups ?? []) {
      for (const item of group.items ?? []) {
        if (item.es && item.zh) unitMap[item.es.toLowerCase()] = item.zh;
      }
    }
  }

  // 4. Resolve translations for each unique lemma
  const uniqueLemmas = [...new Set(Object.values(lemmaDict).map((v) => v.lemma))];
  const lemmaTranslations = {};
  const needsTMT = [];

  for (const lemma of uniqueLemmas) {
    const lower = lemma.toLowerCase();
    if (phase1Map[lower]) {
      lemmaTranslations[lemma] = phase1Map[lower];
    } else if (unitMap[lower]) {
      lemmaTranslations[lemma] = { zh: unitMap[lower], pos: "" };
    } else {
      needsTMT.push(lemma);
    }
  }

  console.log(`📚 phase1/unit 命中: ${uniqueLemmas.length - needsTMT.length}/${uniqueLemmas.length}`);
  console.log(`🔄 需要 TMT: ${needsTMT.length} 个词`);

  // 5. TMT for remaining lemmas (sequential to avoid rate limit)
  for (const lemma of needsTMT) {
    try {
      const zh = await tmtTranslate(lemma, secretId, secretKey);
      lemmaTranslations[lemma] = { zh, pos: "" };
      console.log(`  ✓ ${lemma} → ${zh}`);
    } catch (err) {
      console.warn(`  ⚠ ${lemma} TMT 失败: ${err.message}`);
      lemmaTranslations[lemma] = { zh: lemma, pos: "" };
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  // 6. Rebuild lemma-dict with real translations
  let fixed = 0;
  for (const [form, entry] of Object.entries(lemmaDict)) {
    const t = lemmaTranslations[entry.lemma];
    if (t) {
      lemmaDict[form].translation = t.zh;
      if (t.pos) lemmaDict[form].partOfSpeech = t.pos;
      // Clear corrupted morphInfo — set to empty rather than show '?'
      if (!lemmaDict[form].morphInfo || lemmaDict[form].morphInfo.includes("?")) {
        lemmaDict[form].morphInfo = "";
      }
      fixed++;
    }
  }

  // 7. Write back
  await writeFile(
    path.join(root, "extension/lemma-dict.json"),
    JSON.stringify(lemmaDict, null, 2),
    "utf8"
  );

  console.log(`\n✅ 修复完成：${fixed}/${Object.keys(lemmaDict).length} 个词形已更新`);
  console.log("📁 extension/lemma-dict.json 已写回");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

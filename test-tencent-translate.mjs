import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

// Load .env manually
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^"|"$/g, "")];
    })
);

const SECRET_ID = env.TENCENT_SECRET_ID;
const SECRET_KEY = env.TENCENT_SECRET_KEY;

if (!SECRET_ID || !SECRET_KEY) {
  console.error("TENCENT_SECRET_ID or TENCENT_SECRET_KEY not found in .env");
  process.exit(1);
}

const HOST = "tmt.tencentcloudapi.com";

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function buildAuth(payload, timestamp) {
  const service = "tmt";
  const algorithm = "TC3-HMAC-SHA256";
  const date = new Date(timestamp * 1000).toISOString().split("T")[0];

  const canonicalHeaders = `content-type:application/json\nhost:${HOST}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST", "/", "",
    canonicalHeaders, signedHeaders,
    sha256Hex(payload)
  ].join("\n");

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [algorithm, timestamp.toString(), credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const secretDate = hmacSha256(`TC3${SECRET_KEY}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning).update(stringToSign).digest("hex");

  return `${algorithm} Credential=${SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

const text = "Hola, ¿cómo estás? Estoy aprendiendo español.";
const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({ SourceText: text, Source: "es", Target: "zh", ProjectId: 0 });

console.log("Translating:", text);

const response = await fetch(`https://${HOST}/`, {
  method: "POST",
  headers: {
    Authorization: buildAuth(payload, timestamp),
    "Content-Type": "application/json",
    Host: HOST,
    "X-TC-Action": "TextTranslate",
    "X-TC-Timestamp": timestamp.toString(),
    "X-TC-Version": "2018-03-21",
    "X-TC-Region": "ap-guangzhou"
  },
  body: payload
});

const data = await response.json();
console.log("Response:", JSON.stringify(data, null, 2));

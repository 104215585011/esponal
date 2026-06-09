// Timestamp: 2026-06-09 12:20
import { createHash, createHmac } from "node:crypto";

type PresignInput = {
  key: string;
  contentType?: string;
  responseContentDisposition?: string;
  responseContentType?: string;
  expiresSeconds?: number;
};

const DEFAULT_GET_EXPIRES_SECONDS = 900;
const DEFAULT_PUT_EXPIRES_SECONDS = 900;

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodeKeyPath(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildCanonicalQuery(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function signingKey(secretKey: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

async function presign(method: "DELETE" | "GET" | "PUT", input: PresignInput) {
  const secretId = readRequiredEnv("COS_SECRET_ID");
  const secretKey = readRequiredEnv("COS_SECRET_KEY");
  const bucket = readRequiredEnv("COS_BUCKET");
  const region = readRequiredEnv("COS_REGION");

  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = `${bucket}.cos.${region}.myqcloud.com`;
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const expiresSeconds = input.expiresSeconds ?? (method === "GET" ? DEFAULT_GET_EXPIRES_SECONDS : DEFAULT_PUT_EXPIRES_SECONDS);
  const canonicalUri = `/${encodeKeyPath(input.key)}`;
  const signedHeaders = "host";
  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${secretId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  if (input.responseContentDisposition) {
    queryParams["response-content-disposition"] = input.responseContentDisposition;
  }
  if (input.responseContentType) {
    queryParams["response-content-type"] = input.responseContentType;
  }
  const query = buildCanonicalQuery(queryParams);
  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    `host:${host}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretKey, dateStamp, region))
    .update(stringToSign)
    .digest("hex");

  return `https://${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

export async function presignPut(input: PresignInput) {
  return presign("PUT", {
    ...input,
    expiresSeconds: input.expiresSeconds ?? DEFAULT_PUT_EXPIRES_SECONDS,
  });
}

export async function presignGet(input: Omit<PresignInput, "contentType">) {
  return presign("GET", {
    ...input,
    expiresSeconds: input.expiresSeconds ?? DEFAULT_GET_EXPIRES_SECONDS,
  });
}

export async function presignDelete(input: Omit<PresignInput, "contentType">) {
  return presign("DELETE", {
    ...input,
    expiresSeconds: input.expiresSeconds ?? DEFAULT_GET_EXPIRES_SECONDS,
  });
}

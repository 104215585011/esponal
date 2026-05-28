// Timestamp: 2026-05-28 19:48
import { readFile } from "node:fs/promises";

export function parseEnvText(text) {
  const entries = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) entries[key] = value;
  }
  return entries;
}

export function applyEnv(entries, target = process.env) {
  for (const [key, value] of Object.entries(entries)) {
    if (target[key] === undefined) target[key] = value;
  }
}

export async function loadEnvFiles(paths = [".env.local", ".env"]) {
  for (const path of paths) {
    try {
      applyEnv(parseEnvText(await readFile(path, "utf8")));
    } catch {
      // Missing local env files are normal for CI and tests.
    }
  }
}


// Timestamp: 2026-11-18 10:58
export const ADMIN_FEATURES = {
  talk: "AI 对话",
  subtitle: "生成视频字幕",
  import: "导入文档"
} as const;

export type AdminFeature = keyof typeof ADMIN_FEATURES;

export function parseAdminChange(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const { action, value, reason: rawReason, feature, enabled, limit } = input as Record<string, unknown>;
  const reason = typeof rawReason === "string" ? rawReason.trim() : "";
  if (!reason || reason.length > 300) return null;

  if (action === "policy") {
    if (typeof feature !== "string" || !Object.hasOwn(ADMIN_FEATURES, feature) || typeof enabled !== "boolean") return null;
    if (limit !== null && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100000)) return null;
    return { action, feature: feature as AdminFeature, enabled, limit, reason } as const;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (action === "credits" && value !== 0 && Math.abs(value) <= 100000000) return { action, value, reason } as const;
  if (action === "extend" && value > 0 && value <= 3650) return { action, value, reason } as const;
  return null;
}

export function adminDayStart(now = new Date()) {
  return new Date(Math.floor((now.getTime() + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000);
}

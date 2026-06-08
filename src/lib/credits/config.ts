// Timestamp: 2026-06-08 16:16
export type Plan =
  | "free"
  | "premium_m"
  | "premium_y"
  | "ultra_m"
  | "ultra_y"
  | "lifetime_premium"
  | "lifetime_ultra";

export type CreditSource = "free" | "subscription" | "lifetime";

export type PlanConfig = {
  monthlyMinor: number;
  source: CreditSource;
};

export const MINOR = 100;

export function toMinor(credits: number): number {
  return Math.round(credits * MINOR);
}

export function toDisplay(minor: number): number {
  return minor / MINOR;
}

export const SIGNUP_GRANT_MINOR = toMinor(50);

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: { monthlyMinor: 0, source: "free" },
  premium_m: { monthlyMinor: toMinor(500), source: "subscription" },
  premium_y: { monthlyMinor: toMinor(500), source: "subscription" },
  ultra_m: { monthlyMinor: toMinor(1000), source: "subscription" },
  ultra_y: { monthlyMinor: toMinor(1000), source: "subscription" },
  lifetime_premium: { monthlyMinor: toMinor(500), source: "lifetime" },
  lifetime_ultra: { monthlyMinor: toMinor(1000), source: "lifetime" },
};

// TODO calibrate against real provider cost + target gross margin.
export const ACTION_COST_MINOR = {
  talk_turn: toMinor(0.5),
  tts: toMinor(0.1),
  lookup_fallback: toMinor(0.1),
  phrase_extract_per_sentence: toMinor(0.05),
  ocr_per_page: toMinor(0.1),
  // 视频字幕解锁:统一 0.5/次(不再按时长分档;三键暂保留以兼容路由分档逻辑)
  video_unlock_short: toMinor(0.5),
  video_unlock_mid: toMinor(0.5),
  video_unlock_long: toMinor(0.5),
};

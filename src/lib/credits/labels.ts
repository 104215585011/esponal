// Timestamp: 2026-06-05 14:48
type CreditReason = "grant" | "refill" | "spend";

const SPEND_LABELS: Record<string, string> = {
  talk_turn: "AI 对话",
  tts: "发音朗读",
  lookup_fallback: "查词(AI 回落)",
  phrase_extract: "短语提取",
  phrase_extract_per_sentence: "短语提取",
  video_unlock_short: "视频字幕解锁 · 短片",
  video_unlock_mid: "视频字幕解锁 · 中片",
  video_unlock_long: "视频字幕解锁 · 长片",
};

export function getCreditTransactionLabel(reason: CreditReason, refType?: string | null) {
  if (reason === "grant") {
    return refType === "signup" || !refType ? "注册赠送" : "配额赠送";
  }

  if (reason === "refill") {
    return "月度配额补充";
  }

  if (!refType) {
    return "配额消费";
  }

  if (refType.startsWith("phrase_extract")) {
    return SPEND_LABELS.phrase_extract;
  }

  if (refType.startsWith("video_unlock")) {
    return SPEND_LABELS[refType] ?? "视频字幕解锁";
  }

  return SPEND_LABELS[refType] ?? "配额消费";
}

export function getCreditTransactionTone(deltaMinor: number) {
  return deltaMinor >= 0 ? "plus" : "minus";
}

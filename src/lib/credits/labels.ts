// Timestamp: 2026-06-08 16:16
type CreditReason = "grant" | "refill" | "spend";

const SPEND_LABELS: Record<string, string> = {
  talk: "AI 对话",
  tts: "发音朗读",
  lookup: "查词(AI 回落)",
  phrase: "短语提取",
  ocr: "扫描件文字识别",
  subtitle: "视频字幕解锁",
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

  return SPEND_LABELS[refType] ?? "配额消费";
}

export function getCreditTransactionTone(deltaMinor: number) {
  return deltaMinor >= 0 ? "plus" : "minus";
}

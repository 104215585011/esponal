import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { ACTION_COST_MINOR, type Plan } from "@/lib/credits/config";
import { requireCredits, requirePlan } from "@/lib/credits/runtime";
import { spendCredits } from "@/lib/credits/service";
import { detectPhrasesInText } from "@/lib/lexicon-phrases";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";

type DetectPhrasesBody = {
  text?: unknown;
};

const PHRASE_PLANS: Plan[] = [
  "premium_m",
  "premium_y",
  "ultra_m",
  "ultra_y",
  "lifetime_premium",
  "lifetime_ultra"
];

function latencyMs(startedAt: number) {
  return String(Math.max(0, Math.round(performance.now() - startedAt)));
}

function creditsErrorMessage(code: "UNAUTHORIZED" | "INSUFFICIENT_CREDITS" | "PLAN_UPGRADE_REQUIRED") {
  if (code === "UNAUTHORIZED") return "请先登录后再使用该功能";
  if (code === "PLAN_UPGRADE_REQUIRED") return "当前套餐暂不支持句子拆解";
  return "积分不足，请先充值或等待下月刷新";
}

function countBillableSentences(text: string) {
  const segments = text
    .split(/[.!?。！？\n]+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return Math.max(1, segments.length);
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const session = await getServerSession(getAuthOptions()).catch(() => null);
  const userId =
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null;
  const rateLimit = await checkRateLimit(addLimiter, request, userId);

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);
    return NextResponse.json(
      { error: "rate limited", retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) }
      }
    );
  }

  const body = (await request.json().catch(() => ({}))) as DetectPhrasesBody;
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400, headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
    );
  }

  if (text.length > 5000) {
    return NextResponse.json(
      { error: "text is too long" },
      { status: 400, headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
    );
  }

  const planGuard = await requirePlan(userId, PHRASE_PLANS);
  if (!planGuard.ok) {
    const code = planGuard.code;
    const status = code === "UNAUTHORIZED" ? 401 : 402;
    return NextResponse.json(
      { error: { code, message: creditsErrorMessage(code) } },
      { status, headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
    );
  }

  const costMinor = ACTION_COST_MINOR.phrase_extract_per_sentence * countBillableSentences(text);
  const creditGuard = await requireCredits(userId, costMinor);
  if (!creditGuard.ok) {
    const code = creditGuard.code;
    const status = code === "UNAUTHORIZED" ? 401 : 402;
    return NextResponse.json(
      { error: { code, message: creditsErrorMessage(code) } },
      { status, headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
    );
  }

  const spans = await detectPhrasesInText(text);
  const spendResult = await spendCredits(
    userId!,
    costMinor,
    "phrase",
    `sentences:${countBillableSentences(text)}`
  );

  if (!spendResult.ok) {
    console.warn("Phrase detect credit spend skipped after successful detection", {
      userId,
      costMinor,
      balanceMinor: spendResult.balanceMinor
    });
  }

  return NextResponse.json(
    { spans },
    { headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
  );
}

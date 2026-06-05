// Timestamp: 2026-06-05 11:05
import { prisma } from "@/lib/prisma";
import { getCreditSummary, type CreditSummary } from "./summary";

export const FREE_SAVE_LIMIT = 50;

export type SaveAccessResult =
  | { ok: true; summary: CreditSummary }
  | {
      ok: false;
      code: "SAVE_LIMIT_REACHED";
      count: number;
      limit: number;
      summary: CreditSummary;
    };

export async function assertUnlimitedSavesAccess(userId: string): Promise<SaveAccessResult> {
  const summary = await getCreditSummary(userId);

  if (summary.currentPlan !== "free") {
    return { ok: true, summary };
  }

  const [wordCount, phraseCount] = await Promise.all([
    prisma.word.count({ where: { userId } }),
    prisma.savedPhrase.count({ where: { userId } }),
  ]);
  const count = wordCount + phraseCount;

  if (count >= FREE_SAVE_LIMIT) {
    return {
      ok: false,
      code: "SAVE_LIMIT_REACHED",
      count,
      limit: FREE_SAVE_LIMIT,
      summary,
    };
  }

  return { ok: true, summary };
}

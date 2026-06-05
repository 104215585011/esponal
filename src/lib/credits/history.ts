// Timestamp: 2026-06-05 14:18
import { prisma } from "@/lib/prisma";
import { toDisplay } from "./config";

export type CreditTransactionItem = {
  id: string;
  deltaMinor: number;
  deltaDisplay: number;
  reason: "grant" | "refill" | "spend";
  refType: string | null;
  refId: string | null;
  balanceAfterMinor: number;
  balanceAfterDisplay: number;
  createdAt: string;
};

export type CreditTransactionPage = {
  items: CreditTransactionItem[];
  nextCursor: string | null;
};

type CreditTransactionQuery = {
  cursor?: string | null;
  limit?: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function normalizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

export async function getCreditTransactionsPage(
  userId: string,
  { cursor, limit = DEFAULT_LIMIT }: CreditTransactionQuery = {},
): Promise<CreditTransactionPage> {
  const safeLimit = normalizeLimit(limit);
  const rows = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: safeLimit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      deltaMinor: true,
      reason: true,
      refType: true,
      refId: true,
      balanceAfterMinor: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > safeLimit;
  const slice = hasMore ? rows.slice(0, safeLimit) : rows;

  return {
    items: slice.map((row) => ({
      id: row.id,
      deltaMinor: row.deltaMinor,
      deltaDisplay: toDisplay(row.deltaMinor),
      reason: row.reason,
      refType: row.refType,
      refId: row.refId,
      balanceAfterMinor: row.balanceAfterMinor,
      balanceAfterDisplay: toDisplay(row.balanceAfterMinor),
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? slice.at(-1)?.id ?? null : null,
  };
}

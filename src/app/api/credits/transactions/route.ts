// Timestamp: 2026-11-15 03:18
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { getAuthOptions } from "@/lib/auth";
import { getCreditTransactionsPage } from "@/lib/credits/history";

type SessionUserWithId = {
  id?: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authedId = await getAuthedUserId(request);
  const userId =
    authedId ??
    ((await getServerSession(getAuthOptions()))?.user as SessionUserWithId | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const limitValue = searchParams.get("limit");
  const limit = limitValue ? Number(limitValue) : 20;
  const page = await getCreditTransactionsPage(userId, { cursor, limit });

  return NextResponse.json(page);
}

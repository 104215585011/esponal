// Timestamp: 2026-11-18 10:58
import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getAdminAccess(request);
  const headers = { "Cache-Control": "private, no-store" };

  if (!access.user) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: access.signedIn ? 403 : 401, headers });
  }

  return NextResponse.json({ isAdmin: true }, { headers });
}

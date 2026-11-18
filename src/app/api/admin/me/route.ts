// Timestamp: 2026-11-18 10:47
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAdminUser(request);
  const headers = { "Cache-Control": "private, no-store" };

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }

  return NextResponse.json({ isAdmin: true }, { headers });
}

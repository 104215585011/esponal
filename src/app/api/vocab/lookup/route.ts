import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { lookupDictionary } from "@/lib/dictionary";
import {
  checkRateLimit,
  getRetryAfterSec,
  lookupLimiter
} from "@/lib/ratelimit";

export async function GET(request: Request) {
  const session = await getServerSession(getAuthOptions()).catch(() => null);
  const rateLimit = await checkRateLimit(
    lookupLimiter,
    request,
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null
  );

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

  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.trim() ?? "";

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  const entry = await lookupDictionary(word);

  if (!entry) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  return NextResponse.json(entry);
}

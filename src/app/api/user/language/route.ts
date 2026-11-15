// Timestamp: 2026-11-15 08:00
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_LABELS,
  normalizeLanguage,
  SUPPORTED_LANGUAGES
} from "@/lib/languages";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeLanguage: true }
  });

  const activeLanguage = normalizeLanguage(user?.activeLanguage ?? DEFAULT_LANGUAGE);
  return NextResponse.json({
    activeLanguage,
    supported: SUPPORTED_LANGUAGES.map((code) => ({
      code,
      label: LANGUAGE_LABELS[code]
    }))
  });
}

export async function PATCH(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { language?: unknown; activeLanguage?: unknown } = {};
  try {
    body = (await request.json()) as { language?: unknown; activeLanguage?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const raw =
    typeof body.activeLanguage === "string"
      ? body.activeLanguage
      : typeof body.language === "string"
        ? body.language
        : "";

  if (!isSupportedLanguage(raw)) {
    return NextResponse.json({ error: "unsupported language" }, { status: 400 });
  }

  const activeLanguage = normalizeLanguage(raw);
  await prisma.user.update({
    where: { id: userId },
    data: { activeLanguage }
  });

  return NextResponse.json({ ok: true, activeLanguage });
}

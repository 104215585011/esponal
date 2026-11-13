// Timestamp: 2026-11-14 02:55
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/api-auth";

type ReadRouteContext = {
  params: { slug: string };
};

export async function POST(request: Request, { params }: ReadRouteContext) {
  // PLATFORM-001: cookie(Web) 与 Bearer(App) 双通道
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = params.slug.trim();

  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const read = await prisma.lecturaRead.upsert({
    where: {
      userId_slug: {
        userId,
        slug
      }
    },
    create: {
      userId,
      slug
    },
    update: {
      readAt: new Date()
    }
  });

  return NextResponse.json({ ok: true, slug: read.slug, readAt: read.readAt.toISOString() });
}

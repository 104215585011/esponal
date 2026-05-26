import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ReadRouteContext = {
  params: { slug: string };
};

export async function POST(_: Request, { params }: ReadRouteContext) {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = params.slug.trim();

  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const read = await prisma.lecturaRead.upsert({
    where: {
      userId_slug: {
        userId: session.user.id,
        slug
      }
    },
    create: {
      userId: session.user.id,
      slug
    },
    update: {
      readAt: new Date()
    }
  });

  return NextResponse.json({ ok: true, slug: read.slug, readAt: read.readAt.toISOString() });
}

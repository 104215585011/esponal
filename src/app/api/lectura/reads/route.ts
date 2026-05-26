import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const reads = await prisma.lecturaRead.findMany({
    where: { userId: session.user.id },
    orderBy: { readAt: "desc" },
    select: { slug: true }
  });

  return NextResponse.json({ slugs: reads.map((read) => read.slug) });
}

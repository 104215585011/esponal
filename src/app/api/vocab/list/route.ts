// Timestamp: 2026-11-14 15:10
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * 词库列表(移动端「我的词库」)。
 *
 * 与 Web 的词库页不同:这里只返回列表需要的轻量字段(dictData 只取释义),
 * 避免整页几条 JSON 把流量和渲染都拖慢。
 *
 * 查询参数:
 * - q      模糊搜 lemma / translation
 * - bucket all | new | learning | mastered(按 FSRS reps 分档)
 * - sort   recent | alpha | due
 * - limit  默认 60,上限 200
 * - offset 分页偏移
 */

const MAX_LIMIT = 200;

function parsePositiveInt(raw: string | null, fallback: number) {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function bucketFilter(bucket: string): Prisma.WordWhereInput {
  if (bucket === "new") return { srsReps: 0 };
  if (bucket === "learning") return { srsReps: { gte: 1, lte: 2 } };
  if (bucket === "mastered") return { srsReps: { gte: 3 } };
  return {};
}

function orderFor(sort: string): Prisma.WordOrderByWithRelationInput[] {
  if (sort === "alpha") return [{ lemma: "asc" }];
  if (sort === "due") return [{ srsDue: "asc" }, { createdAt: "desc" }];
  return [{ createdAt: "desc" }];
}

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const bucket = searchParams.get("bucket") ?? "all";
  const sort = searchParams.get("sort") ?? "recent";
  const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 60) || 60, MAX_LIMIT);
  const offset = parsePositiveInt(searchParams.get("offset"), 0);

  const where: Prisma.WordWhereInput = {
    userId,
    ...bucketFilter(bucket),
    ...(q
      ? {
          OR: [
            { lemma: { contains: q, mode: "insensitive" as const } },
            { translation: { contains: q } }
          ]
        }
      : {})
  };

  const [total, words] = await Promise.all([
    prisma.word.count({ where }),
    prisma.word.findMany({
      where,
      orderBy: orderFor(sort),
      skip: offset,
      take: limit,
      select: {
        id: true,
        lemma: true,
        translation: true,
        partOfSpeech: true,
        srsDue: true,
        srsReps: true,
        srsState: true,
        createdAt: true,
        dictData: true,
        _count: { select: { encounters: true } }
      }
    })
  ]);

  return NextResponse.json({
    total,
    items: words.map((word) => {
      const dict = (word.dictData ?? null) as
        | { meanings?: unknown; phonetic?: unknown }
        | null;
      const meanings = Array.isArray(dict?.meanings)
        ? dict.meanings.filter((item): item is string => typeof item === "string").slice(0, 3)
        : [];

      return {
        id: word.id,
        lemma: word.lemma,
        translation: word.translation,
        partOfSpeech: word.partOfSpeech,
        phonetic: typeof dict?.phonetic === "string" ? dict.phonetic : null,
        meanings,
        encounterCount: word._count.encounters,
        srsDue: word.srsDue ? word.srsDue.toISOString() : null,
        srsReps: word.srsReps,
        srsState: word.srsState,
        createdAt: word.createdAt.toISOString()
      };
    })
  });
}

/** 删除一个词(连带它的 encounters,Schema 上是 Cascade) */
export async function DELETE(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // deleteMany 带上 userId:别人的词删不掉(也不会泄露"存在但无权")
  const result = await prisma.word.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deleted: result.count });
}

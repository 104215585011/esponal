// Timestamp: 2026-11-18 10:58
import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin";
import { changeAdminUser, readAdminUsage, readAdminUsers, saveAdminQuota } from "@/lib/admin-data";
import { parseAdminChange } from "@/lib/admin-input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function respond(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const access = await getAdminAccess(request);
  if (!access.user) return respond({ error: "需要管理员权限" }, access.signedIn ? 403 : 401);
  const query = new URL(request.url).searchParams;
  switch (query.get("view")) {
    case "users":
      return respond({ users: await readAdminUsers(query.get("q")?.trim().slice(0, 150) ?? "") });
    case "audit":
      return respond({ actions: await prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 50 }) });
    case "usage":
      return respond(await readAdminUsage(query.get("period") === "day" ? "day" : "month", query.get("userId")));
    default:
      return respond({ error: "未知管理视图" }, 400);
  }
}

export async function POST(request: Request) {
  const access = await getAdminAccess(request);
  if (!access.user) return respond({ error: "需要管理员权限" }, access.signedIn ? 403 : 401);
  const actor = access.user;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return respond({ error: "需要 JSON 请求" }, 415);
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return respond({ error: "无效的操作参数" }, 400);
  const input = body as Record<string, unknown>;
  try {
    if (input.action === "quota") {
      return await saveAdminQuota(actor.id, input) ? respond({ ok: true }) : respond({ error: "请核对额度和重置时间" }, 400);
    }
    const change = parseAdminChange(input);
    if (!change || typeof input.userId !== "string" || !input.userId || input.userId.length > 128) {
      return respond({ error: "请核对调整内容和原因" }, 400);
    }
    const error = await changeAdminUser(actor.id, input.userId, change);
    return error ? respond({ error }, 400) : respond({ ok: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return respond({ error: "该记录刚被修改，请刷新后重试" }, 409);
    }
    throw error;
  }
}

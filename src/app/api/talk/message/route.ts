import { NextResponse } from "next/server";
import { ACTION_COST_MINOR } from "@/lib/credits/config";
import { requireCredits } from "@/lib/credits/runtime";
import { spendCredits } from "@/lib/credits/service";
import { prisma } from "@/lib/prisma";
import { getTalkCharacterById } from "@/lib/talk/characters";
import { streamChatMessage } from "@/lib/talk/chat-service";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { getAuthedUserId } from "@/lib/api-auth";

type Body = {
  characterId?: unknown;
  message?: unknown;
  sessionId?: unknown;
};

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function creditsErrorMessage(code: string) {
  if (code === "INSUFFICIENT_CREDITS") return "积分不足，请升级后再试";
  if (code === "PLAN_UPGRADE_REQUIRED") return "当前方案暂不支持该功能";
  return "登录后再来聊";
}

const encoder = new TextEncoder();
function encodeSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) return jsonError(401, "UNAUTHORIZED", "登录后再来聊");

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, "BAD_JSON", "请求体不是合法 JSON");
  }

  const characterId = typeof body.characterId === "string" ? body.characterId : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : undefined;

  if (!characterId || !getTalkCharacterById(characterId)) {
    return jsonError(404, "CHARACTER_NOT_FOUND", "未知角色");
  }
  if (!message) {
    return jsonError(400, "EMPTY_MESSAGE", "消息不能为空");
  }
  if (message.length > 4000) {
    return jsonError(400, "MESSAGE_TOO_LONG", "单条消息最长 4000 字符");
  }

  // 验 sessionId 归属
  if (sessionId) {
    const chatSession = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId, characterId, status: "ACTIVE" }
    });
    if (!chatSession) {
      return jsonError(404, "SESSION_NOT_FOUND", "找不到该对话或无权访问");
    }
  }

  const creditGuard = await requireCredits(userId, ACTION_COST_MINOR.talk_turn);
  if (!creditGuard.ok) {
    const status = creditGuard.code === "UNAUTHORIZED" ? 401 : 402;
    return jsonError(status, creditGuard.code, creditsErrorMessage(creditGuard.code));
  }

  const encryptionSecret = getMessageEncryptionSecret();

  // 移动端(App)无法消费 SSE —— RN 的 fetch 不支持流式读取。
  // 带 Accept: application/json 时把整轮聚合后一次返回,Web 端继续走 SSE 不受影响。
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");

  if (wantsJson) {
    let streamed = "";
    let done: {
      sessionId: string;
      assistantText: string;
      corrections: unknown;
      newWords: unknown;
    } | null = null;

    try {
      for await (const event of streamChatMessage(prisma, {
        userId,
        characterId,
        message,
        sessionId,
        encryptionSecret
      })) {
        if (event.type === "delta") {
          streamed += event.text;
        } else if (event.type === "done") {
          const spendResult = await spendCredits(
            userId,
            ACTION_COST_MINOR.talk_turn,
            "talk",
            event.sessionId
          );
          if (!spendResult.ok) {
            console.warn("Talk credits spend skipped after successful turn", {
              userId,
              sessionId: event.sessionId
            });
          }
          done = {
            sessionId: event.sessionId,
            assistantText: event.assistantText || streamed,
            corrections: event.corrections,
            newWords: event.newWords
          };
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "stream failed";
      return jsonError(502, "CHAT_FAILED", message);
    }

    if (!done) {
      return jsonError(502, "NO_REPLY", "模型没有返回内容,请重试");
    }

    return NextResponse.json({
      sessionId: done.sessionId,
      reply: done.assistantText,
      corrections: done.corrections ?? [],
      newWords: done.newWords ?? []
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamChatMessage(prisma, {
          userId,
          characterId,
          message,
          sessionId,
          encryptionSecret
        })) {
          if (event.type === "delta") {
            controller.enqueue(encodeSse("delta", { text: event.text }));
          } else if (event.type === "done") {
            const spendResult = await spendCredits(
              userId,
              ACTION_COST_MINOR.talk_turn,
              "talk",
              event.sessionId
            );
            if (!spendResult.ok) {
              console.warn("Talk credits spend skipped after successful turn", {
                userId,
                sessionId: event.sessionId
              });
            }
            controller.enqueue(
              encodeSse("done", {
                sessionId: event.sessionId,
                assistantText: event.assistantText,
                corrections: event.corrections,
                newWords: event.newWords
              })
            );
          }
        }
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "stream failed";
        controller.enqueue(encodeSse("error", { message }));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}

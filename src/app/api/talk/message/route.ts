import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTalkCharacterById } from "@/lib/talk/characters";
import { streamChatMessage } from "@/lib/talk/chat-service";
import { getMessageEncryptionSecret } from "@/lib/talk/env";

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

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

const encoder = new TextEncoder();
function encodeSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getSessionUserId(session);
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

  const encryptionSecret = getMessageEncryptionSecret();

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
          } else {
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

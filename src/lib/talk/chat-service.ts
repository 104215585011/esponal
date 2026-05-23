// 聊天核心 service：SSE 流式生成 AI 回复 + 落库（加密）
// 改自 talks/src/lib/chat/chat-service.ts，主要差异：
//   - Session/Message → ChatSession/ChatMessage 表名（避开 NextAuth Session）
//   - corrections/newWords 直接是 String[] 列，不再走 metadata Json
//   - 角色不在运行时 upsert（seed 脚本一次性建好）

import type { ChatMessage, PrismaClient } from "@prisma/client";
import { decryptMessageContent, encryptMessageContent } from "./message-crypto";
import { getTalkCharacterById } from "./characters";
import {
  createModelClient,
  type ChatMessageForModel,
  type ModelClient
} from "./model-client";

export type SendChatMessageInput = {
  userId: string;
  characterId: string;
  message: string;
  sessionId?: string;
  encryptionSecret: string;
  modelClient?: ModelClient;
};

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      assistantText: string;
      sessionId: string;
      corrections: string[];
      newWords: string[];
    };

type ParsedLearningNotes = {
  assistantText: string;
  corrections: string[];
  newWords: string[];
};

const learningNotesPattern = /<learning_notes>([\s\S]*?)<\/learning_notes>/gi;
const DRAFT_SESSION_TITLE = "新会话";

export function buildInitialSessionTitle(message: string) {
  return message.replace(/\s+/g, " ").trim().slice(0, 30) || DRAFT_SESSION_TITLE;
}

export function parseStructuredLearningNotes(assistantText: string): ParsedLearningNotes {
  const matches = Array.from(assistantText.matchAll(learningNotesPattern));

  if (matches.length === 0) {
    return { assistantText, corrections: [], newWords: [] };
  }

  const lastMatch = matches[matches.length - 1];
  const rawJson = lastMatch[1]?.trim() ?? "";

  try {
    const parsed = JSON.parse(rawJson) as { corrections?: unknown; newWords?: unknown };

    return {
      assistantText: assistantText.replace(learningNotesPattern, "").trim(),
      corrections: Array.isArray(parsed.corrections)
        ? parsed.corrections.filter((item): item is string => typeof item === "string")
        : [],
      newWords: Array.isArray(parsed.newWords)
        ? parsed.newWords.filter((item): item is string => typeof item === "string")
        : []
    };
  } catch {
    return { assistantText, corrections: [], newWords: [] };
  }
}

function decryptStoredMessage(message: ChatMessage, encryptionSecret: string) {
  if (!message.contentIv || !message.contentAuthTag) {
    return message.content;
  }

  return decryptMessageContent(
    {
      content: message.content,
      contentIv: message.contentIv,
      contentAuthTag: message.contentAuthTag
    },
    encryptionSecret
  );
}

function toModelMessages(
  messages: ChatMessage[],
  encryptionSecret: string
): ChatMessageForModel[] {
  return messages
    .filter((message) => message.role !== "SYSTEM")
    .map((message) => ({
      role: message.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
      content: decryptStoredMessage(message, encryptionSecret)
    }));
}

export async function* streamChatMessage(
  prisma: PrismaClient,
  input: SendChatMessageInput
): AsyncGenerator<ChatStreamEvent> {
  const character = getTalkCharacterById(input.characterId);

  if (!character) {
    throw new Error("CHARACTER_NOT_FOUND");
  }

  const session = input.sessionId
    ? await prisma.chatSession.findFirst({
        where: { id: input.sessionId, userId: input.userId, characterId: character.id }
      })
    : await prisma.chatSession.create({
        data: {
          userId: input.userId,
          characterId: character.id,
          title: buildInitialSessionTitle(input.message)
        }
      });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const previousMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" }
  });

  if (previousMessages.length === 0 && (!session.title || session.title === DRAFT_SESSION_TITLE)) {
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { title: buildInitialSessionTitle(input.message) }
    });
  }

  const encryptedUserMessage = encryptMessageContent(input.message, input.encryptionSecret);

  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "USER",
      ...encryptedUserMessage
    }
  });

  const modelClient = input.modelClient ?? createModelClient();
  const messages: ChatMessageForModel[] = [
    ...toModelMessages(previousMessages, input.encryptionSecret),
    { role: "user", content: input.message }
  ];

  let assistantText = "";
  let corrections: string[] = [];
  let newWords: string[] = [];

  for await (const event of modelClient.streamMessage({
    characterId: character.id,
    systemPrompt: character.systemPrompt,
    messages
  })) {
    if (event.type === "delta") {
      assistantText += event.text;
      yield { type: "delta", text: event.text };
    } else {
      corrections = event.corrections;
      newWords = event.newWords;
    }
  }

  if (corrections.length === 0 && newWords.length === 0) {
    const parsed = parseStructuredLearningNotes(assistantText);
    assistantText = parsed.assistantText;
    corrections = parsed.corrections;
    newWords = parsed.newWords;
  }

  const encryptedAssistantMessage = encryptMessageContent(assistantText, input.encryptionSecret);

  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "ASSISTANT",
      ...encryptedAssistantMessage,
      corrections,
      newWords
    }
  });

  // bump session updatedAt
  await prisma.chatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() }
  });

  yield {
    type: "done",
    assistantText,
    sessionId: session.id,
    corrections,
    newWords
  };
}

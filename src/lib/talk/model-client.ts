// 模型客户端：DeepSeek（OpenAI 兼容接口）流式调用
// 改自 talks/src/lib/chat/model-client.ts；将 aicodee/MiniMax 端点换成 DeepSeek

import { getDeepseekConfig, isConfiguredSecret } from "./env";

export type ChatMessageForModel = {
  role: "user" | "assistant";
  content: string;
};

export type ModelStreamInput = {
  characterId: string;
  systemPrompt: string;
  messages: ChatMessageForModel[];
};

export type ModelStreamEvent =
  | { type: "delta"; text: string }
  | { type: "final"; corrections: string[]; newWords: string[] };

export type ModelClient = {
  streamMessage(input: ModelStreamInput): AsyncGenerator<ModelStreamEvent>;
};

const STRUCTURED_LEARNING_NOTES_INSTRUCTION = `At the very end of every reply, append exactly one machine-readable block in this format:
<learning_notes>{"corrections":["short correction when useful"],"newWords":["useful word or phrase"]}</learning_notes>
Use empty arrays only when there is genuinely no useful correction or vocabulary note. Do not wrap the block in Markdown.`;

function getFallbackReply(characterId: string, message: string) {
  if (characterId === "emma") return `Certainly. A more polished version would be: "${message}".`;
  if (characterId === "jake") return `Nice. You could say it more naturally like this: "${message}".`;
  if (characterId === "carlos") return `Órale. Una forma más natural sería: "${message}".`;
  if (characterId === "sophie") return `Très bien. On dirait plutôt : « ${message} ».`;
  if (characterId === "kenji") return `そうですね。もっと自然に言うなら：「${message}」。`;
  return `Great practice. Let us refine this sentence together: "${message}".`;
}

function cleanTitle(title: string) {
  return title
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

export async function generateSessionTitle(messages: ChatMessageForModel[]) {
  const fallback = cleanTitle(messages.find((message) => message.role === "user")?.content ?? "新会话");
  const { apiKey, baseUrl, model } = getDeepseekConfig();

  if (!isConfiguredSecret(apiKey)) {
    return fallback || "新会话";
  }

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 24,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "为这段语言学习对话生成一个中文短标题，5-10个字。只输出标题，不要标点、引号或解释。"
          },
          {
            role: "user",
            content: messages
              .slice(-8)
              .map((message) => `${message.role}: ${message.content}`)
              .join("\n")
          }
        ]
      })
    });

    if (!response.ok) return fallback || "新会话";

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const title = cleanTitle(payload.choices?.[0]?.message?.content ?? "");
    return title || fallback || "新会话";
  } catch {
    return fallback || "新会话";
  }
}

export function createModelClient(): ModelClient {
  const { apiKey, baseUrl, model } = getDeepseekConfig();

  return {
    async *streamMessage(input) {
      // 没配 key 时进入"fallback 假流"——开发期看 UI 不卡死、有合理回复
      if (!isConfiguredSecret(apiKey)) {
        const reply = getFallbackReply(input.characterId, input.messages.at(-1)?.content ?? "");
        const words = reply.split(" ");
        for (const [index, word] of words.entries()) {
          yield { type: "delta", text: index === 0 ? word : ` ${word}` };
        }
        yield { type: "final", corrections: ["Configure DEEPSEEK_API_KEY for real replies."], newWords: [] };
        return;
      }

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          stream: true,
          messages: [
            { role: "system", content: `${input.systemPrompt}\n\n${STRUCTURED_LEARNING_NOTES_INSTRUCTION}` },
            ...input.messages
          ]
        })
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new Error(`DeepSeek API ${response.status}: ${detail.slice(0, 300)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = event.choices?.[0]?.delta?.content;
            if (text) yield { type: "delta", text };
          } catch {
            // 忽略偶尔的 keep-alive 或畸形行
          }
        }
      }

      yield { type: "final", corrections: [], newWords: [] };
    }
  };
}

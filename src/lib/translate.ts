// Timestamp: 2026-11-18 10:58
import { meteredFetch } from "./api-usage.ts";
// Spanish → Chinese translation providers.
//
// The original Tencent TMT integration depended on a monthly free resource
// pack that expires at month end, after which every call silently degraded to
// echoing the source text. These providers use the OpenAI-compatible chat
// endpoints we already depend on elsewhere (DeepSeek for /api/dissect and
// DashScope/glm for the dictionary), so translation keeps working without any
// extra paid quota.

type TranslateResult = {
  translation: string;
  provider: string;
};

function isConfiguredSecret(value: string | undefined): boolean {
  return Boolean(
    value &&
      !value.toLowerCase().includes("replace-with") &&
      !value.toLowerCase().includes("placeholder")
  );
}

function containsChinese(text: string): boolean {
  return /[一-鿿]/.test(text);
}

function extractContent(
  data: { choices?: Array<{ message?: { content?: string } }> } | null
): string {
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

const LANG_NAME: Record<string, string> = {
  es: "Spanish",
  de: "German",
  en: "English",
  fr: "French",
  ja: "Japanese"
};

async function translateWithOpenAICompatible(
  provider: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  text: string,
  sourceLang = "es"
): Promise<TranslateResult> {
  const sourceName = LANG_NAME[sourceLang] ?? "Spanish";
  const response = await meteredFetch({ provider, feature: "translation", unit: "tokens" }, `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            `You translate ${sourceName} text into natural Simplified Chinese.`,
            "Return JSON only with a single key `translation`.",
            "Preserve tone, nuances and meaning naturally.",
            "Never output the source text unchanged; always give real Chinese."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({ text })
        }
      ]
    })
  }, true);

  if (!response.ok) {
    throw new Error(`${provider} translate failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = extractContent(data);

  let parsed: { translation?: string } = {};
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
  } catch {
    // Some models return plain text despite response_format; accept it.
    parsed = { translation: raw };
  }

  const translation = parsed.translation?.trim() ?? "";

  if (!translation) {
    throw new Error(`${provider} translate returned empty response`);
  }

  return { translation, provider };
}

async function translateWithDeepSeek(text: string, sourceLang = "es"): Promise<TranslateResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  if (!isConfiguredSecret(apiKey)) {
    throw new Error("DeepSeek not configured");
  }

  return translateWithOpenAICompatible("deepseek", baseUrl, apiKey, model, text, sourceLang);
}

async function translateWithDashScope(text: string, sourceLang = "es"): Promise<TranslateResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY ?? "";
  const model = process.env.DASHSCOPE_MODEL ?? "glm-5";

  if (!isConfiguredSecret(apiKey)) {
    throw new Error("DashScope not configured");
  }

  return translateWithOpenAICompatible(
    "dashscope",
    "https://dashscope.aliyuncs.com/compatible-mode",
    apiKey,
    model,
    text,
    sourceLang
  );
}

export async function translateTextToZh(
  text: string,
  sourceLang = "es"
): Promise<TranslateResult | null> {
  const providers = [translateWithDeepSeek, translateWithDashScope];

  for (const provider of providers) {
    try {
      const result = await provider(text, sourceLang);

      const sameAsSource = result.translation.trim().toLowerCase() === text.trim().toLowerCase();
      if (sameAsSource || !containsChinese(result.translation)) {
        // A "translation" with no Chinese is a model echo, not a result.
        continue;
      }

      return result;
    } catch (error) {
      console.warn("Translation provider failed, trying next", error);
    }
  }

  return null;
}

// Try each provider in order. Returns null when every provider is missing or
// fails, so the caller can fall back to echoing the source.
export async function translateEsToZh(text: string): Promise<TranslateResult | null> {
  return translateTextToZh(text, "es");
}

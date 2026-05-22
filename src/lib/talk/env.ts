// Talk 集成共用的环境变量读取与校验
// 这些 secret 必须存在；缺失时直接抛错（开发期失败-fast 优于运行时神秘 500）

export function getMessageEncryptionSecret(): string {
  const value = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!value || value.length < 16) {
    throw new Error(
      "MESSAGE_ENCRYPTION_KEY is missing or too short (need ≥ 16 chars). Set it in .env"
    );
  }
  return value;
}

export function getDeepseekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(
    /\/+$/,
    ""
  );
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  return { apiKey, baseUrl, model };
}

export function isConfiguredSecret(value: string | undefined): boolean {
  return Boolean(
    value && !value.toLowerCase().includes("replace-with") && !value.toLowerCase().includes("placeholder")
  );
}

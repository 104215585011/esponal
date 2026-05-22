// AES-256-GCM 落库加密；search/index 用密文，解密发生在读取路径上
// 直接搬自 talks/src/lib/chat/message-crypto.ts，未修改

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

export type EncryptedMessageContent = {
  content: string;
  contentIv: string;
  contentAuthTag: string;
};

function getKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptMessageContent(
  content: string,
  secret: string
): EncryptedMessageContent {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);

  return {
    content: encrypted.toString("base64url"),
    contentIv: iv.toString("base64url"),
    contentAuthTag: cipher.getAuthTag().toString("base64url")
  };
}

export function decryptMessageContent(
  encrypted: EncryptedMessageContent,
  secret: string
) {
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(secret),
    Buffer.from(encrypted.contentIv, "base64url")
  );

  decipher.setAuthTag(Buffer.from(encrypted.contentAuthTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.content, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

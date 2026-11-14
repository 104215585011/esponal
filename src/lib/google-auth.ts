import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { issueTokenPair } from "@/lib/mobile-token";

/**
 * Google 登录共享逻辑,给两个入口用:
 *   - /api/mobile/auth/google      App 直接传 id_token(expo-auth-session 自动换好的)
 *   - /api/mobile/auth/google-code App 传 authorization code + PKCE verifier,这里换 token
 *
 * 为什么要把「换 token」也放到服务端:
 *   expo-auth-session 在客户端换 code 的那段代码没有错误处理,Google 拒绝时
 *   表现为「什么都发生」,没法排查。放到服务端,具体错误能原样返回给 App 显示。
 */

/** 允许的 audience 见 allowedAudiences 注释;这里再内置一份自家 Android 客户端 id 兜底 */
export const BUILTIN_ANDROID_CLIENT_ID =
  "944314756480-p5qqusb05evjcbf18dhvk8prril23onv.apps.googleusercontent.com";

/**
 * 允许的 audience:
 *   - GOOGLE_ANDROID_CLIENT_ID:App 打包时用的 Android 客户端(环境变量)
 *   - GOOGLE_CLIENT_ID:Web 端 OAuth 的客户端(NextAuth 已在用)
 *   - BUILTIN_ANDROID_CLIENT_ID:兜底
 *
 * 内置一份的原因:这个 id 是公开信息(每个 APK 里都能翻出来),而 Vercel
 * 环境变量名字写错/漏配会让 App 登录在最后一步失败,排查成本远高于内置的成本。
 * 它只放宽到「本项目的客户端」,不会接受别人的 id_token。
 */
export function allowedAudiences(): string[] {
  const candidates = [
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
    BUILTIN_ANDROID_CLIENT_ID
  ];

  return Array.from(
    new Set(candidates.filter((v): v is string => Boolean(v && v.trim())).map((v) => v.trim()))
  );
}

export type GoogleProfile = {
  email: string;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
};

/** 验签 Google id_token,失败返回 null */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  const audiences = allowedAudiences();
  if (audiences.length === 0) return null;

  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();

    const email = (payload?.email ?? "").toLowerCase().trim();
    if (!email) return null;

    return {
      email,
      name: payload?.name ?? null,
      picture: payload?.picture ?? null,
      emailVerified: payload?.email_verified === true
    };
  } catch (error) {
    console.error("verifyGoogleIdToken failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

export type GoogleCodeExchangeResult =
  | { ok: true; idToken: string }
  | { ok: false; error: string; errorDescription?: string };

/**
 * 用 authorization code + PKCE verifier 换 token。
 *
 * Android 类型的 client 是「installed app」类客户端:不需要 client_secret,
 * 靠 PKCE 保护,redirect_uri 必须和授权请求里的一模一样。
 */
export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GoogleCodeExchangeResult> {
  const clientId = (process.env.GOOGLE_ANDROID_CLIENT_ID || BUILTIN_ANDROID_CLIENT_ID).trim();

  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }),
      cache: "no-store"
    });
  } catch (error) {
    console.error("google token endpoint unreachable:", error);
    return { ok: false, error: "google token endpoint unreachable" };
  }

  const body = (await response.json().catch(() => null)) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !body?.id_token) {
    console.error(
      "google code exchange failed:",
      response.status,
      body?.error,
      body?.error_description
    );
    return {
      ok: false,
      error: body?.error ?? `token exchange failed (HTTP ${response.status})`,
      errorDescription: body?.error_description
    };
  }

  return { ok: true, idToken: body.id_token };
}

export type GoogleSignInResult =
  | { ok: true; tokens: Awaited<ReturnType<typeof issueTokenPair>>; user: GoogleUserRow }
  | { ok: false; status: number; code: string; error: string };

type GoogleUserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  plan: string;
};

/** 验签通过后:已有账号直接登录,没有就建一个无密码账号 */
export async function signInWithGoogleProfile(
  profile: GoogleProfile
): Promise<GoogleSignInResult> {
  if (!profile.emailVerified) {
    return { ok: false, status: 403, code: "EMAIL_NOT_VERIFIED", error: "google email is not verified" };
  }

  // 已有账号(含邮箱密码注册过的)直接登录;没有就建一个无密码账号
  const existing = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, email: true, name: true, image: true, plan: true }
  });

  let user = existing;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        image: profile.picture,
        emailVerified: new Date()
      },
      select: { id: true, email: true, name: true, image: true, plan: true }
    });
  } else if ((!user.name && profile.name) || (!user.image && profile.picture)) {
    // 只补空字段,不覆盖用户自己改过的昵称/头像
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name ?? profile.name,
        image: user.image ?? profile.picture
      },
      select: { id: true, email: true, name: true, image: true, plan: true }
    });
  }

  const tokens = await issueTokenPair({
    id: user.id,
    email: user.email,
    name: user.name ?? profile.name
  });

  return {
    ok: true,
    tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? profile.name,
      image: user.image ?? profile.picture,
      plan: user.plan
    }
  };
}
